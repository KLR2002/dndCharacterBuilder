// Responsive layout check at phone widths. Visits every screen in the shared scenario list from
// scripts/lib/scenarios.mjs (the character tabs and the
// Builder subtabs, including the race picker for a character with no race, the background picker and the
// Custom Background creator for one with no background, home, settings, and the Rest, Conditions and Create
// New Folder modals), the hit point modal (from the Stats HP number and the header HP badge), and the Active
// Wild Shape box (Stats tab, header badge, Features tab), and how modals close. On phone widths every modal
// is a bottom sheet: flush with the bottom edge with a strip of background above it, a drag handle labelled
// "Close" instead of a ✕, closing on backdrop tap, Escape, the handle and a swipe down; on wide screens a
// centred dialog of at most about 560px with a ✕. Closing paths of a modal holding unsaved input ask
// "Discard changes?" first. The Actions tab's roll badges roll attacks and damage from the ledger (the
// advantage roll sheet through the keyboard path, critical damage after a forced natural 20) without
// changing the stored character. The helpers that start the
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
import { buildScreens, buildSeed, ACTIONS_ID, CHARACTER_ID, DRUID_ID, EDIT_BUILD_ID, WIZARD_ID } from "./lib/scenarios.mjs";
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

// Checks the shape of the open modal against its width: on phones a bottom sheet flush with the bottom
// edge and full width, a visible strip of background above it (at least about 10% of the screen), a handle
// labelled "Close" at its top and no ✕; on wide screens a centred dialog of at most about 560px with a ✕
// and no handle. Returns one message per violation.
async function checkModalShape(page, width) {
  const shape = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const sheet = dialog?.querySelector('[data-testid="modal-sheet"]') ?? null;
    if (!sheet) return null;
    const r = sheet.getBoundingClientRect();
    const handle = sheet.querySelector('[aria-label="Close"][role="button"]');
    const hr = handle?.getBoundingClientRect();
    const hasCloseX = [...dialog.querySelectorAll("*")].some(
      (e) => e.children.length === 0 && e.textContent.trim() === "✕",
    );
    return {
      rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width },
      vw: window.innerWidth,
      vh: window.innerHeight,
      handle: hr ? { top: hr.top, bottom: hr.bottom } : null,
      hasCloseX,
    };
  });
  if (!shape) return ['no open modal sheet (data-testid="modal-sheet")'];
  const { rect, vw, vh } = shape;
  const out = [];
  if (width < 600) {
    if (rect.bottom < vh - 1)
      out.push(`the sheet is not flush with the bottom edge (bottom ${Math.round(rect.bottom)}px of ${vh}px)`);
    if (rect.left > 1 || rect.right < vw - 1)
      out.push(`the sheet is not full width (${Math.round(rect.left)}..${Math.round(rect.right)}px of ${vw}px)`);
    if (rect.top < vh * 0.09)
      out.push(`the background strip above the sheet is only ${Math.round(rect.top)}px (${((rect.top / vh) * 100).toFixed(1)}% of ${vh}px), under about 10%`);
    if (shape.hasCloseX) out.push("the phone sheet shows a ✕ button");
    if (!shape.handle) out.push('the phone sheet has no handle labelled "Close"');
    else if (shape.handle.bottom > rect.top + 48) out.push('the "Close" handle is not at the top of the sheet');
  } else {
    if (rect.width > 561) out.push(`the dialog is ${Math.round(rect.width)}px wide, over about 560px`);
    if (rect.bottom >= vh - 1) out.push("the wide-screen dialog sits on the bottom edge instead of centred");
    if (Math.abs(rect.top - (vh - rect.bottom)) > 2)
      out.push(`the dialog is not centred (${Math.round(rect.top)}px above, ${Math.round(vh - rect.bottom)}px below)`);
    if (!shape.hasCloseX) out.push("the wide-screen dialog has no ✕ button");
    if (shape.handle) out.push("the wide-screen dialog shows a drag handle");
  }
  return out;
}

// Closes the open modal through the shell's own close control at the current width: the handle labelled
// "Close" on phones, the ✕ button on wide screens.
async function closeModalViaShell(page) {
  const handle = page.locator('[aria-label="Close"][role="button"]').first();
  if ((await handle.count()) > 0) await handle.click({ timeout: 5000 });
  else await page.getByText("✕", { exact: true }).first().click({ timeout: 5000 });
}

// Drags the top of the sheet's content (just below the handle) downward with the mouse, the web form of
// the phone's swipe-down: only the sheet's drag handler can close the modal from there, not a button press.
// False when no sheet was found.
async function swipeSheetDown(page) {
  // The dialog wrapper mounts a beat after the modal content, so wait for it before looking for the sheet.
  await page.waitForSelector('[role="dialog"] [data-testid="modal-sheet"]', { state: "attached", timeout: 10000 }).catch(() => {});
  const pt = await page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"] [data-testid="modal-sheet"]');
    if (!sheet) return null;
    const r = sheet.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 44 };
  });
  if (!pt) return false;
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(pt.x, pt.y + i * 24, { steps: 2 });
  await page.mouse.up();
  return true;
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
  await closeModalViaShell(page);
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

