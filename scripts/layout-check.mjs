// Responsive layout check at phone widths. Visits every screen in the shared scenario list from
// scripts/lib/scenarios.mjs (the character tabs and the
// Builder subtabs, including the race picker for a character with no race, the background picker and the
// Custom Background creator for one with no background, home, settings, and the Rest, Conditions and Create
// New Folder modals), the hit point modal (from the Stats HP number and the header HP badge), and the Active
// Wild Shape box (Stats tab, header badge, Features tab), and how modals close (backdrop tap, Escape, the
// ✕ button, and the discard confirmation for a modal holding unsaved input). The helpers that start the
// app and seed it are in scripts/lib/app-driver.mjs (see docs/agents/driving-the-app.md).
//
// Usage: `npm run layout:check` (not part of check:all). The script starts the Expo web server itself
// on the port in BASE, unless a server already answers there. `npm run layout:check -- --integrated`
// (or LAYOUT_INTEGRATED=1) seeds the integrated catalog instead of the SRD Baseline. The first run
// needs `npx playwright install chromium` once.
//
// Fails (one line per violation) on squeezed text and on elements that stick out of a non-scrolling
// parent. Env: BASE (default http://localhost:8099), WIDTHS (default "393,360,320,412"), ONLY (a comma-separated
// list of substrings: only the scenarios whose name contains one of them, ignoring case, are visited in every
// width; unset visits all), SHOTS (screenshot dir, default a layout-check folder under the OS temp dir). Exit:
// 0 green, 1 violations, 2 no browser or no server (the server log path is printed then), or an ONLY term that
// matches no scenario (the scenario names are printed then). `--list` prints the shared scenario list (the
// SCREENS names) as JSON and exits without starting anything.
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { chromium } from "playwright";
import {
  httpStatus,
  seedBrowser,
  signalExpoGroup,
  spawnExpoWeb,
  stopExpoWeb,
  waitForExpoWeb,
} from "./lib/app-driver.mjs";
import { buildScreens, buildSeed, CHARACTER_ID, DRUID_ID } from "./lib/scenarios.mjs";
import { playStep, playSteps } from "./lib/web-steps.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE ?? "http://localhost:8099";
const PORT = new URL(BASE).port || "8099";
const SHOTS = process.env.SHOTS ?? join(tmpdir(), "layout-check");
const WIDTHS = (process.env.WIDTHS ?? "393,360,320,412").split(",").map(Number);
// Lowercase substrings from ONLY. Empty when ONLY is unset or blank, which visits every scenario.
const ONLY = (process.env.ONLY ?? "").split(",").map((term) => term.trim().toLowerCase()).filter(Boolean);
const INTEGRATED = process.argv.includes("--integrated") || process.env.LAYOUT_INTEGRATED === "1";
const SERVER_WAIT_MS = 180_000;

// The Expo web server this script started. It runs in its own process group, so one signal stops it and its children.
let server = null;

function signalServerGroup(signal) {
  if (server) signalExpoGroup(server, signal);
}

async function stopServer() {
  if (!server) return;
  await stopExpoWeb(server);
  server = null;
}

// Starts the Expo web server on PORT (see spawnExpoWeb). Resolves "up", "exited" or "timeout" (see waitForExpoWeb).
async function startServer(logPath) {
  server = spawnExpoWeb({ root: ROOT, port: PORT, logPath });
  return waitForExpoWeb(server, BASE, SERVER_WAIT_MS);
}

// The scenarios this run visits, in order, from the shared module (scripts/lib/scenarios.mjs).
const SCREENS = buildScreens({ integrated: INTEGRATED });