// Checks what a picker screen must show that the layout rules cannot see: texts, input placeholders and
// accessibility labels on the page (`labels` present, `absentLabels` gone), and (`plainRaceRow`) the plain race
// row. Returns one message per missing control.
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
  for (const label of expect.labels ?? []) {
    if (!(await page.getByLabel(label).first().isVisible())) out.push(`missing the control labelled "${label}"`);
  }
  for (const label of expect.absentLabels ?? []) {
    if ((await page.getByLabel(label).count()) > 0) out.push(`the control labelled "${label}" is present but should not be`);
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
    violations = [...violations, ...(await checkModalShape(page, width))];
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
    await closeModalViaShell(page);
    await page.getByText("Set to", { exact: true }).first().waitFor({ state: "hidden", timeout: 10000 });
    await page.waitForTimeout(400);
  }
  await page.close();
  return failures;
}

// Runs in the browser. The count badge of the home folder section named `folder` (the digit beside the
// folder's label), or null when no such section is on the page.
function folderBadgeCount(folder) {
  const label = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === folder);
  for (let a = label?.parentElement; a; a = a.parentElement) {
    const badge = [...a.querySelectorAll("*")].find((e) => e.children.length === 0 && /^\d+$/.test(e.textContent.trim()));
    if (badge) return Number(badge.textContent.trim());
  }
  return null;
}

// "New character" on Home creates its draft in the root, outside any folder: after the tap the folder's
// count badge is unchanged and the new draft card lists at the root. The player moves it with the card's
// move-to-folder action.
async function checkDraftFolder(ctx, width) {
  const page = await ctx.newPage();
  const prefix = `[${width}px draft folder]`;
  let failures = 0;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText(/5e Character Builder/).first().waitFor({ state: "visible", timeout: 10000 });
  const before = await page.evaluate(folderBadgeCount, "Camp");
  if (before === null) {
    console.log(`${prefix} the home list shows no "Camp" folder`);
    failures++;
  }
  await playStep(page, { tap: { name: "home-header-add" } });
  const opened = await page
    .getByText("Choose Your Class:", { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    console.log(`${prefix} the new draft did not open the Creation Flow`);
    failures++;
  }
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText(/5e Character Builder/).first().waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, `DraftFolder-${width}.png`) });
  const after = await page.evaluate(folderBadgeCount, "Camp");
  if (before !== null && after !== before) {
    console.log(`${prefix} the "Camp" folder lists ${after} character(s) after "New character", expected ${before}: the draft landed in a folder instead of the root`);
    failures++;
  }
  if (!(await page.getByText("Draft · Class", { exact: true }).first().isVisible())) {
    console.log(`${prefix} the new draft card "Draft · Class" is not listed on Home`);
    failures++;
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

// How a modal closes: on phones the sheet closes on a backdrop tap, Escape, a tap on its handle labelled
// "Close" and a swipe down on that handle; on wide screens the dialog closes on a backdrop tap, Escape and
// the ✕ button. A modal holding unsaved input asks "Discard changes?" first on every one of those paths,
// and only "Discard" closes it. Every width also checks the open modal's shape (checkModalShape).
async function checkModalClosing(ctx, width) {
  const page = await ctx.newPage();
  const prefix = `[${width}px modal closing]`;
  const phone = width < 600;
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

  // The Rest modal holds no unsaved input: every close path of this width closes it.
  await page.goto(`${BASE}/character/${CHARACTER_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText("Stats", { exact: true }).first().click();
  await page.waitForTimeout(500);
  const handleLocator = page.locator('[aria-label="Close"][role="button"]').first();
  const methods = phone
    ? [
        ["backdrop", async () => (await tapBackdrop(page)) || fail("could not tap the backdrop of the open modal")],
        ["Escape", () => page.keyboard.press("Escape")],
        [
          "handle",
          async () => {
            if ((await handleLocator.count()) === 0) {
              fail('no handle labelled "Close" on the phone sheet');
              return;
            }
            await handleLocator.click({ timeout: 5000 }).catch(() => fail('could not tap the "Close" handle'));
          },
        ],
        ["swipe down", async () => (await swipeSheetDown(page)) || fail("could not swipe the sheet down from its handle")],
      ]
    : [
        ["backdrop", async () => (await tapBackdrop(page)) || fail("could not tap the backdrop of the open modal")],
        ["Escape", () => page.keyboard.press("Escape")],
        ["close button", () => page.getByText("✕", { exact: true }).first().click({ timeout: 5000 }).catch(() => fail("could not tap the ✕ button"))],
      ];
  for (const [how, close] of methods) {
    await closeRestIfOpen();
    await page.getByText(/^Take Rest/).first().click({ timeout: 5000 }).catch(() => fail(`could not open the Rest modal for the ${how} close`));
    if (!(await waitDialog("Rest & Recovery", true))) {
      fail(`the Rest modal did not open for the ${how} close`);
      continue;
    }
    if (how === methods[0][0]) {
      // The dialog wrapper and its role mount a beat after the modal content, so wait for the sheet first.
      await page.waitForSelector('[data-testid="modal-sheet"]', { state: "attached", timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(300);
      for (const v of await checkModalShape(page, width)) fail(v);
      await page.screenshot({ path: shot("open") });
    }
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

  // On a phone the handle labelled "Close" asks first too, on a modal holding unsaved input, and so does
  // a swipe down from the top of the sheet's content.
  if (phone) {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1500);
    await playStep(page, { tap: { name: "home-header-folder" } });
    if (!(await waitDialog("Create New Folder", true))) fail("the Create New Folder modal did not reopen for the handle tap");
    await page.getByPlaceholder("e.g. Curse of Strahd, One-Shots").fill("Unsaved Test Folder");
    if ((await handleLocator.count()) === 0) fail('the phone sheet has no handle labelled "Close"');
    else {
      await handleLocator.click({ timeout: 5000 }).catch(() => fail('could not tap the "Close" handle'));
      await page.waitForTimeout(400);
      if (!(await dialogShown("Discard changes?"))) fail('tapping the "Close" handle of an edited modal did not ask "Discard changes?"');
      if (!(await dialogShown("Create New Folder"))) fail("the edited modal closed on handle tap instead of asking first");
      await tapButton("Keep editing");
    }
    if (await swipeSheetDown(page)) {
      await page.waitForTimeout(400);
      if (!(await dialogShown("Discard changes?"))) fail('swiping the sheet down on an edited modal did not ask "Discard changes?"');
      if (!(await dialogShown("Create New Folder"))) fail("the edited modal closed on swipe down instead of asking first");
      await tapButton("Discard");
    } else fail("could not swipe the sheet down on the edited modal");
  }

  // The same modal with nothing typed closes on Escape without asking.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await playStep(page, { tap: { name: "home-header-folder" } });
  if (!(await waitDialog("Create New Folder", true))) fail("the Create New Folder modal did not reopen");
  await page.keyboard.press("Escape");
  if (!(await waitDialog("Create New Folder", false))) fail("Escape did not close the untouched folder modal");
  if (await dialogShown("Discard changes?")) fail("the untouched modal was asked \"Discard changes?\"");

  // A sheet that was scrolled must still close on a swipe down after it is reopened: the body's at-top
  // state resets when the modal opens, so the reopened sheet's drag handler can claim the gesture.
  if (phone) {
    await page.goto(`${BASE}/character/${WIZARD_ID}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1500);
    await page.getByText("Spells", { exact: true }).first().click();
    await page.waitForTimeout(500);
    await page.getByText(/add spells/i).first().click({ timeout: 5000 }).catch(() => fail("could not open the Add Spells modal"));
    const sheetSel = '[role="dialog"] [data-testid="modal-sheet"]';
    if (!(await page.waitForSelector(sheetSel, { state: "visible", timeout: 10000 }).then(() => true).catch(() => false)))
      fail("the Add Spells modal did not open");
    // Scroll the sheet's body down, so its at-top state is false when the modal closes.
    const scrolled = await page.evaluate(() => {
      const sheet = document.querySelector('[data-testid="modal-sheet"]');
      const el = [...(sheet?.querySelectorAll("*") ?? [])].find((n) => n.clientHeight > 0 && n.scrollHeight > n.clientHeight + 4);
      if (!el) return false;
      el.scrollTop = 240;
      el.dispatchEvent(new Event("scroll"));
      return true;
    });
    if (!scrolled) fail("the open Add Spells sheet had no scrollable body to scroll down");
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    if (!(await page.waitForSelector(sheetSel, { state: "hidden", timeout: 10000 }).then(() => true).catch(() => false)))
      fail("Escape did not close the scrolled Add Spells modal");
    // Reopen and swipe the sheet down from its top: the reset must let the swipe close it.
    await page.getByText(/add spells/i).first().click({ timeout: 5000 }).catch(() => fail("could not reopen the Add Spells modal"));
    if (!(await page.waitForSelector(sheetSel, { state: "visible", timeout: 10000 }).then(() => true).catch(() => false)))
      fail("the Add Spells modal did not reopen");
    await page.waitForTimeout(400);
    if (await swipeSheetDown(page)) {
      if (!(await page.waitForSelector(sheetSel, { state: "hidden", timeout: 10000 }).then(() => true).catch(() => false)))
        fail("a swipe down did not close the reopened sheet that had been scrolled before closing");
    } else fail("could not swipe the reopened sheet down");
  }

  await page.close();
  return failures;
}