// Runs in the browser. Returns one message per layout violation inside `root` (an element handle,
// or the whole document when null).
function findLayoutViolations(root) {
  const nodes = (root ?? document).querySelectorAll("*");
  const out = [];
  const scrollerX = (el) => /(auto|scroll)/.test(getComputedStyle(el).overflowX);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.height === 0) continue;
    const text = (el.textContent || "").trim();
    // Inputs have no text content, so they are named by their placeholder.
    const label = text || el.getAttribute("placeholder") || el.tagName.toLowerCase();
    const fontSize = parseFloat(getComputedStyle(el).fontSize) || 14;
    const lines = r.height / (fontSize * 1.25);
    // Squeezed means many lines of short text (a narrow column), not a long paragraph at a normal width.
    if (el.children.length === 0 && text.length >= 20 && lines >= 5 && text.length / lines < 25)
      out.push(`squeezed text (${Math.round(r.width)}px wide, ${Math.round(r.height)}px tall, ~${Math.round(lines)} lines of ~${Math.round(text.length / lines)} characters): "${text.slice(0, 40)}"`);
    if (r.width === 0) continue;
    const p = el.parentElement;
    if (!p || scrollerX(p)) continue;
    let inScroller = false;
    for (let a = p; a; a = a.parentElement) if (scrollerX(a) && a !== document.documentElement && a !== document.body) { inScroller = true; break; }
    if (inScroller) continue;
    const pr = p.getBoundingClientRect();
    if (pr.width > 0 && r.right > pr.right + 1) out.push(`sticks out of its parent by ${Math.round(r.right - pr.right)}px: "${label.slice(0, 40)}"`);
  }
  return [...new Set(out)];
}

// Runs in the browser. Checks the header of a character sheet for a long name. The name must be clipped and end
// with an ellipsis, and it must end before the level badge and the HP badge start. Returns one message per violation.
function findHeaderNameViolations(name) {
  const leaves = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 0);
  const nameEl = leaves.find((e) => e.textContent.trim() === name);
  if (!nameEl) return [`header name "${name.slice(0, 40)}" is not on the screen`];
  const badgeText = leaves.filter((e) => /^(Lvl \d+|\d+\/\d+.*)$/.test(e.textContent.trim()) && e.getBoundingClientRect().top < 80);
  const out = [];
  const nr = nameEl.getBoundingClientRect();
  const cs = getComputedStyle(nameEl);
  if (cs.textOverflow !== "ellipsis" || cs.overflow !== "hidden") out.push(`header name has no ellipsis (text-overflow: ${cs.textOverflow}, overflow: ${cs.overflow})`);
  if (nameEl.scrollWidth <= nameEl.clientWidth) out.push(`header name is not clipped (${nameEl.scrollWidth}px of text in ${nameEl.clientWidth}px)`);
  if (nr.right > window.innerWidth + 1) out.push(`header name sticks out of the screen by ${Math.round(nr.right - window.innerWidth)}px`);
  for (const badge of badgeText) {
    const br = (badge.parentElement ?? badge).getBoundingClientRect();
    if (nr.right > br.left + 1 && nr.left < br.right - 1) out.push(`header name overlaps the badge "${badge.textContent.trim().slice(0, 20)}" by ${Math.round(nr.right - br.left)}px`);
  }
  return out;
}

// Runs in the browser. Native Text defaults to flexShrink 0 and the web's does not, so a title that wraps in
// this web check runs into its badge, counter or button on a phone. Forces flexShrink 0 on the children of every
// row (flex, space-between, two or more children) and tags those rows. Returns how many rows it tagged.
function forceNoShrinkRows() {
  let tagged = 0;
  for (const row of document.querySelectorAll("*")) {
    if (row.hasAttribute("data-noshrink") || row.children.length < 2) continue;
    const cs = getComputedStyle(row);
    if (cs.display !== "flex" || cs.flexDirection !== "row" || cs.justifyContent !== "space-between") continue;
    row.setAttribute("data-noshrink", "");
    for (const kid of row.children) {
      kid.dataset.prevShrink = kid.style.flexShrink;
      kid.style.flexShrink = "0";
    }
    tagged++;
  }
  return tagged;
}

// Runs in the browser. Undoes forceNoShrinkRows.
function restoreNoShrinkRows() {
  for (const row of document.querySelectorAll("[data-noshrink]")) {
    row.removeAttribute("data-noshrink");
    for (const kid of row.children) {
      kid.style.flexShrink = kid.dataset.prevShrink ?? "";
      delete kid.dataset.prevShrink;
    }
  }
}

// Checks the rows of the open page as native Text lays them out. Only Builder screens: the rows there are
// the ones the sibling rule (CODING_STANDARDS section 7) covers.
async function checkNoShrinkRows(page, screen) {
  if (!screen.name.startsWith("Builder")) return [];
  await page.evaluate(forceNoShrinkRows);
  const out = [];
  try {
    for (const row of await page.$$("[data-noshrink]")) out.push(...(await page.evaluate(findLayoutViolations, row)));
  } finally {
    await page.evaluate(restoreNoShrinkRows);
  }
  return out.map((v) => `row, native text (flexShrink 0): ${v}`);
}

// Runs in the browser. Whether the button labelled `text` is disabled, read from the aria-disabled that the Button
// sets on its touch target (the element with a tabindex). Null when no such label is on the page; `state` says what was read.
function buttonDisabled(text) {
  const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.includes(text));
  const target = el?.closest("[tabindex]");
  if (!target) {
    const near = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && /Claim|Choose|Starting|Equipment/.test(e.textContent)).map((e) => e.textContent).slice(0, 10);
    return { disabled: null, state: `no button with that label; near: ${near.join(" | ")}` };
  }
  const aria = target.getAttribute("aria-disabled");
  return { disabled: aria === "true", state: `aria-disabled=${aria}` };
}

// Runs in the browser. True when the race card titled `name` has a plain row under its "Subraces / Variants:" label:
// the row for the race's own form, which is the card's title text inside that box.
function findPlainRaceRow(name) {
  const leaves = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0);
  const title = leaves.find((e) => e.textContent.trim() === name);
  for (let card = title?.parentElement; card; card = card.parentElement) {
    const label = [...card.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "Subraces / Variants:");
    if (label) return [...label.parentElement.querySelectorAll("*")].some((e) => e.children.length === 0 && e.textContent.trim() === name);
  }
  return false;
}

// Runs in the browser. The open modal dialog whose title is `title`, or null.
function findDialog(title) {
  const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === title);
  return el?.closest('[role="dialog"]') ?? null;
}

// Runs in the browser. The open hit point modal (normal or wild shape): the smallest ancestor of its Amount field that holds the title and the buttons.
function findHpModal() {
  for (let a = document.querySelector('[aria-label="Amount"]'); a; a = a.parentElement) {
    const text = a.textContent || "";
    if ((text.includes("Hit Points") || text.includes("Wild Shape HP")) && text.includes("Set to")) return a;
  }
  return null;
}

// Runs in the browser. Indexes of the "Change hit points" controls: `stats` is the one under the
// HIT POINTS label on the Stats tab, `header` is the first one that is not `stats` (the header badge).
function findHpControls() {
  const all = [...document.querySelectorAll('[aria-label="Change hit points"]')];
  const label = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "HIT POINTS");
  let stats = -1;
  for (let a = label?.parentElement; a && stats < 0; a = a.parentElement) {
    const hit = all.find((el) => a.contains(el));
    if (hit) stats = all.indexOf(hit);
  }
  const header = all.findIndex((_, i) => i !== stats);
  return { stats, header };
}

// Runs in the browser. Same as findHpControls, for the wild shape controls ("Change wild shape hit points").
function findWildShapeControls() {
  const all = [...document.querySelectorAll('[aria-label="Change wild shape hit points"]')];
  const label = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "WILD SHAPE HP");
  let stats = -1;
  for (let a = label?.parentElement; a && stats < 0; a = a.parentElement) {
    const hit = all.find((el) => a.contains(el));
    if (hit) stats = all.indexOf(hit);
  }
  const header = all.findIndex((_, i) => i !== stats);
  return { stats, header };
}

// Opens the wild shape HP box from one control, checks it (no violations, shows the form's "+4 Temp" line), closes it.
async function checkWildShapeBox(page, index, prefix, shot) {
  if (index < 0) {
    console.log(`${prefix} no "Change wild shape hit points" control found`);
    return 1;
  }
  let failures = 0;
  await page.locator('[aria-label="Change wild shape hit points"]').nth(index).click();
  await page.getByText("Set to", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, shot) });
  const modal = await page.evaluateHandle(findHpModal);
  if (!modal.asElement()) {
    failures++;
    console.log(`${prefix} modal not found`);
  } else {
    const text = await page.evaluate((el) => el.textContent || "", modal);
    if (!text.includes("Wild Shape HP")) {
      failures++;
      console.log(`${prefix} modal is not the wild shape box`);
    }
    if (!text.includes("+4 Temp")) {
      failures++;
      console.log(`${prefix} modal does not show the form's "+4 Temp" line`);
    }
    for (const v of await page.evaluate(findLayoutViolations, modal)) {
      failures++;
      console.log(`${prefix} ${v}`);
    }
  }
  await page.getByText("✕", { exact: true }).first().click();
  await page.getByText("Set to", { exact: true }).first().waitFor({ state: "hidden", timeout: 10000 });
  await page.waitForTimeout(400);
  return failures;
}