// The floating dice button, the tray's pool roll and the session Roll Log at one width: the button opens
// the tray on the sheet; the tray builds a pool (die buttons add, chips remove, the modifier steps, the
// Disadvantage / Normal / Advantage choice only for a lone d20, the primary action labelled with the pool
// and disabled while the pool is empty), rolls it and the result card shows above the button with the
// right total; a Roll seeded through the publishing seam reads "Kara · Longsword attack" and sits above
// the "Dice tray" entry, newest first, when the card is tapped; a reload empties the log; on phones the
// button sits above the flow's bottom primary-action bar, never covering it.
async function checkDiceTrayAndLog(ctx, width) {
  const page = await ctx.newPage();
  const prefix = `[${width}px dice tray]`;
  let failures = 0;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
  };
  const shot = (name) => join(SHOTS, `DiceTray-${name}-${width}.png`);
  const dialogSel = '[role="dialog"]';
  const cardSel = '[data-testid="result-card"]';

  await page.goto(`${BASE}/character/${CHARACTER_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  const diceButton = page.getByLabel("Dice tray").first();
  if (!(await diceButton.isVisible())) fail("the floating dice button is not visible on the sheet");
  await diceButton.click();
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("the tray did not open from the floating button"));
  for (const v of await checkModalShape(page, width)) fail(v);
  await page.screenshot({ path: shot("tray") });

  // The pool builder: the primary action is disabled while the pool is empty, and the d20 mode choice
  // appears only for a pool of exactly one d20.
  const emptyRoll = await page.evaluate(buttonDisabled, "Roll");
  if (emptyRoll.disabled !== true) fail(`"Roll" is not disabled while the pool is empty (${emptyRoll.state})`);
  if ((await page.getByText("Advantage", { exact: true }).count()) > 0) fail('"Advantage" shows for an empty pool');
  await page.getByLabel("Add d20", { exact: true }).click();
  await page.waitForTimeout(200);
  if (!(await page.getByText("Advantage", { exact: true }).first().isVisible())) fail('"Advantage" does not show for a lone d20');
  await page.getByLabel("Remove 1d20", { exact: true }).click();
  await page.getByLabel("Add d6", { exact: true }).click();
  await page.getByLabel("Add d8", { exact: true }).click();
  for (let i = 0; i < 3; i++) await page.getByLabel("Modifier increase", { exact: true }).click();
  await page.waitForTimeout(200);
  if ((await page.getByText("Advantage", { exact: true }).count()) > 0) fail('"Advantage" shows for a pool that is not a lone d20');
  const rollLabel = "Roll 1d6 + 1d8 + 3";
  const rollButton = page.getByText(rollLabel, { exact: true }).first();
  if ((await rollButton.count()) === 0) fail(`the tray's primary action is not labelled "${rollLabel}"`);
  else {
    const enabled = await page.evaluate(buttonDisabled, rollLabel);
    if (enabled.disabled !== false) fail(`"${rollLabel}" is not enabled (${enabled.state})`);
    await rollButton.click();
  }

  // The tray rolled the pool and closed; the result card shows the Roll above the floating button.
  await page.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("no result card after the tray roll"));
  const roll = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="result-card"]');
    if (!card) return null;
    const chips = [...card.querySelectorAll('[data-testid="die-chip"]')].map((chip) => chip.textContent ?? "");
    const modifier = card.querySelector('[data-testid="result-modifier"]')?.textContent ?? "";
    const total = card.querySelector('[data-testid="result-total"]')?.textContent ?? "";
    const source = card.querySelector('[data-testid="result-source"]')?.textContent ?? "";
    return { chips, modifier, total, source };
  });
  if (!roll) fail("the result card disappeared before it could be read");
  else {
    if (roll.source !== "Dice tray") fail(`the result card's source is "${roll.source}", expected "Dice tray"`);
    const faces = roll.chips.map((chip) => Number(/(\d+)d\d+/.exec(chip)?.[1] ?? "NaN"));
    const parsedModifier = Number(/([+-]\d+)/.exec(roll.modifier)?.[1] ?? "NaN");
    const parsedTotal = Number(roll.total);
    if (roll.chips.length !== 2 || faces.some(Number.isNaN) || Number.isNaN(parsedModifier) || Number.isNaN(parsedTotal))
      fail(`the result card does not show two die chips, a modifier and a total: ${JSON.stringify(roll)}`);
    else if (parsedTotal !== faces.reduce((sum, face) => sum + face, 0) + parsedModifier)
      fail(`the result total ${parsedTotal} is not the faces ${faces.join("+")} ${roll.modifier}`);
  }

  // Seed a "Kara · Longsword attack" Roll through the publishing seam (no screen triggers it yet): the
  // card is replaced by it.
  const seeded = await page.evaluate(() => {
    const hook = window.__publishRoll;
    if (typeof hook !== "function") return false;
    hook({
      roll: { dice: [{ sides: 20, face: 15, dropped: false }], modifier: 5, total: 20 },
      source: "Longsword attack",
      characterName: "Kara",
    });
    return true;
  });
  if (!seeded) fail("the test-only publishing hook (window.__publishRoll) is not exposed on a seeded web build");
  else {
    await page
      .waitForFunction(() => document.querySelector('[data-testid="result-source"]')?.textContent?.includes("Kara"), null, { timeout: 10000 })
      .catch(() => fail('the result card was not replaced by the seeded "Kara · Longsword attack" entry'));
    await page.screenshot({ path: shot("result") });
    // The card's geometry: full width minus the 16px gutters on phones, at most 360px at the bottom-right
    // at wide widths, just above the floating button.
    const geo = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="result-card"]');
      const button = document.querySelector('[data-testid="dice-button"]');
      if (!card || !button) return null;
      const r = card.getBoundingClientRect();
      const b = button.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, bottom: r.bottom, buttonTop: b.top, vw: window.innerWidth };
    });
    if (!geo) fail("no result card or dice button to measure");
    else {
      if (width < 600) {
        if (Math.abs(geo.left - 16) > 1 || Math.abs(geo.right - (geo.vw - 16)) > 1)
          fail(`the result card is not full width minus 16px gutters on a phone (left ${Math.round(geo.left)}, right ${Math.round(geo.right)} of ${geo.vw})`);
      } else {
        if (geo.width > 361) fail(`the result card is ${Math.round(geo.width)}px wide at a wide width, over 360px`);
        if (Math.abs(geo.right - (geo.vw - 16)) > 1) fail("the result card is not at the bottom-right at a wide width");
      }
      if (geo.bottom > geo.buttonTop + 1) fail(`the result card overlaps the floating button (card bottom ${Math.round(geo.bottom)}, button top ${Math.round(geo.buttonTop)})`);
    }
    // Tapping the card opens the tray on the Log segment, newest first.
    await page.click('[data-testid="result-card-body"]');
    await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("tapping the result card did not open the tray"));
    const headings = await page.evaluate(() => [...document.querySelectorAll('[data-testid="log-entry-heading"]')].map((el) => el.textContent));
    if (headings.length < 2) fail(`the Roll Log shows ${headings.length} entries, expected 2: ${JSON.stringify(headings)}`);
    else if (headings[0] !== "Kara · Longsword attack" || headings[1] !== "Dice tray")
      fail(`the Roll Log is not newest first with character and source: ${JSON.stringify(headings)}`);
    await page.screenshot({ path: shot("log") });
    await page.keyboard.press("Escape");
    await page.waitForSelector(dialogSel, { state: "hidden", timeout: 10000 }).catch(() => fail("Escape did not close the tray"));
  }

  // A reload empties the log: it is session app state, never stored.
  await page.goto(`${BASE}/character/${CHARACTER_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByLabel("Dice tray").first().click();
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("the tray did not reopen after the reload"));
  await page.getByText("Log", { exact: true }).first().click();
  await page.waitForTimeout(300);
  if (!(await page.getByText("No rolls yet.", { exact: true }).first().isVisible().catch(() => false)))
    fail("after a reload the Roll Log is not empty");
  await page.screenshot({ path: shot("log-empty") });
  await page.close();

  // On phones the button sits above the flow's bottom primary-action bar, never covering it.
  if (width < 600) {
    const flowPage = await ctx.newPage();
    await flowPage.goto(`${BASE}/build/${EDIT_BUILD_ID}?step=class&mode=levelup`, { waitUntil: "networkidle", timeout: 120000 });
    await flowPage.waitForTimeout(1500);
    await flowPage.getByText(/total level/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the Level-Up Flow did not load"));
    const geo = await flowPage.evaluate(() => {
      const bar = document.querySelector('[data-testid="build-bottom-bar"]');
      const button = document.querySelector('[data-testid="dice-button"]');
      if (!bar || !button) return null;
      const barRect = bar.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      return { barTop: barRect.top, buttonBottom: buttonRect.bottom, buttonVisible: buttonRect.height > 0 && buttonRect.width > 0 };
    });
    if (!geo) fail("no bottom bar or dice button found in the Level-Up Flow");
    else {
      if (!geo.buttonVisible) fail("the dice button is not visible in the Level-Up Flow");
      if (geo.buttonBottom > geo.barTop + 1)
        fail(`the dice button covers the flow's bottom bar (button bottom ${Math.round(geo.buttonBottom)} over bar top ${Math.round(geo.barTop)})`);
    }
    await flowPage.screenshot({ path: join(SHOTS, `DiceTray-flow-${width}.png`) });
    await flowPage.close();
  }
  return failures;
}