// Opens the Druid's Stats tab and checks the Active Wild Shape box and the header badge that opens the same box.
async function checkWildShapeScreen(ctx, width) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/character/${DRUID_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText("Stats", { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByText("WILD SHAPE HP", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && (e.textContent || "").includes("WILD SHAPE HP"));
    el?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, `WildShape-Stats-${width}.png`) });
  let failures = 0;
  for (const v of await page.evaluate(findLayoutViolations, null)) {
    failures++;
    console.log(`[${width}px wild shape Stats] ${v}`);
  }
  failures += await checkWildShapeTempLine(page, `[${width}px wild shape Stats]`);
  const controls = await page.evaluate(findWildShapeControls);
  failures += await checkWildShapeBox(page, controls.stats, `[${width}px wild shape box from Stats number]`, `WildShapeModal-${width}.png`);
  failures += await checkWildShapeBox(page, controls.header, `[${width}px wild shape box from header badge]`, `WildShapeModal-header-${width}.png`);
  await page.close();
  return failures;
}

// Checks the Active Wild Shape card shows the form's temp HP next to its HP, as "(+4 Temp)".
async function checkWildShapeTempLine(page, prefix) {
  const visible = await page.getByText("(+4 Temp)", { exact: true }).first().isVisible();
  if (visible) return 0;
  console.log(`${prefix} Active Wild Shape card does not show "(+4 Temp)"`);
  return 1;
}

// Runs in the browser. The Active Wild Shape card: the smallest ancestor of the "WILD SHAPE HP" label that also holds the "ACTIVE WILD SHAPE" badge.
function findWildShapeCard() {
  const label = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "WILD SHAPE HP");
  for (let a = label?.parentElement; a; a = a.parentElement) {
    if ((a.textContent || "").includes("ACTIVE WILD SHAPE")) return a;
  }
  return null;
}

// Opens the Druid's Features tab (same shared Active Wild Shape card as Stats) and checks the card for layout violations.
async function checkWildShapeFeatures(ctx, width) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/character/${DRUID_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText("Features", { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByText("WILD SHAPE HP", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && (e.textContent || "").includes("WILD SHAPE HP"));
    el?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, `WildShape-Features-${width}.png`) });
  let failures = await checkWildShapeTempLine(page, `[${width}px wild shape Features]`);
  const card = await page.evaluateHandle(findWildShapeCard);
  if (!card.asElement()) {
    failures++;
    console.log(`[${width}px wild shape Features] no Active Wild Shape card found`);
  } else {
    for (const v of await page.evaluate(findLayoutViolations, card)) {
      failures++;
      console.log(`[${width}px wild shape Features card] ${v}`);
    }
  }
  await page.close();
  return failures;
}

// The text of the smallest element that holds both needles: the card that shows a title and one of its spells.
function smallestTextWith([first, second]) {
  let best = "";
  for (const element of document.querySelectorAll("*")) {
    const text = element.innerText ?? "";
    if (text.includes(first) && text.includes(second) && (best === "" || text.length < best.length)) best = text;
  }
  return best;
}

// Runs in the browser. The tab content under the review notices box whose count row reads `count`: the element after the
// notices box, or null when that box is not on the screen. Its height and bottom edge are what the tab content gets.
function findTabContentBelowNotices(count) {
  const leaf = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === count);
  const header = leaf?.closest('button, [role="button"]');
  const content = header?.parentElement?.parentElement?.nextElementSibling;
  if (!content) return null;
  const r = content.getBoundingClientRect();
  return { height: r.height, bottom: r.bottom, viewport: window.innerHeight };
}

// Runs in the browser. The vertical gaps between neighbouring review Dismiss buttons, top to bottom.
function findDismissGaps() {
  const boxes = [...document.querySelectorAll('[aria-label^="Dismiss "]')]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.height > 0)
    .sort((a, b) => a.top - b.top);
  return boxes.slice(1).map((r, i) => r.top - boxes[i].bottom);
}

// Checks what a picker screen must show that the layout rules cannot see: texts and input placeholders on the page,
// and (`plainRaceRow`) the plain race row. Returns one message per missing control.
async function checkExpected(page, expect) {
  const out = [];
  if (expect.cardWithout) {
    const { title, spell, rows } = expect.cardWithout;
    const card = await page.evaluate(smallestTextWith, [title, spell]);
    if (card === "") out.push(`no "${title}" card shows "${spell}"`);
    for (const row of rows) {
      if (card.includes(row)) out.push(`the "${title}" card shows "${row}"`);
    }
  }
  for (const text of expect.texts ?? []) {
    if (!(await page.getByText(text, { exact: true }).first().isVisible())) out.push(`missing "${text}"`);
  }
  for (const placeholder of expect.placeholders ?? []) {
    if (!(await page.getByPlaceholder(placeholder).first().isVisible())) out.push(`missing the input with placeholder "${placeholder}"`);
  }
  for (const text of expect.absent ?? []) {
    if (await page.getByText(text, { exact: true }).first().isVisible()) out.push(`"${text}" is shown but should not be`);
  }
  for (const pattern of expect.absentMatching ?? []) {
    if (await page.getByText(pattern).first().isVisible()) out.push(`text matching ${pattern} is shown but should not be`);
  }
  for (const text of expect.disabled ?? []) {
    const { disabled, state } = await page.evaluate(buttonDisabled, text);
    if (disabled !== true) out.push(`"${text}" is not disabled (${state})`);
  }
  for (const text of expect.enabled ?? []) {
    const { disabled, state } = await page.evaluate(buttonDisabled, text);
    if (disabled !== false) out.push(`"${text}" is not enabled (${state})`);
  }
  if (expect.tabContentBelowNotices) {
    const { count, minHeight } = expect.tabContentBelowNotices;
    const box = await page.evaluate(findTabContentBelowNotices, count);
    if (!box) out.push(`no tab content found below the "${count}" notices box`);
    else {
      if (box.height < minHeight) out.push(`tab content below the notices is ${Math.round(box.height)}px tall, under ${minHeight}px`);
      if (box.bottom > box.viewport + 1) out.push(`tab content below the notices ends ${Math.round(box.bottom - box.viewport)}px below the window`);
    }
  }
  if (expect.dismissGapMin !== undefined) {
    const gaps = await page.evaluate(findDismissGaps);
    if (gaps.length === 0) out.push("no two Dismiss rows to compare");
    else if (Math.min(...gaps) < expect.dismissGapMin) out.push(`Dismiss buttons are ${Math.round(Math.min(...gaps))}px apart, under ${expect.dismissGapMin}px`);
  }
  if (expect.fitsWidth) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) out.push(`the page scrolls sideways by ${overflow}px`);
  }
  if (expect.plainRaceRow && !(await page.evaluate(findPlainRaceRow, expect.plainRaceRow))) {
    out.push(`no plain "${expect.plainRaceRow}" row under "Subraces / Variants:"`);
  }
  return out;
}