// The Actions tab's roll badges at one width: a weapon attack's "to hit" badge rolls a d20 with the
// ledger's bonus and offers "Roll damage" on the result card; the damage badge rolls the ledger's pool;
// the keyboard path (context-menu key on the focused badge) opens the roll sheet, and Advantage shows two
// d20s with the dropped one struck through; a forced natural 20 offers "Roll critical damage" with doubled
// dice and the modifier once; a spell attack row rolls its profile's bonus; flat or unparseable damage shows
// plain; tapping a row still opens its details; and every roll leaves the stored character (slots, uses,
// ammunition) unchanged.
async function checkActionRolls(ctx, width) {
  const page = await ctx.newPage();
  const prefix = `[${width}px actions rolls]`;
  let failures = 0;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
  };
  const shot = (name) => join(SHOTS, `ActionRolls-${name}-${width}.png`);
  const dialogSel = '[role="dialog"]';
  const cardSel = '[data-testid="result-card"]';
  const badgeText = (locator) => locator.textContent().then((t) => (t ?? "").replace(/[\uE000-\uF8FF]/g, "").trim());
  const readCard = () =>
    page.evaluate(() => {
      const card = document.querySelector('[data-testid="result-card"]');
      if (!card) return null;
      const chips = [...card.querySelectorAll('[data-testid="die-chip"]')].map((chip) => ({
        text: (chip.textContent ?? "").replace(/\s+/g, ""),
        struck: [...chip.querySelectorAll("*")].some((el) => getComputedStyle(el).textDecorationLine.includes("line-through")),
      }));
      const leaf = (re) => [...card.querySelectorAll("*")].find((e) => e.children.length === 0 && re.test((e.textContent ?? "").trim()))?.textContent.trim() ?? null;
      return {
        chips,
        modifier: card.querySelector('[data-testid="result-modifier"]')?.textContent ?? "",
        total: card.querySelector('[data-testid="result-total"]')?.textContent ?? "",
        source: card.querySelector('[data-testid="result-source"]')?.textContent ?? "",
        markers: ["Natural 20", "Natural 1", "Critical"].filter((m) => leaf(new RegExp(`^${m}$`))),
        followUp: leaf(/^Roll (critical )?damage$/),
      };
    });
  const storedCharacter = (id) =>
    page.evaluate((charId) => JSON.parse(localStorage.getItem("@dnd5e_characters") ?? "[]").find((c) => c.id === charId) ?? null, id);
  const setFaces = (faces) => page.evaluate((f) => (window.__setRandomSource ? window.__setRandomSource(f) : "no hook"), faces);

  // The weapon attack row: badges read from the ledger, a tap rolls the attack.
  await page.goto(`${BASE}/character/${ACTIONS_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText("Actions", { exact: true }).first().click();
  await page.getByText(/equipped weapon attacks/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the Actions tab did not show EQUIPPED WEAPON ATTACKS"));
  const toHit = page.locator('[data-testid="roll-badge-attack-0-tohit"]');
  const damageBadge = page.locator('[data-testid="roll-badge-attack-0-damage"]');
  if (!(await toHit.isVisible().catch(() => false))) fail('no "to hit" roll badge on the weapon row');
  else if ((await badgeText(toHit)) !== "+5 to hit") fail(`the "to hit" badge reads "${await badgeText(toHit)}", expected "+5 to hit"`);
  if (!(await damageBadge.isVisible().catch(() => false))) fail("no damage roll badge on the weapon row");
  else if ((await badgeText(damageBadge)) !== "1d8 + 3 slashing") fail(`the damage badge reads "${await badgeText(damageBadge)}", expected "1d8 + 3 slashing"`);
  const before = await storedCharacter(ACTIONS_ID);
  if (!before) fail("the seeded character is not in storage");
  for (const v of await page.evaluate(findLayoutViolations, null)) fail(v);
  await page.screenshot({ path: shot("tab") });

  // Tap the "to hit" badge: a d20 +5, fixed to 15, so total 20, with "Roll damage" on the card and no details modal.
  if ((await setFaces([15])) === "no hook") fail("the test-only random-source hook (window.__setRandomSource) is not exposed on a seeded web build");
  await toHit.click();
  await page.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("no result card after tapping the to-hit badge"));
  if ((await page.locator(dialogSel).count()) > 0) fail("tapping the badge opened the row's details modal");
  let card = await readCard();
  if (!card) fail("the result card disappeared before it could be read");
  else {
    if (card.source !== "Kara · Longsword attack") fail(`the attack card's source is "${card.source}", expected "Kara · Longsword attack"`);
    if (card.chips.length !== 1 || card.chips[0].text !== "15d20" || card.chips[0].struck) fail(`the attack card's faces are ${JSON.stringify(card.chips)}, expected one unstruck 15d20`);
    if (card.modifier !== "+5") fail(`the attack card's modifier is "${card.modifier}", expected "+5"`);
    if (card.total !== "20") fail(`the attack card's total is "${card.total}", expected "20"`);
    if (card.followUp !== "Roll damage") fail(`the attack card's follow-up is "${card.followUp}", expected "Roll damage"`);
  }
  await page.screenshot({ path: shot("attack") });

  // The follow-up rolls the damage pool 1d8 + 3 (fixed face clamps to 8 on the d8).
  await page.getByText("Roll damage", { exact: true }).first().click();
  await page.waitForFunction(() => document.querySelector('[data-testid="result-source"]')?.textContent?.includes("damage"), null, { timeout: 10000 }).catch(() => fail("the damage follow-up did not replace the card"));
  card = await readCard();
  if (!card) fail("the damage card disappeared before it could be read");
  else {
    if (card.source !== "Kara · Longsword damage") fail(`the damage card's source is "${card.source}", expected "Kara · Longsword damage"`);
    if (card.chips.length !== 1 || card.chips[0].text !== "8d8") fail(`the damage card's faces are ${JSON.stringify(card.chips)}, expected one 8d8`);
    if (card.modifier !== "+3" || card.total !== "11") fail(`the damage card reads ${card.modifier} / ${card.total}, expected +3 / 11`);
    if (card.followUp !== null) fail(`the damage card offers a follow-up "${card.followUp}", expected none`);
  }

  // The keyboard path to the roll sheet: context-menu key on the focused badge, then Advantage with fixed faces 17 and 9.
  await setFaces([17, 9]);
  await toHit.focus();
  // The badge subscribes its key listener when React processes the focus event.
  await page.waitForTimeout(200);
  await page.keyboard.press("ContextMenu");
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("the context-menu key on the focused badge did not open the roll sheet"));
  for (const label of ["Disadvantage", "Roll", "Advantage"]) {
    if (!(await page.getByText(label, { exact: true }).first().isVisible().catch(() => false))) fail(`the roll sheet does not show "${label}"`);
  }
  await page.screenshot({ path: shot("sheet") });
  await page.getByText("Advantage", { exact: true }).first().click();
  await page.waitForSelector(dialogSel, { state: "hidden", timeout: 10000 }).catch(() => fail("the roll sheet did not close after choosing Advantage"));
  await page.waitForFunction(() => document.querySelector('[data-testid="result-card"] [data-testid="die-chip"]') !== null, null, { timeout: 10000 }).catch(() => fail("no result card after the sheet's Advantage"));
  card = await readCard();
  if (!card) fail("the advantage card disappeared before it could be read");
  else {
    if (card.chips.length !== 2 || card.chips.some((c) => !c.text.endsWith("d20"))) fail(`advantage shows ${JSON.stringify(card.chips)}, expected two d20s`);
    else if (card.chips.filter((c) => c.struck).length !== 1) fail(`advantage shows ${JSON.stringify(card.chips)}, expected exactly one struck through`);
    else if (card.chips.map((c) => Number(/(\d+)d20/.exec(c.text)?.[1])).join(",") !== "17,9") fail(`advantage faces are ${JSON.stringify(card.chips)}, expected 17 and 9`);
    if (card.total !== "22") fail(`the advantage total is "${card.total}", expected "22" (17 + 5)`);
    if (card.modifier !== "+5") fail(`the advantage card's modifier is "${card.modifier}", expected "+5"`);
  }
  await page.screenshot({ path: shot("advantage") });

  // A forced natural 20: the card offers "Roll critical damage" and rolls doubled dice, modifier once.
  await setFaces([20]);
  await toHit.click();
  await page.waitForFunction(() => /Roll critical damage/.test(document.querySelector('[data-testid="result-card"]')?.textContent ?? ""), null, { timeout: 10000 }).catch(() => fail("a natural 20 did not offer \"Roll critical damage\""));
  card = await readCard();
  if (card) {
    if (!card.markers.includes("Natural 20")) fail(`the natural-20 card's markers are ${JSON.stringify(card.markers)}`);
    if (card.followUp !== "Roll critical damage") fail(`the natural-20 card's follow-up is "${card.followUp}", expected "Roll critical damage"`);
  }
  await page.getByText("Roll critical damage", { exact: true }).first().click();
  await page.waitForFunction(() => document.querySelector('[data-testid="result-source"]')?.textContent?.includes("damage"), null, { timeout: 10000 }).catch(() => fail("the critical damage follow-up did not roll"));
  card = await readCard();
  if (!card) fail("the critical damage card disappeared before it could be read");
  else {
    if (card.source !== "Kara · Longsword damage") fail(`the critical card's source is "${card.source}"`);
    if (card.chips.length !== 2 || card.chips.some((c) => c.text !== "8d8")) fail(`critical damage shows ${JSON.stringify(card.chips)}, expected two doubled 8d8 (faces clamp to 8)`);
    if (card.modifier !== "+3" || card.total !== "19") fail(`critical damage reads ${card.modifier} / ${card.total}, expected +3 / 19 (the modifier once)`);
    if (!card.markers.includes("Critical")) fail(`the critical card's markers are ${JSON.stringify(card.markers)}, expected Critical`);
  }
  await page.screenshot({ path: shot("critical") });
  await setFaces(null);

  // Tapping the row (not the badge) still opens its details.
  await page.getByText("Longsword", { exact: true }).first().click();
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("tapping the weapon row did not open its details modal"));
  await page.keyboard.press("Escape");
  await page.waitForSelector(dialogSel, { state: "hidden", timeout: 10000 }).catch(() => fail("Escape did not close the details modal"));

  // Nothing was spent: the stored character is unchanged by every roll.
  const after = await storedCharacter(ACTIONS_ID);
  if (!after) fail("the seeded character vanished from storage");
  else if (JSON.stringify(after) !== JSON.stringify(before)) fail("the rolls changed the stored character (slots, uses or ammunition)");

  // A spell attack row rolls its casting profile's bonus; its non-pool damage label stays plain.
  await page.goto(`${BASE}/character/${WIZARD_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText("Actions", { exact: true }).first().click();
  await page.getByText(/spell attacks/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the Actions tab did not show SPELL ATTACKS"));
  const spellToHit = page.locator('[data-testid="roll-badge-spell-0-tohit"]');
  if (!(await spellToHit.isVisible().catch(() => false))) fail("the Fire Bolt row has no to-hit roll badge");
  else if ((await badgeText(spellToHit)) !== "+5 to hit") fail(`the spell badge reads "${await badgeText(spellToHit)}", expected "+5 to hit"`);
  if ((await page.locator('[data-testid="roll-badge-spell-0-damage"]').count()) > 0) fail('the "Cantrip scaling" damage shows a roll badge');
  const plainDamage = await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "Cantrip scaling");
    return el ? el.closest('[data-testid^="roll-badge"]') === null : false;
  });
  if (!plainDamage) fail('"Cantrip scaling" is inside a roll badge, expected plain text');
  await setFaces([11]);
  await spellToHit.click();
  await page.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("no result card after tapping the spell badge"));
  card = await readCard();
  if (!card) fail("the spell card disappeared before it could be read");
  else {
    if (card.source !== "Elowen · Fire Bolt attack") fail(`the spell card's source is "${card.source}", expected "Elowen · Fire Bolt attack"`);
    if (card.chips.length !== 1 || card.chips[0].text !== "11d20") fail(`the spell card's faces are ${JSON.stringify(card.chips)}, expected one 11d20`);
    if (card.modifier !== "+5" || card.total !== "16") fail(`the spell card reads ${card.modifier} / ${card.total}, expected +5 / 16`);
    if (card.followUp !== null) fail(`the spell card offers a follow-up "${card.followUp}", expected none (no damage pool)`);
  }
  await setFaces(null);

  // The unarmed fallback row: the to-hit badge rolls, the flat damage shows plain.
  await page.goto(`${BASE}/character/${CHARACTER_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText("Actions", { exact: true }).first().click();
  await page.getByText(/attack action/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the Actions tab did not load for the unarmed fallback"));
  const unarmedToHit = page.locator('[data-testid="roll-badge-unarmed-tohit"]');
  if (!(await unarmedToHit.isVisible().catch(() => false))) fail("the unarmed fallback row has no to-hit roll badge");
  else if ((await badgeText(unarmedToHit)) !== "+3 to hit") fail(`the unarmed badge reads "${await badgeText(unarmedToHit)}", expected "+3 to hit"`);
  if ((await page.locator('[data-testid="roll-badge-unarmed-damage"]').count()) > 0) fail("the flat unarmed damage shows a roll badge");
  await setFaces([7]);
  await unarmedToHit.click();
  await page.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("no result card after tapping the unarmed badge"));
  card = await readCard();
  if (!card) fail("the unarmed card disappeared before it could be read");
  else {
    if (card.source !== "Rendar · Unarmed Strike attack") fail(`the unarmed card's source is "${card.source}", expected "Rendar · Unarmed Strike attack"`);
    if (card.modifier !== "+3" || card.total !== "10") fail(`the unarmed card reads ${card.modifier} / ${card.total}, expected +3 / 10`);
    if (card.followUp !== null) fail(`the unarmed card offers a follow-up "${card.followUp}", expected none (flat damage)`);
  }
  await setFaces(null);
  await page.close();
  return failures;
}

// The checks that open their own page rather than a SCREENS entry. Each is a scenario, so ONLY selects it by name.
const EXTRA_CHECKS = [
  { name: "HP modals", run: checkHitPointModals },
  { name: "Wild Shape Stats", run: checkWildShapeScreen },
  { name: "Wild Shape Features", run: checkWildShapeFeatures },
  { name: "Modal closing", run: checkModalClosing },
  { name: "New character draft folder", run: checkDraftFolder },
  { name: "Dice tray and Roll Log", run: checkDiceTrayAndLog },
  { name: "Actions rolls", run: checkActionRolls },
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