// Visits one screen of SCREENS and checks it. Returns the number of violations (or 1 if it never became ready).
async function visitScreen(page, width, screen, state) {
  const prefix = `[${width}px ${screen.name}]`;
  const ready = screen.modal ?? screen.ready;
  const readyLocator = typeof ready === "string" ? page.getByText(ready, { exact: true }) : page.getByText(ready);
  try {
    if (screen.modal || screen.fresh || state.route !== screen.route) {
      await page.goto(`${BASE}${screen.route}`, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(1500);
    }
    for (const tab of screen.tabs ?? []) {
      await page.getByText(tab, { exact: true }).first().click();
      await page.waitForTimeout(500);
    }
    if (screen.open) await playSteps(page, screen.open);
    await readyLocator.first().waitFor({ state: "visible", timeout: 10000 });
  } catch {
    console.log(`${prefix} did not show ${typeof ready === "string" ? `"${ready}"` : ready} in time`);
    state.route = null;
    return 1;
  }
  if (screen.scrollTo) {
    await page.evaluate((needle) => {
      const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && (e.textContent || "").includes(needle));
      el?.scrollIntoView({ block: "center" });
    }, screen.scrollTo);
  }
  await page.waitForTimeout(screen.modal ? 500 : 300);
  await page.screenshot({ path: join(SHOTS, `${screen.name.replace(/\W+/g, "-")}-${width}.png`) });
  state.route = screen.modal ? null : screen.route;
  let violations;
  if (screen.modal) {
    const root = await page.evaluateHandle(findDialog, screen.modal);
    if (!root.asElement()) {
      console.log(`${prefix} modal "${screen.modal}" not found`);
      return 1;
    }
    violations = await page.evaluate(findLayoutViolations, root);
  } else {
    violations = await page.evaluate(findLayoutViolations, null);
  }
  violations = [...violations, ...(await checkNoShrinkRows(page, screen))];
  if (screen.headerName) violations = [...violations, ...(await page.evaluate(findHeaderNameViolations, screen.headerName))];
  if (screen.expect) violations = [...violations, ...(await checkExpected(page, screen.expect))];
  for (const v of violations) console.log(`${prefix} ${v}`);
  return violations.length;
}

// Visits the screens in SCREENS that ONLY selects, on one width's context.
async function checkScreens(ctx, width) {
  const page = await ctx.newPage();
  const state = { route: null };
  let failures = 0;
  for (const screen of SCREENS) if (selected(screen.name)) failures += await visitScreen(page, width, screen, state);
  await page.close();
  return failures;
}

// Opens the Stats tab of the Rendar and checks the hit point modal from the Stats HP number and from the header badge.
async function checkHitPointModals(ctx, width) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/character/${CHARACTER_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText("Stats", { exact: true }).first().click();
  await page.waitForTimeout(500);
  let failures = 0;
  const controls = await page.evaluate(findHpControls);
  const entries = [
    ["Stats number", controls.stats, `HpModal-${width}.png`],
    ["header badge", controls.header, `HpModal-header-${width}.png`],
  ];
  for (const [entry, index, shot] of entries) {
    const prefix = `[${width}px HP modal from ${entry}]`;
    if (index < 0) {
      failures++;
      console.log(`${prefix} no "Change hit points" control found`);
      continue;
    }
    await page.locator('[aria-label="Change hit points"]').nth(index).click();
    await page.getByText("Set to", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(SHOTS, shot) });
    const modal = await page.evaluateHandle(findHpModal);
    if (!modal.asElement()) {
      failures++;
      console.log(`${prefix} modal not found`);
    } else {
      for (const v of await page.evaluate(findLayoutViolations, modal)) {
        failures++;
        console.log(`${prefix} ${v}`);
      }
    }
    await page.getByText("✕", { exact: true }).first().click();
    await page.getByText("Set to", { exact: true }).first().waitFor({ state: "hidden", timeout: 10000 });
    await page.waitForTimeout(400);
  }
  await page.close();
  return failures;
}

// Runs in the browser. A point on the visible backdrop of the open modal: a viewport corner that the
// open dialog covers but its container does not, so the tap lands on the backdrop, not the modal.
function backdropPoint() {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return null;
  for (const [x, y] of [[10, 10], [10, window.innerHeight - 10], [window.innerWidth - 10, 10], [window.innerWidth - 10, window.innerHeight - 10]]) {
    const el = document.elementFromPoint(x, y);
    if (el && dialog.contains(el)) {
      const r = el.getBoundingClientRect();
      if (r.width >= window.innerWidth - 32 && r.height >= window.innerHeight - 32) return { x, y };
    }
  }
  return null;
}

// Taps the visible backdrop of the open modal at `page`. False when no backdrop point was found.
async function tapBackdrop(page) {
  // The dialog wrapper mounts a beat after the modal content, so wait for it before looking for the backdrop.
  await page.waitForSelector('[role="dialog"]', { state: "attached", timeout: 10000 }).catch(() => {});
  const point = await page.evaluate(backdropPoint);
  if (!point) return false;
  await page.mouse.click(point.x, point.y);
  return true;
}

// How a modal closes: the backdrop and Escape close a modal with no unsaved work, the ✕ button too;
// a modal holding unsaved input asks "Discard changes?" first, and only "Discard" closes it.
async function checkModalClosing(ctx, width) {
  const page = await ctx.newPage();
  const prefix = `[${width}px modal closing]`;
  let failures = 0;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
  };
  const shot = (name) => join(SHOTS, `ModalClosing-${name}-${width}.png`);
  // Waits until the modal titled `title` is visible (wantVisible true) or gone (false).
  const waitDialog = async (title, wantVisible) => {
    try {
      await page.getByText(title, { exact: true }).first().waitFor({ state: wantVisible ? "visible" : "hidden", timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  };
  const dialogShown = (title) => waitDialog(title, true);
  // Taps the button labelled `text` when it is on the page; reports and returns false when it is not.
  const tapButton = async (text) => {
    const btn = page.getByText(text, { exact: true }).first();
    if ((await btn.count()) === 0) {
      fail(`no "${text}" button on the page`);
      return false;
    }
    await btn.click({ timeout: 5000 }).catch(() => fail(`could not tap the "${text}" button`));
    return true;
  };
  // Closes a still-open Rest modal so the next step can open it again.
  const closeRestIfOpen = async () => {
    if (await dialogShown("Rest & Recovery")) {
      await tapBackdrop(page);
      await waitDialog("Rest & Recovery", false);
    }
  };

  // The Rest modal holds no unsaved input: backdrop tap, Escape and the ✕ button each close it.
  await page.goto(`${BASE}/character/${CHARACTER_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText("Stats", { exact: true }).first().click();
  await page.waitForTimeout(500);
  for (const [how, close] of [
    ["backdrop", async () => (await tapBackdrop(page)) || fail("could not tap the backdrop of the open modal")],
    ["Escape", () => page.keyboard.press("Escape")],
    ["close button", () => page.getByText("✕", { exact: true }).first().click({ timeout: 5000 }).catch(() => fail("could not tap the ✕ button"))],
  ]) {
    await closeRestIfOpen();
    await page.getByText(/^Take Rest/).first().click({ timeout: 5000 }).catch(() => fail(`could not open the Rest modal for the ${how} close`));
    if (!(await waitDialog("Rest & Recovery", true))) fail(`the Rest modal did not open for the ${how} close`);
    await close();
    if (!(await waitDialog("Rest & Recovery", false))) fail(`${how} did not close the Rest modal`);
    if (how === "backdrop") await page.screenshot({ path: shot("backdrop-closed") });
  }
  await closeRestIfOpen();

  // The Create New Folder modal with a typed name asks before closing, on backdrop tap and on Escape.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await playStep(page, { tap: { name: "home-header-folder" } });
  if (!(await waitDialog("Create New Folder", true))) fail("the Create New Folder modal did not open");
  await page.getByPlaceholder("e.g. Curse of Strahd, One-Shots").fill("Unsaved Test Folder");
  if (!(await tapBackdrop(page))) fail("could not tap the backdrop of the edited folder modal");
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot("confirm") });
  if (!(await dialogShown("Discard changes?"))) fail("tapping the backdrop of an edited modal did not ask \"Discard changes?\"");
  if (!(await dialogShown("Create New Folder"))) fail("the edited modal closed on backdrop tap instead of asking first");
  if (await tapButton("Keep editing")) {
    if (await dialogShown("Discard changes?")) fail("\"Keep editing\" did not dismiss the confirmation");
    if (!(await dialogShown("Create New Folder"))) fail("\"Keep editing\" closed the modal");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  if (!(await dialogShown("Discard changes?"))) fail("Escape on an edited modal did not ask \"Discard changes?\"");
  if (await tapButton("Discard")) {
    if (!(await waitDialog("Create New Folder", false))) fail("\"Discard\" did not close the edited modal");
  }

  // The same modal with nothing typed closes on Escape without asking.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await playStep(page, { tap: { name: "home-header-folder" } });
  if (!(await waitDialog("Create New Folder", true))) fail("the Create New Folder modal did not reopen");
  await page.keyboard.press("Escape");
  if (!(await waitDialog("Create New Folder", false))) fail("Escape did not close the untouched folder modal");
  if (await dialogShown("Discard changes?")) fail("the untouched modal was asked \"Discard changes?\"");

  await page.close();
  return failures;
}

// The checks that open their own page rather than a SCREENS entry. Each is a scenario, so ONLY selects it by name.
const EXTRA_CHECKS = [
  { name: "HP modals", run: checkHitPointModals },
  { name: "Wild Shape Stats", run: checkWildShapeScreen },
  { name: "Wild Shape Features", run: checkWildShapeFeatures },
  { name: "Modal closing", run: checkModalClosing },
];

// Every scenario name of this run: the SCREENS entries of the active catalog, then the extra checks.
function scenarioNames() {
  return [...SCREENS.map((screen) => screen.name), ...EXTRA_CHECKS.map((check) => check.name)];
}

// Whether ONLY visits the scenario `name` (every scenario when ONLY is empty).
function selected(name) {
  return ONLY.length === 0 || ONLY.some((term) => name.toLowerCase().includes(term));
}

// The ONLY terms that no scenario name contains. Such a term is a typo, so it fails the run instead of visiting nothing.
function unmatchedOnlyTerms() {
  const names = scenarioNames().map((name) => name.toLowerCase());
  return ONLY.filter((term) => !names.some((name) => name.includes(term)));
}

// Runs every check at one width, on that width's own browser context. Returns the number of violations.
async function checkWidth(browser, seed, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 851 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  try {
    await ctx.addInitScript(seedBrowser, seed);
    let failures = await checkScreens(ctx, width);
    for (const check of EXTRA_CHECKS) if (selected(check.name)) failures += await check.run(ctx, width);
    return failures;
  } finally {
    await ctx.close();
  }
}

// Runs every check at every width, the widths at the same time. Returns the number of violations.
async function runChecks(browser) {
  const seed = buildSeed({ root: ROOT, integrated: INTEGRATED });
  const counts = await Promise.all(WIDTHS.map((width) => checkWidth(browser, seed, width)));
  return counts.reduce((total, count) => total + count, 0);
}

let browser = null;

// Stops the browser and the server this script started, then exits with `code`.
async function shutdown(code) {
  await browser?.close().catch(() => {});
  await stopServer();
  process.exit(code);
}

async function main() {
  if (process.argv.includes("--list")) {
    console.log(JSON.stringify(SCREENS.map((screen) => screen.name), null, 2));
    return 0;
  }
  const unmatched = unmatchedOnlyTerms();
  if (unmatched.length > 0) {
    console.error(`ONLY matches no scenario: ${unmatched.map((term) => `"${term}"`).join(", ")}. Scenarios in this run: ${scenarioNames().join(", ")}`);
    return 2;
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  try {
    browser = await chromium.launch();
  } catch (error) {
    console.error(`Could not launch Chromium (${error.message.split("\n")[0]}).\nInstall it once with: npx playwright install chromium`);
    return 2;
  }
  const logPath = join(SHOTS, "expo-server.log");
  if ((await httpStatus(BASE)) > 0) {
    console.log(`Using the server already running at ${BASE}. If it started before your latest code change it may be stale; stop it and rerun to test fresh code.`);
  } else {
    console.log(`Starting Expo web on port ${PORT} (log: ${logPath}).`);
    const state = await startServer(logPath);
    if (state !== "up") {
      console.error(
        state === "exited"
          ? `Expo web stopped before it answered 200 at ${BASE}. Server log: ${logPath}`
          : `No Expo web server answered 200 at ${BASE} within ${SERVER_WAIT_MS / 1000} s. Server log: ${logPath}`,
      );
      return 2;
    }
  }
  console.log(`Catalog: ${INTEGRATED ? "integrated (seeded)" : "SRD Baseline"}`);
  const failures = await runChecks(browser);
  console.log(failures === 0 ? "GREEN: no layout violations" : `RED: ${failures} violations`);
  return failures === 0 ? 0 : 1;
}

for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) process.on(signal, () => shutdown(code));
// Last resort on any exit path: the server's process group must not outlive this script.
process.on("exit", () => signalServerGroup("SIGKILL"));

main().then(
  (code) => {
    // Stop the server and browser in one place: the `finally` equivalent for every return path above.
    return shutdown(code);
  },
  (error) => {
    console.error(error);
    return shutdown(1);
  },
);
