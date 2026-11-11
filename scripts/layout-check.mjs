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
// Usage: `npm run layout:check` (not part of check:all). The script starts its own server on the port in
// BASE: by default the Expo web dev server, and with `--prod` a static server over a fresh
// `expo export -p web` of the production bundle (the export goes to a folder named after the port). With
// `--prod` the run exits 2 when something already answers on BASE. `npm run layout:check -- --integrated`
// (or LAYOUT_INTEGRATED=1) seeds the integrated catalog instead of the SRD Baseline and runs at 320 unless
// WIDTHS is set. The first run needs `npx playwright install chromium` once.
//
// Fails (one line per violation) on squeezed text and on elements that stick out of a non-scrolling
// parent. Env: BASE (default http://localhost:8099), WIDTHS (default "320,393,768,1280": compact, phone, tablet
// and desktop, one width per layout; `-- --integrated` narrows it to 320 unless WIDTHS is set), MAX_PARALLEL
// (how many widths run at once, default 1: each width holds its own browser context, and the four default
// widths at once peak about 2 GB higher than one at a time), ONLY (a comma-separated list of substrings: only the scenarios whose name
// contains one of them, ignoring case, are visited in every width; unset visits all), SHOTS_ONLY
// (comma-separated substrings, like ONLY; "all" writes every screenshot; unset writes a screenshot only for
// a failed scenario or check, or one marked shot: true), SHOTS (screenshot dir, default a layout-check folder
// under the OS temp dir), DSF (deviceScaleFactor of the contexts, default 1), EXPORT_DIR (the `--prod`
// export folder, default one per port under the OS temp dir).
// Exit:
// 0 green, 1 violations, 2 no browser or no server (the server log path is printed then), `--prod` with a
// server already on BASE, or an ONLY term that matches no scenario (the scenario names are printed then).
// `--list` prints the shared scenario list (the SCREENS names) as JSON and exits without starting anything.
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { chromium } from "playwright";
import {
  httpStatus,
  seedBrowser,
  signalExpoGroup,
  spawnExpoExport,
  spawnExpoWeb,
  spawnStaticServer,
  stopExpoWeb,
  waitForExpoWeb,
} from "./lib/app-driver.mjs";
import { buildScreens, buildSeed, ACTIONS_ID, CHARACTER_ID, DRAFT_ID, DRUID_ID, EDIT_BUILD_ID, LOW_CON_ID, MAX_LEVEL_ID, RANGER_ID, SORCERER_SWAP_ID, WIZARD_ID } from "./lib/scenarios.mjs";
import { applyWideOverride } from "./lib/scenario-override.mjs";
import { playStep, playSteps } from "./lib/web-steps.mjs";
import { ACCENT_PALETTES, BASE_DARK_THEME } from "../src/constants/theme.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE ?? "http://localhost:8099";
const PORT = new URL(BASE).port || "8099";
const SHOTS = process.env.SHOTS ?? join(tmpdir(), "layout-check");
const INTEGRATED = process.argv.includes("--integrated") || process.env.LAYOUT_INTEGRATED === "1";
// `--prod` exports the production web bundle once and serves it statically (see startServer); by
// default the script starts the `expo start --web` dev server.
const DEV = !process.argv.includes("--prod");
// The integrated run exists to catch long names and extra options, and those overflow at the narrowest
// width, so it runs at 320 only unless WIDTHS is set explicitly.
// Empty entries (a trailing comma) and non-numbers are dropped; a WIDTHS that names no width fails the run.
const WIDTHS_RAW = process.env.WIDTHS ?? (INTEGRATED ? "320" : "320,393,768,1280");
const WIDTHS = WIDTHS_RAW.split(",").map((entry) => entry.trim()).filter(Boolean).map(Number).filter((width) => Number.isFinite(width) && width > 0);
if (WIDTHS.length === 0) throw new Error(`WIDTHS="${WIDTHS_RAW}" names no width (for example WIDTHS=393,768)`);
// The width the run-once checks below use (the die-count cap, the result-card auto-dismiss): always the
// narrowest width of this run, so dropping a default width never drops the branch with it.
const SINGLE_RUN_WIDTH = Math.min(...WIDTHS);
// Lowercase substrings from ONLY. Empty when ONLY is unset or blank, which visits every scenario.
const ONLY = (process.env.ONLY ?? "").split(",").map((term) => term.trim().toLowerCase()).filter(Boolean);
// Lowercase substrings from SHOTS_ONLY ("all" writes every screenshot). Unset by default: a scenario or
// extra check then writes its screenshot only when it fails or when it is marked shot: true.
const SHOTS_ONLY = (process.env.SHOTS_ONLY ?? "").split(",").map((term) => term.trim().toLowerCase()).filter(Boolean);
const SHOTS_ALL = SHOTS_ONLY.includes("all");
// The deviceScaleFactor of the browser contexts (DSF env). 1 by default: a full run at 1 gives the
// same results as at 2 (GREEN, no violations), a little faster and with less memory.
const DSF = Number(process.env.DSF ?? 1);
// How many widths run at the same time (MAX_PARALLEL env). Each width holds its own browser context, and
// Chromium's memory grows with the contexts open at once: all four default widths together peaked at about
// 12 GB used, one at a time at about 10.8 GB (the machine held about 6.6 GB before the run).
const MAX_PARALLEL = Number(process.env.MAX_PARALLEL ?? 1);
if (!Number.isInteger(MAX_PARALLEL) || MAX_PARALLEL < 1) throw new Error(`MAX_PARALLEL="${process.env.MAX_PARALLEL}" must be a whole number of at least 1`);

// Whether the scenario or check `meta` ({ name, shot }) writes its screenshots this run when it does not
// fail: SHOTS_ALL, a SHOTS_ONLY substring match, or its own shot: true mark.
function shotWanted(meta) {
  return SHOTS_ALL || meta.shot === true || SHOTS_ONLY.some((term) => meta.name.toLowerCase().includes(term));
}

// Writes the screenshot at `file` when the scenario or check `meta` is selected (see shotWanted).
async function maybeShot(page, file, meta) {
  if (shotWanted(meta)) await page.screenshot({ path: file });
}

// A check's FAILED screenshot, written once at its first violation: failures always write a shot, even
// when SHOTS_ONLY does not select the check. The write is tracked per page, so closePage and gotoApp
// wait for it before they close or navigate the page, and checkWidth waits for every one before the
// context closes. A screenshot that cannot be taken is logged, not thrown.
const failureShotByPage = new WeakMap();
const failureShotsPending = new Set();
function shotFailed(page, meta, width) {
  const shot = page
    .screenshot({ path: join(SHOTS, `${meta.name.replace(/\W+/g, "-")}-FAILED-${width}.png`) })
    .then(
      () => {},
      (error) => console.log(`[${width}px] no failure screenshot for ${meta.name}: ${error.message.split("\n")[0]}`),
    );
  failureShotByPage.set(page, shot);
  failureShotsPending.add(shot);
  shot.finally(() => failureShotsPending.delete(shot));
  return shot;
}

// Resolves once the failure screenshot of `page`, if one was started, has been written or has failed.
async function failureShotDone(page) {
  await failureShotByPage.get(page);
}

// Closes `page` after its failure screenshot, if any, has been written.
async function closePage(page) {
  await failureShotDone(page);
  await page.close();
}


// Runs in the browser (handed to page.evaluate as one object): resolves once the web fonts are ready,
// the element `probeSel` exists, and its layout signature — its rect and scroll size, the document's
// scroll size and element count — is unchanged across two animation frames, or after `maxMs` at the
// latest, so a screen with a continuous animation cannot stall the run.
function settleProbe({ probeSel, maxMs }) {
  return (async () => {
    try {
      await document.fonts.ready;
    } catch {
      // Fonts that never finish loading must not stall the run.
    }
    const deadline = performance.now() + maxMs;
    let prev = null;
    let frames = 0;
    await new Promise((done) => {
      const tick = () => {
        const el = document.querySelector(probeSel);
        if (el) {
          const r = el.getBoundingClientRect();
          // The visible text joins the signature, so a text change (a label that swaps, a result that
          // arrives) keeps the page unsettled even when no box moved.
          const text = document.body ? document.body.innerText : "";
          let hash = 0;
          for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
          const now = [
            r.left, r.top, r.width, r.height, el.scrollWidth, el.scrollHeight,
            document.documentElement.scrollWidth, document.documentElement.scrollHeight,
            document.querySelectorAll("*").length, text.length, hash,
          ].join(",");
          if (prev !== null && now === prev) return done();
          prev = now;
        }
        if (performance.now() >= deadline || ++frames > 600) return done();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  })();
}

// Waits until the page has settled (see settleProbe). `probe` is a CSS selector that must exist and hold
// a stable layout, defaulting to the body. A failed read is logged once per run: the check goes on with
// an unsettled page rather than stopping, but the cause stays visible.
let settleErrorLogged = false;
async function settle(page, probe, maxMs = 4000) {
  await page.evaluate(settleProbe, { probeSel: probe ?? "body", maxMs }).catch((error) => {
    if (settleErrorLogged) return;
    settleErrorLogged = true;
    console.log(`settle: the page could not be measured (${error.message.split("\n")[0]}); later checks read an unsettled page`);
  });
}

// Samples `shown` (an async check that resolves true while the item is on the page) every 100ms for `ms`.
// Resolves true when the item never appeared in the window, false the first time it did: an absence
// holds across a quiet window, not on a single read.
async function assertAbsentFor(shown, ms = 400) {
  const end = Date.now() + ms;
  for (;;) {
    if (await shown()) return false;
    if (Date.now() >= end) return true;
    await new Promise((done) => setTimeout(done, 100));
  }
}

// Waits for an open modal's shell — the dialog wrapper mounts a beat after the modal content — and then
// for the page to settle on the dialog.
async function settleDialog(page) {
  await page.waitForSelector('[role="dialog"] [data-testid="modal-sheet"]', { state: "attached", timeout: 10000 }).catch(() => {});
  await settle(page, '[role="dialog"]');
}

// Navigates to `url` and waits until the app is interactive: the load event, then the root layout's
// mount effect — on an E2E web build it exposes the test-only publishing hook, so the hook's presence
// proves React hydrated and the press handlers are attached — then ready fonts and an unchanged layout
// across two animation frames. This replaces networkidle plus a fixed sleep.
async function gotoApp(page, url) {
  await failureShotDone(page);
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page
    .waitForFunction(() => typeof window.__publishRoll === "function", null, { timeout: 30000, polling: 100 })
    .catch(() => {
      throw new Error(`the server at ${BASE} was not built with EXPO_PUBLIC_E2E (stale server?): window.__publishRoll never appeared on ${url}`);
    });
  await settle(page);
}
const SERVER_WAIT_MS = 180_000;

// The server this script started (the Expo web dev server or the static server) and the `expo export` child of
// --prod. Each runs in its own process group, so one signal stops it and its children.
let server = null;
let exporter = null;

function signalChildGroups(signal) {
  if (exporter) signalExpoGroup(exporter, signal);
  if (server) signalExpoGroup(server, signal);
}

async function stopServer() {
  if (exporter) {
    await stopExpoWeb(exporter);
    exporter = null;
  }
  if (!server) return;
  await stopExpoWeb(server);
  server = null;
}

// Starts the server this run checks against, on PORT. By default it is the Expo web dev server (see
// spawnExpoWeb); `--prod` exports the production web bundle once (`npx expo export -p web`,
// EXPO_PUBLIC_E2E=1 so the test hooks are in the bundle) into a folder named after the port, so runs on
// different ports never share one, and serves it with scripts/lib/static-server.mjs. Resolves "up",
// "exited" or "timeout" (see waitForExpoWeb).
async function startServer(logPath) {
  if (DEV) {
    server = spawnExpoWeb({ root: ROOT, port: PORT, logPath });
    return waitForExpoWeb(server, BASE, SERVER_WAIT_MS);
  }
  const outDir = process.env.EXPORT_DIR ?? join(tmpdir(), `layout-check-web-export-${PORT}`);
  const exportedAt = Date.now();
  exporter = spawnExpoExport({ root: ROOT, outDir, logPath });
  const code = await exporter.done;
  exporter = null;
  if (code !== 0) {
    console.error(`expo export failed (exit ${code}). Server log: ${logPath}`);
    return "exited";
  }
  console.log(`Exported the production web bundle to ${outDir} in ${Math.round((Date.now() - exportedAt) / 1000)}s.`);
  server = spawnStaticServer({ dir: outDir, port: PORT, logPath });
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

// Runs in the browser. No <button> or [role="button"] may contain another one: React logs "cannot contain
// a nested <button>" for it and the inner control is not reliably tappable. `scopeSelector` is a CSS selector
// to search inside, or null/"" for the whole document. Returns one message per offending outer button.
function findNestedButtonViolations(scopeSelector) {
  const root = scopeSelector ? document.querySelector(scopeSelector) : document;
  const out = [];
  if (!root) return out;
  for (const b of root.querySelectorAll('button, [role="button"]')) {
    const inner = b.querySelectorAll('button, [role="button"]');
    if (inner.length > 0) {
      const name = b.getAttribute("aria-label") || (b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30);
      out.push(`the button "${name}" contains ${inner.length} nested button(s)`);
    }
  }
  return [...new Set(out)];
}

// Runs in the browser. Checks the header of a character sheet for a long name. At phone widths the name
// cannot fit its row, so it must be clipped and end with an ellipsis; at wide widths a long name can
// legitimately fit, so only an unclipped overflow is a violation there. The race/class line under the name
// must show whole — class level included — at every width, and neither may stick out of the screen or
// overflow its row. Returns one message per violation.
function findHeaderNameViolations({ name, width }) {
  const leaves = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 0);
  const nameEl = leaves.find((e) => e.textContent.trim() === name);
  if (!nameEl) return [`header name "${name.slice(0, 40)}" is not on the screen`];
  const badgeText = leaves.filter((e) => /^(Lvl \d+|\d+\/\d+.*)$/.test(e.textContent.trim()) && e.getBoundingClientRect().top < 80);
  const out = [];
  const nr = nameEl.getBoundingClientRect();
  const cs = getComputedStyle(nameEl);
  if (cs.textOverflow !== "ellipsis" || cs.overflow !== "hidden") out.push(`header name has no ellipsis (text-overflow: ${cs.textOverflow}, overflow: ${cs.overflow})`);
  if (width < 768 && nameEl.scrollWidth <= nameEl.clientWidth)
    out.push(`header name is not clipped at ${width}px (${nameEl.scrollWidth}px of text in ${nameEl.clientWidth}px)`);
  // The name either fits its row or is clipped with an ellipsis inside it; at wide widths a long name can
  // legitimately fit, so clipping is required only when the text would overflow the row it sits in.
  const rowRight = (nameEl.parentElement ?? nameEl).getBoundingClientRect().right;
  if (nameEl.scrollWidth > nameEl.clientWidth && nr.right > rowRight + 1)
    out.push(`header name overflows its row unclipped (text ${nameEl.scrollWidth}px in ${nameEl.clientWidth}px, right edge ${Math.round(nr.right)} over row right ${Math.round(rowRight)})`);
  if (nr.right > window.innerWidth + 1) out.push(`header name sticks out of the screen by ${Math.round(nr.right - window.innerWidth)}px`);
  for (const badge of badgeText) {
    const br = (badge.parentElement ?? badge).getBoundingClientRect();
    if (nr.right > br.left + 1 && nr.left < br.right - 1) out.push(`header name overlaps the badge "${badge.textContent.trim().slice(0, 20)}" by ${Math.round(nr.right - br.left)}px`);
  }
  // The race/class line under the name: fully visible (no truncation), ending in the class level.
  const header = document.querySelector('[data-testid="sheet-header"]');
  const sub = header ? leaves.filter((e) => header.contains(e)).find((e) => e.textContent.includes("•")) : null;
  if (!sub) out.push("the header's race/class line is not on the screen");
  else {
    const sr = sub.getBoundingClientRect();
    if (sub.scrollWidth > sub.clientWidth + 1)
      out.push(`the header race/class line is truncated (${sub.scrollWidth}px of text in ${sub.clientWidth}px): "${sub.textContent.trim()}"`);
    if (!/• [^•]*\d+( • [^•]+)?$/.test(sub.textContent.trim()))
      out.push(`the header race/class line lost the class level: "${sub.textContent.trim()}"`);
    if (sr.right > window.innerWidth + 1) out.push(`the header race/class line sticks out of the screen by ${Math.round(sr.right - window.innerWidth)}px`);
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
async function checkWildShapeBox(page, index, prefix, shot, meta, width) {
  if (index < 0) {
    console.log(`${prefix} no "Change wild shape hit points" control found`);
    return 1;
  }
  let failures = 0;
  let failedShotTaken = false;
  const shotFailedOnce = () => {
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  await page.locator('[aria-label="Change wild shape hit points"]').nth(index).click();
  await page.getByText("Set to", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
  await settle(page);
  await maybeShot(page, join(SHOTS, shot), meta);
  const modal = await page.evaluateHandle(findHpModal);
  if (!modal.asElement()) {
    failures++;
    shotFailedOnce();
    console.log(`${prefix} modal not found`);
  } else {
    const text = await page.evaluate((el) => el.textContent || "", modal);
    if (!text.includes("Wild Shape HP")) {
      failures++;
      shotFailedOnce();
      console.log(`${prefix} modal is not the wild shape box`);
    }
    if (!text.includes("+4 Temp")) {
      failures++;
      shotFailedOnce();
      console.log(`${prefix} modal does not show the form's "+4 Temp" line`);
    }
    for (const v of await page.evaluate(findLayoutViolations, modal)) {
      failures++;
      shotFailedOnce();
      console.log(`${prefix} ${v}`);
    }
  }
  await closeModalViaShell(page);
  await page.getByText("Set to", { exact: true }).first().waitFor({ state: "hidden", timeout: 10000 });
  await settle(page);
  return failures;
}

// Opens the Druid's Stats tab and checks the Active Wild Shape box and the header badge that opens the same box.
async function checkWildShapeScreen(ctx, width, meta) {
  const page = await ctx.newPage();
  await gotoApp(page, `${BASE}/character/${DRUID_ID}`);
  await page.getByText("Stats", { exact: true }).first().click();
  await settle(page);
  await page.getByText("WILD SHAPE HP", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && (e.textContent || "").includes("WILD SHAPE HP"));
    el?.scrollIntoView({ block: "center" });
  });
  await settle(page);
  await maybeShot(page, join(SHOTS, `WildShape-Stats-${width}.png`), meta);
  let failures = 0;
  let failedShotTaken = false;
  const shotFailedOnce = () => {
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  for (const v of await page.evaluate(findLayoutViolations, null)) {
    failures++;
    shotFailedOnce();
    console.log(`[${width}px wild shape Stats] ${v}`);
  }
  failures += await checkWildShapeTempLine(page, `[${width}px wild shape Stats]`);
  const controls = await page.evaluate(findWildShapeControls);
  failures += await checkWildShapeBox(page, controls.stats, `[${width}px wild shape box from Stats number]`, `WildShapeModal-${width}.png`, meta, width);
  failures += await checkWildShapeBox(page, controls.header, `[${width}px wild shape box from header badge]`, `WildShapeModal-header-${width}.png`, meta, width);
  await closePage(page);
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
async function checkWildShapeFeatures(ctx, width, meta) {
  const page = await ctx.newPage();
  await gotoApp(page, `${BASE}/character/${DRUID_ID}`);
  await page.getByText("Features", { exact: true }).first().click();
  await settle(page);
  await page.getByText("WILD SHAPE HP", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && (e.textContent || "").includes("WILD SHAPE HP"));
    el?.scrollIntoView({ block: "center" });
  });
  await settle(page);
  await maybeShot(page, join(SHOTS, `WildShape-Features-${width}.png`), meta);
  let failures = await checkWildShapeTempLine(page, `[${width}px wild shape Features]`);
  let failedShotTaken = false;
  const shotFailedOnce = () => {
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  const card = await page.evaluateHandle(findWildShapeCard);
  if (!card.asElement()) {
    failures++;
    shotFailedOnce();
    console.log(`[${width}px wild shape Features] no Active Wild Shape card found`);
  } else {
    for (const v of await page.evaluate(findLayoutViolations, card)) {
      failures++;
      shotFailedOnce();
      console.log(`[${width}px wild shape Features card] ${v}`);
    }
  }
  await closePage(page);
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

// Whether the first element the locator matches is visible, skipping matches inside the flow's identity
// side column. At 1024px and up that column repeats the character's abilities, subrace and background, so a
// step's own absence checks must not read its subtree; every other check (overflow, squeeze, fitsWidth,
// texts) still covers the column.
async function firstVisibleOutsideIdentitySide(locator) {
  for (const handle of await locator.elementHandles()) {
    const insideSide = await handle.evaluate((el) => document.querySelector('[data-testid="flow-identity-side"]')?.contains(el) ?? false);
    if (insideSide) continue;
    return await handle.isVisible();
  }
  return false;
}

// Runs in the browser. Whether the sheet's left rail (testID sheet-tab-rail) holds a visible button
// (a <button> or [role="button"]) with the given aria-label.
function findRailButton(label) {
  const rail = document.querySelector('[data-testid="sheet-tab-rail"]');
  if (!rail) return false;
  return [...rail.querySelectorAll("button, [role=\"button\"]")].some(
    (b) => b.getAttribute("aria-label") === label && b.getBoundingClientRect().height > 0,
  );
}

// Checks what a picker screen must show that the layout rules cannot see: texts, input placeholders and
// accessibility labels on the page (`labels` present, `absentLabels` gone), buttons inside the sheet's
// left rail (`railLabels`), and (`plainRaceRow`) the plain race row. Returns one message per missing control.
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
  // Present controls are waited for as conditions (the screen can render them a beat after its ready
  // text); absent ones are read once, after the settle.
  for (const text of expect.texts ?? []) {
    if (!(await page.getByText(text, { exact: true }).first().waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false)))
      out.push(`missing "${text}"`);
  }
  for (const placeholder of expect.placeholders ?? []) {
    if (!(await page.getByPlaceholder(placeholder).first().waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false)))
      out.push(`missing the input with placeholder "${placeholder}"`);
  }
  // Every absent item is sampled over the same quiet window, the windows running side by side.
  const absentChecks = [
    ...(expect.absent ?? []).map((text) => ({
      shown: () => firstVisibleOutsideIdentitySide(page.getByText(text, { exact: true })),
      message: `"${text}" is shown but should not be`,
    })),
    ...(expect.absentMatching ?? []).map((pattern) => ({
      shown: () => firstVisibleOutsideIdentitySide(page.getByText(pattern)),
      message: `text matching ${pattern} is shown but should not be`,
    })),
    ...(expect.absentLabels ?? []).map((label) => ({
      shown: async () => (await page.getByLabel(label).count()) > 0,
      message: `the control labelled "${label}" is present but should not be`,
    })),
  ];
  const absentResults = await Promise.all(absentChecks.map((check) => assertAbsentFor(check.shown)));
  absentChecks.forEach((check, i) => {
    if (!absentResults[i]) out.push(check.message);
  });
  for (const label of expect.labels ?? []) {
    if (!(await page.getByLabel(label).first().waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false)))
      out.push(`missing the control labelled "${label}"`);
  }
  for (const label of expect.railLabels ?? []) {
    if (!(await page.evaluate(findRailButton, label))) out.push(`the sheet tab rail has no visible button labelled "${label}"`);
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
  const shotFile = join(SHOTS, `${screen.name.replace(/\W+/g, "-")}-${width}.png`);
  const ready = screen.modal ?? screen.ready;
  const readyLocator = typeof ready === "string" ? page.getByText(ready, { exact: true }) : page.getByText(ready);
  try {
    if (screen.modal || screen.fresh || state.route !== screen.route) {
      await gotoApp(page, `${BASE}${screen.route}`);
    }
    for (const tab of screen.tabs ?? []) {
      await page.getByText(tab, { exact: true }).first().click();
      await settle(page);
    }
    if (screen.open) await playSteps(page, screen.open);
    await readyLocator.first().waitFor({ state: "visible", timeout: 10000 });
  } catch {
    console.log(`${prefix} did not show ${typeof ready === "string" ? `"${ready}"` : ready} in time`);
    await page.screenshot({ path: shotFile }).catch(() => {});
    state.route = null;
    return 1;
  }
  if (screen.scrollTo) {
    await page.evaluate((needle) => {
      const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && (e.textContent || "").includes(needle));
      el?.scrollIntoView({ block: "center" });
    }, screen.scrollTo);
  }
  // A modal's dialog wrapper mounts a beat after its content, so wait for it before settling on it.
  if (screen.modal) await page.waitForSelector('[role="dialog"]', { state: "attached", timeout: 10000 }).catch(() => {});
  await settle(page, screen.modal ? '[role="dialog"]' : "body");
  state.route = screen.modal ? null : screen.route;
  let violations;
  if (screen.modal) {
    const root = await page.evaluateHandle(findDialog, screen.modal);
    if (!root.asElement()) {
      console.log(`${prefix} modal "${screen.modal}" not found`);
      await page.screenshot({ path: shotFile }).catch(() => {});
      return 1;
    }
    violations = await page.evaluate(findLayoutViolations, root);
    violations = [...violations, ...(await checkModalShape(page, width))];
  } else {
    violations = await page.evaluate(findLayoutViolations, null);
  }
  violations = [...violations, ...(await checkNoShrinkRows(page, screen))];
  // The DOM nested-button check runs on every visited screen, so it covers the React dev-mode console
  // error on its own when the run serves the production bundle (--prod), which does not log it.
  violations = [...violations, ...(await page.evaluate(findNestedButtonViolations, ""))];
  if (screen.headerName) violations = [...violations, ...(await page.evaluate(findHeaderNameViolations, { name: screen.headerName, width }))];
  if (screen.expect) violations = [...violations, ...(await checkExpected(page, screen.expect))];
  for (const v of violations) console.log(`${prefix} ${v}`);
  // The scenario's screenshot is written only when it failed or SHOTS_ONLY / shot: true selects it.
  if (violations.length > 0 || shotWanted(screen)) await page.screenshot({ path: shotFile });
  return violations.length;
}

// Visits the screens in SCREENS that ONLY selects, on one width's context.
async function checkScreens(ctx, width) {
  const page = await ctx.newPage();
  const state = { route: null };
  let failures = 0;
  for (const screen of SCREENS) if (selected(screen.name)) failures += await visitScreen(page, width, applyWideOverride(screen, width), state);
  await closePage(page);
  return failures;
}

// Opens the Stats tab of the Rendar and checks the hit point modal from the Stats HP number and from the header badge.
async function checkHitPointModals(ctx, width, meta) {
  const page = await ctx.newPage();
  await gotoApp(page, `${BASE}/character/${CHARACTER_ID}`);
  await page.getByText("Stats", { exact: true }).first().click();
  await settle(page);
  let failures = 0;
  let failedShotTaken = false;
  const shotFailedOnce = () => {
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  const controls = await page.evaluate(findHpControls);
  const entries = [
    ["Stats number", controls.stats, `HpModal-${width}.png`],
    ["header badge", controls.header, `HpModal-header-${width}.png`],
  ];
  for (const [entry, index, shot] of entries) {
    const prefix = `[${width}px HP modal from ${entry}]`;
    if (index < 0) {
      failures++;
      shotFailedOnce();
      console.log(`${prefix} no "Change hit points" control found`);
      continue;
    }
    await page.locator('[aria-label="Change hit points"]').nth(index).click();
    await page.getByText("Set to", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
    await settle(page);
    await maybeShot(page, join(SHOTS, shot), meta);
    const modal = await page.evaluateHandle(findHpModal);
    if (!modal.asElement()) {
      failures++;
      shotFailedOnce();
      console.log(`${prefix} modal not found`);
    } else {
      for (const v of await page.evaluate(findLayoutViolations, modal)) {
        failures++;
        shotFailedOnce();
        console.log(`${prefix} ${v}`);
      }
    }
    await closeModalViaShell(page);
    await page.getByText("Set to", { exact: true }).first().waitFor({ state: "hidden", timeout: 10000 });
    await settle(page);
  }
  await closePage(page);
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
async function checkDraftFolder(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px draft folder]`;
  let failures = 0;
  let failedShotTaken = false;
  const shotFailedOnce = () => {
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  await gotoApp(page, `${BASE}/`);
  await page.getByText(/5e Character Builder/).first().waitFor({ state: "visible", timeout: 10000 });
  // The folder list renders after the header: wait for the "Camp" folder itself before reading its badge.
  await page.getByText("Camp", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  const before = await page.evaluate(folderBadgeCount, "Camp");
  if (before === null) {
    console.log(`${prefix} the home list shows no "Camp" folder`);
    failures++;
    shotFailedOnce();
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
    shotFailedOnce();
  }
  await gotoApp(page, `${BASE}/`);
  await page.getByText(/5e Character Builder/).first().waitFor({ state: "visible", timeout: 10000 });
  await page.getByText("Camp", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  await settle(page);
  await maybeShot(page, join(SHOTS, `DraftFolder-${width}.png`), meta);
  const after = await page.evaluate(folderBadgeCount, "Camp");
  if (before !== null && after !== before) {
    console.log(`${prefix} the "Camp" folder lists ${after} character(s) after "New character", expected ${before}: the draft landed in a folder instead of the root`);
    failures++;
    shotFailedOnce();
  }
  if (!(await page.getByText("Draft · Class", { exact: true }).first().isVisible())) {
    console.log(`${prefix} the new draft card "Draft · Class" is not listed on Home`);
    failures++;
    shotFailedOnce();
  }
  await closePage(page);
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
async function checkModalClosing(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px modal closing]`;
  const phone = width < 600;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
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
  await gotoApp(page, `${BASE}/character/${CHARACTER_ID}`);
  await page.getByText("Stats", { exact: true }).first().click();
  await settle(page);
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
      // The dialog wrapper and its role mount a beat after the modal content, so wait for the shell first.
      await settleDialog(page);
      for (const v of await checkModalShape(page, width)) fail(v);
      await maybeShot(page, shot("open"), meta);
    }
    await close();
    if (!(await waitDialog("Rest & Recovery", false))) fail(`${how} did not close the Rest modal`);
    if (how === "backdrop") await maybeShot(page, shot("backdrop-closed"), meta);
  }
  await closeRestIfOpen();

  // The Create New Folder modal with a typed name asks before closing, on backdrop tap and on Escape.
  await gotoApp(page, `${BASE}/`);
  await playStep(page, { tap: { name: "home-header-folder" } });
  if (!(await waitDialog("Create New Folder", true))) fail("the Create New Folder modal did not open");
  await page.getByPlaceholder("e.g. Curse of Strahd, One-Shots").fill("Unsaved Test Folder");
  if (!(await tapBackdrop(page))) fail("could not tap the backdrop of the edited folder modal");
  await settleDialog(page);
  await maybeShot(page, shot("confirm"), meta);
  if (!(await dialogShown("Discard changes?"))) fail("tapping the backdrop of an edited modal did not ask \"Discard changes?\"");
  if (!(await dialogShown("Create New Folder"))) fail("the edited modal closed on backdrop tap instead of asking first");
  if (await tapButton("Keep editing")) {
    if (await dialogShown("Discard changes?")) fail("\"Keep editing\" did not dismiss the confirmation");
    if (!(await dialogShown("Create New Folder"))) fail("\"Keep editing\" closed the modal");
  }
  await page.keyboard.press("Escape");
  await settleDialog(page);
  if (!(await dialogShown("Discard changes?"))) fail("Escape on an edited modal did not ask \"Discard changes?\"");
  if (await tapButton("Discard")) {
    if (!(await waitDialog("Create New Folder", false))) fail("\"Discard\" did not close the edited modal");
  }

  // On a phone the handle labelled "Close" asks first too, on a modal holding unsaved input, and so does
  // a swipe down from the top of the sheet's content.
  if (phone) {
    await gotoApp(page, `${BASE}/`);
    await playStep(page, { tap: { name: "home-header-folder" } });
    if (!(await waitDialog("Create New Folder", true))) fail("the Create New Folder modal did not reopen for the handle tap");
    await page.getByPlaceholder("e.g. Curse of Strahd, One-Shots").fill("Unsaved Test Folder");
    if ((await handleLocator.count()) === 0) fail('the phone sheet has no handle labelled "Close"');
    else {
      await handleLocator.click({ timeout: 5000 }).catch(() => fail('could not tap the "Close" handle'));
      await settleDialog(page);
      if (!(await dialogShown("Discard changes?"))) fail('tapping the "Close" handle of an edited modal did not ask "Discard changes?"');
      if (!(await dialogShown("Create New Folder"))) fail("the edited modal closed on handle tap instead of asking first");
      await tapButton("Keep editing");
    }
    if (await swipeSheetDown(page)) {
      await settleDialog(page);
      if (!(await dialogShown("Discard changes?"))) fail('swiping the sheet down on an edited modal did not ask "Discard changes?"');
      if (!(await dialogShown("Create New Folder"))) fail("the edited modal closed on swipe down instead of asking first");
      await tapButton("Discard");
    } else fail("could not swipe the sheet down on the edited modal");
  }

  // The same modal with nothing typed closes on Escape without asking.
  await gotoApp(page, `${BASE}/`);
  await playStep(page, { tap: { name: "home-header-folder" } });
  if (!(await waitDialog("Create New Folder", true))) fail("the Create New Folder modal did not reopen");
  await page.keyboard.press("Escape");
  if (!(await waitDialog("Create New Folder", false))) fail("Escape did not close the untouched folder modal");
  if (await dialogShown("Discard changes?")) fail("the untouched modal was asked \"Discard changes?\"");

  // A sheet that was scrolled must still close on a swipe down after it is reopened: the body's at-top
  // state resets when the modal opens, so the reopened sheet's drag handler can claim the gesture.
  if (phone) {
    await gotoApp(page, `${BASE}/character/${WIZARD_ID}`);
    await page.getByText("Spells", { exact: true }).first().click();
    await settle(page);
    await page.getByText(/add spells/i).first().click({ timeout: 5000 }).catch(() => fail("could not open the Add Spells modal"));
    const sheetSel = '[role="dialog"] [data-testid="modal-sheet"]';
    if (!(await page.waitForSelector(sheetSel, { state: "visible", timeout: 10000 }).then(() => true).catch(() => false)))
      fail("the Add Spells modal did not open");
    // Scroll the sheet's body down, so its at-top state is false when the modal closes. The wait is a
    // condition, not a sleep: the dispatch counts as observed only once no scroll event has fired for
    // 150ms (react-native-web throttles scroll handling past 100ms), so the sheet's at-top update has
    // been processed before the close — a late update would land after the reopen's reset and the
    // swipe could not claim the gesture.
    const scrolled = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const sheet = document.querySelector('[data-testid="modal-sheet"]');
          const el = [...(sheet?.querySelectorAll("*") ?? [])].find((n) => n.clientHeight > 0 && n.scrollHeight > n.clientHeight + 4);
          if (!el) return resolve(false);
          let last = performance.now();
          const onScroll = () => {
            last = performance.now();
          };
          document.addEventListener("scroll", onScroll, true);
          el.scrollTop = 240;
          el.dispatchEvent(new Event("scroll"));
          const tick = () => {
            if (performance.now() - last >= 150) {
              document.removeEventListener("scroll", onScroll, true);
              resolve(true);
            } else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    if (!scrolled) fail("the open Add Spells sheet had no scrollable body to scroll down");
    await page.keyboard.press("Escape");
    if (!(await page.waitForSelector(sheetSel, { state: "hidden", timeout: 10000 }).then(() => true).catch(() => false)))
      fail("Escape did not close the scrolled Add Spells modal");
    // Reopen and swipe the sheet down from its top: the reset must let the swipe close it.
    await page.getByText(/add spells/i).first().click({ timeout: 5000 }).catch(() => fail("could not reopen the Add Spells modal"));
    if (!(await page.waitForSelector(sheetSel, { state: "visible", timeout: 10000 }).then(() => true).catch(() => false)))
      fail("the Add Spells modal did not reopen");
    await settleDialog(page);
    if (await swipeSheetDown(page)) {
      if (!(await page.waitForSelector(sheetSel, { state: "hidden", timeout: 10000 }).then(() => true).catch(() => false)))
        fail("a swipe down did not close the reopened sheet that had been scrolled before closing");
    } else fail("could not swipe the reopened sheet down");
  }

  await closePage(page);
  return failures;
}

// Runs in the browser. The rects of the floating dice button and of the flow footer's controls — the wide
// footer (testID flow-wide-footer) holds the identity line (flow-identity-line) and the primary action
// (flow-primary-action); at 1024px and up the identity side column replaces the footer's identity line.
function findDiceButtonVsFlowFooter() {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };
  return {
    button: rect(document.querySelector('[data-testid="dice-button"]')),
    footer: rect(document.querySelector('[data-testid="flow-wide-footer"]')),
    primary: rect(document.querySelector('[data-testid="flow-primary-action"]')),
    identity: rect(document.querySelector('[data-testid="flow-identity-line"]')),
  };
}

// The floating dice button, the tray's pool roll and the session Roll Log at one width: the button opens
// the tray on the sheet; the tray builds a pool (die buttons add, chips remove, the modifier steps, the
// Disadvantage / Normal / Advantage choice only for a lone d20, the primary action labelled with the pool
// and disabled while the pool is empty), rolls it and the result card shows above the button with the
// right total; a Roll seeded through the publishing seam reads "Kara · Longsword attack" and sits above
// the "Dice tray" entry, newest first, when the card is tapped; a reload empties the log; on phones the
// button sits above the flow's bottom primary-action bar, never covering it.
async function checkDiceTrayAndLog(ctx, width, meta) {
  const page = await ctx.newPage();
  // The result-card auto-dismiss below is a setTimeout: the clock lets the check fast-forward past the
  // 8s instead of sleeping through it (real time still flows while installed, so every other wait on
  // this page behaves as usual).
  await page.clock.install();
  const prefix = `[${width}px dice tray]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  const shot = (name) => join(SHOTS, `DiceTray-${name}-${width}.png`);
  const dialogSel = '[role="dialog"]';
  const cardSel = '[data-testid="result-card"]';

  await gotoApp(page, `${BASE}/character/${CHARACTER_ID}`);
  const diceButton = page.getByLabel("Dice tray").first();
  if (!(await diceButton.isVisible())) fail("the floating dice button is not visible on the sheet");
  await diceButton.click();
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("the tray did not open from the floating button"));
  for (const v of await checkModalShape(page, width)) fail(v);
  await maybeShot(page, shot("tray"), meta);

  // 48dp touch targets: the Dice/Log segments, the mode segments and the removable pool chips.
  const segHeights = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const pick = (text) => {
      const el = [...dialog.querySelectorAll('[role="button"],button')].find((e) => e.textContent.trim() === text && e.getBoundingClientRect().height > 0);
      return el ? el.getBoundingClientRect().height : null;
    };
    return { dice: pick("Dice"), log: pick("Log") };
  });
  if (!segHeights) fail("no tray dialog to measure the segment targets");
  else {
    if (segHeights.dice === null || segHeights.dice < 47.5) fail(`the "Dice" segment target is ${segHeights.dice}px tall, under 48dp`);
    if (segHeights.log === null || segHeights.log < 47.5) fail(`the "Log" segment target is ${segHeights.log}px tall, under 48dp`);
  }

  // A die's count is capped at 100: tapping one die 100 times disables its add button, and rolling the
  // capped pool works instead of throwing "Not a dice pool".
  if (width === SINGLE_RUN_WIDTH) {
    const addD20 = page.getByLabel("Add d20", { exact: true });
    for (let i = 0; i < 100; i++) await addD20.click({ timeout: 5000 }).catch(() => fail(`the "Add d20" tap ${i + 1} failed`));
    const atCap = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[aria-label="Add d20"]')].find((e) => e.getBoundingClientRect().height > 0);
      return el ? el.disabled === true || el.getAttribute("aria-disabled") === "true" : null;
    });
    if (atCap !== true) fail(`"Add d20" is not disabled at 100 dice (state ${atCap})`);
    if (!(await page.getByLabel("Remove 100d20", { exact: true }).isVisible().catch(() => false))) fail('the pool chip does not read "100d20" at the cap');
    await page.getByText("Roll 100d20", { exact: true }).first().click();
    await page.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("rolling the capped 100d20 pool did not show a result card (it threw)"));
    await page.getByLabel("Dice tray").first().click();
    await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("the tray did not reopen after the capped roll"));
    await page.getByLabel("Remove 100d20", { exact: true }).click();
  }

  // The pool builder: the primary action is disabled while the pool is empty, and the d20 mode choice
  // appears only for a pool of exactly one d20.
  const emptyRoll = await page.evaluate(buttonDisabled, "Roll");
  if (emptyRoll.disabled !== true) fail(`"Roll" is not disabled while the pool is empty (${emptyRoll.state})`);
  if (!(await assertAbsentFor(async () => (await page.getByText("Advantage", { exact: true }).count()) > 0))) fail('"Advantage" shows for an empty pool');
  await page.getByLabel("Add d20", { exact: true }).click();
  await settle(page);
  if (!(await page.getByText("Advantage", { exact: true }).first().isVisible())) fail('"Advantage" does not show for a lone d20');
  // The mode segments are 48dp targets too.
  const modeHeights = await page.evaluate(() =>
    ["Disadvantage", "Normal", "Advantage"].map((t) => {
      const el = [...document.querySelectorAll('[role="dialog"] [role="button"], [role="dialog"] button')].find((e) => e.textContent.trim() === t && e.getBoundingClientRect().height > 0);
      return el ? el.getBoundingClientRect().height : null;
    }),
  );
  for (const [i, h] of modeHeights.entries()) {
    if (h === null || h < 47.5) fail(`the "${["Disadvantage", "Normal", "Advantage"][i]}" mode segment is ${h}px tall, under 48dp`);
  }
  await page.getByLabel("Remove 1d20", { exact: true }).click();
  await page.getByLabel("Add d6", { exact: true }).click();
  // The removable pool chip is a 48dp target.
  const chipHeight = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[aria-label="Remove 1d6"]')].find((e) => e.getBoundingClientRect().height > 0);
    return el ? el.getBoundingClientRect().height : null;
  });
  if (chipHeight === null || chipHeight < 47.5) fail(`the pool chip "1d6" is ${chipHeight}px tall, under 48dp`);
  await page.getByLabel("Add d8", { exact: true }).click();
  for (let i = 0; i < 3; i++) await page.getByLabel("Modifier increase", { exact: true }).click();
  await settle(page);
  if (!(await assertAbsentFor(async () => (await page.getByText("Advantage", { exact: true }).count()) > 0))) fail('"Advantage" shows for a pool that is not a lone d20');
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

  // A tray pool of 2d20 is not a d20 test: even with a kept 20 it shows no "Natural 20" marker; a
  // lone-d20 tray roll does.
  const setFaces = (faces) => page.evaluate((f) => (window.__setRandomSource ? window.__setRandomSource(f) : "no hook"), faces);
  const cardMarkers = () =>
    page.evaluate(() => {
      const card = document.querySelector('[data-testid="result-card"]');
      if (!card) return null;
      return [...card.querySelectorAll("*")].filter((e) => e.children.length === 0 && /^(Natural 20|Natural 1|Critical)$/.test(e.textContent.trim())).map((e) => e.textContent.trim());
    });
  await page.getByLabel("Dice tray").first().click();
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("the tray did not reopen for the 2d20 check"));
  await page.getByLabel("Remove 1d6", { exact: true }).click();
  await page.getByLabel("Remove 1d8", { exact: true }).click();
  for (let i = 0; i < 3; i++) await page.getByLabel("Modifier decrease", { exact: true }).click();
  await page.getByLabel("Add d20", { exact: true }).click();
  await page.getByLabel("Add d20", { exact: true }).click();
  await setFaces([20, 7]);
  await page.getByText("Roll 2d20", { exact: true }).first().click();
  await page.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("no result card after the 2d20 tray roll"));
  let markers = await cardMarkers();
  if (markers === null) fail("the 2d20 card disappeared before its markers could be read");
  else if (markers.length !== 0) fail(`a 2d20 tray pool shows the markers ${JSON.stringify(markers)}, expected none (not a d20 test)`);
  await page.getByLabel("Dice tray").first().click();
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("the tray did not reopen for the lone-d20 check"));
  await page.getByLabel("Remove 2d20", { exact: true }).click();
  await page.getByLabel("Add d20", { exact: true }).click();
  await setFaces([20]);
  await page.getByText("Roll 1d20", { exact: true }).first().click();
  await page.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("no result card after the lone-d20 tray roll"));
  markers = await cardMarkers();
  if (markers === null) fail("the lone-d20 card disappeared before its markers could be read");
  else if (JSON.stringify(markers) !== JSON.stringify(["Natural 20"])) fail(`a lone-d20 tray roll shows ${JSON.stringify(markers)}, expected ["Natural 20"]`);
  await setFaces(null);

  // Seed a "Kara · Longsword attack" Roll through the publishing seam (no screen triggers it yet): the
  // card is replaced by it. The mount time is recorded for the auto-dismiss check below (the installed
  // clock also flows in real time, so only the remaining gap to the 8s mark is fast-forwarded).
  // The mount time is read on the page clock in the same evaluate that seeds the card, so every later
  // reading is on the clock the auto-dismiss timer runs on. Null when the hook is missing.
  const cardMountedAt = await page.evaluate(() => {
    const hook = window.__publishRoll;
    if (typeof hook !== "function") return null;
    const at = Date.now();
    hook({
      roll: { dice: [{ sides: 20, face: 15, dropped: false }], modifier: 5, total: 20 },
      source: "Longsword attack",
      characterName: "Kara",
    });
    return at;
  });
  if (cardMountedAt === null) fail("the test-only publishing hook (window.__publishRoll) is not exposed on a seeded web build");
  else {
    await page
      .waitForFunction(() => document.querySelector('[data-testid="result-source"]')?.textContent?.includes("Kara"), null, { timeout: 10000, polling: 100 })
      .catch(() => fail('the result card was not replaced by the seeded "Kara · Longsword attack" entry'));
    await maybeShot(page, shot("result"), meta);
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
    // The announcement is web's always-mounted live region, whose text carries the roll's heading
    // and total. The card itself is never a live region: it mounts already populated after a
    // dismissal, which screen readers do not reliably announce.
    const region = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="dice-announce-region"]');
      return el ? { live: el.getAttribute("aria-live"), text: (el.textContent ?? "").trim() } : null;
    });
    if (!region) fail("the always-mounted announce live region is missing on web");
    else {
      if (region.live !== "polite") fail(`the announce region's aria-live is ${region.live}, expected "polite"`);
      if (!region.text.includes("Kara") || !region.text.includes("total 20"))
        fail(`the announce region's text is "${region.text}", expected the roll's heading and total`);
    }
    const cardLive = await page.evaluate(() => document.querySelector('[data-testid="result-card"]')?.getAttribute("aria-live") ?? null);
    if (cardLive !== null) fail(`the result card itself is a live region (aria-live ${cardLive}); the announce region is the only one on web`);
    if (!(await page.getByLabel("Kara · Longsword attack, total 20", { exact: true }).first().isVisible().catch(() => false)))
      fail('the result card body is not accessible-labelled "Kara · Longsword attack, total 20"');
    // Tapping the card opens the tray on the Log segment, newest first.
    await page.click('[data-testid="result-card-body"]');
    await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("tapping the result card did not open the tray"));
    const headings = await page.evaluate(() => [...document.querySelectorAll('[data-testid="log-entry-heading"]')].map((el) => el.textContent));
    if (headings.length < 2) fail(`the Roll Log shows ${headings.length} entries, expected 2: ${JSON.stringify(headings)}`);
    else if (headings[0] !== "Kara · Longsword attack" || headings[1] !== "Dice tray")
      fail(`the Roll Log is not newest first with character and source: ${JSON.stringify(headings)}`);
    await maybeShot(page, shot("log"), meta);
    await page.keyboard.press("Escape");
    await page.waitForSelector(dialogSel, { state: "hidden", timeout: 10000 }).catch(() => fail("Escape did not close the tray"));
    // A card without a follow-up still auto-dismisses after about 8s — and the announce region
    // stays mounted afterwards, so the next Roll changes its text instead of mounting a populated one.
    if (width === SINGLE_RUN_WIDTH) {
      // The auto-dismiss timer runs from the card's mount on the page clock. Real time keeps flowing while
      // the clock is installed, so each forward covers only the gap from the page's current reading to the
      // target: the card must be shown at 7000ms after its mount and gone at 8600ms after it.
      const elapsedNow = async () => (await page.evaluate(() => Date.now())) - cardMountedAt;
      const elapsed = await elapsedNow();
      if (elapsed > 7000) {
        fail(`the result card's first check starts ${elapsed}ms after its mount, past the 7000ms mark: the page took too long to reach it`);
      } else {
        if (elapsed < 7000) await page.clock.fastForward(7000 - elapsed);
        if ((await page.locator(cardSel).count()) === 0) fail("the result card auto-dismissed before 7000ms of page time");
        const gap = 8600 - (await elapsedNow());
        if (gap > 0) await page.clock.fastForward(gap);
        const gone = await assertAbsentFor(async () => (await page.locator(cardSel).count()) > 0);
        if (!gone) fail("the result card without a follow-up did not auto-dismiss by 8600ms after its mount");
      }
      const regionAfter = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="dice-announce-region"]');
        return el ? { live: el.getAttribute("aria-live"), text: (el.textContent ?? "").trim() } : null;
      });
      if (!regionAfter) fail("after the card auto-dismissed the announce live region unmounted; it must stay mounted");
      else if (regionAfter.live !== "polite" || regionAfter.text !== "")
        fail(`after the auto-dismiss the announce region reads aria-live ${regionAfter.live} text "${regionAfter.text}", expected "polite" with cleared text`);
    }
  }

  // A reload empties the log: it is session app state, never stored.
  await gotoApp(page, `${BASE}/character/${CHARACTER_ID}`);
  await page.getByLabel("Dice tray").first().click();
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("the tray did not reopen after the reload"));
  await page.getByText("Log", { exact: true }).first().click();
  await settle(page);
  if (!(await page.getByText("No rolls yet.", { exact: true }).first().isVisible().catch(() => false)))
    fail("after a reload the Roll Log is not empty");
  await maybeShot(page, shot("log-empty"), meta);
  await closePage(page);

  // The padding follows the flow's own layout, whose wide breakpoint is FLOW_WIDE_MIN_WIDTH (768) in
  // src/components/creationFlow/FlowShell.tsx: below it the flow shows its bottom primary-action bar and
  // the button sits above that bar, never covering it, while the step scroll content pads its bottom by
  // the button's 56dp plus its 16dp gap so the button never covers the last rows; at 768px and up the flow
  // is wide and adds no extra bottom padding.
  {
    const flowPage = await ctx.newPage();
    await gotoApp(flowPage, `${BASE}/levelup/${EDIT_BUILD_ID}`);
    await flowPage.getByText(/Fighter/).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the Level-Up Flow did not load"));
    if (width < 768) {
      const geo = await flowPage.evaluate(() => {
        const bar = document.querySelector('[data-testid="levelup-bottom-bar"]');
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
    }
    const scrollPad = await flowPage.evaluate(() => {
      const scroller = document.querySelector('[data-testid="levelup-step-scroll"]');
      if (!scroller) return null;
      let max = 0;
      for (const el of [scroller, ...scroller.querySelectorAll("*")]) {
        const p = parseFloat(getComputedStyle(el).paddingBottom) || 0;
        if (p > max) max = p;
      }
      return max;
    });
    if (scrollPad === null) fail("no step scroll content found in the Level-Up Flow");
    else if (width < 768 && scrollPad < 71)
      fail(`the flow's step scroll content pads its bottom by ${Math.round(scrollPad)}px, under the 72dp the floating dice button needs (56dp button + 16dp gap)`);
    else if (width >= 768 && scrollPad >= 71)
      fail(`at ${width}px (wide flow layout) the flow's step scroll content still pads its bottom by ${Math.round(scrollPad)}px for a corner button`);
    await maybeShot(flowPage, join(SHOTS, `DiceTray-flow-${width}.png`), meta);
    await closePage(flowPage);
  }

  // At 768px and up the flow shows its wide footer in the middle column while the floating dice button stays
  // in the viewport's bottom-right corner, so the footer must reserve the button's footprint: the button's
  // rect may intersect neither the footer's primary action nor its identity line — in the Creation Flow and
  // in the Level-Up Flow alike. (Below 768 the bar check above already keeps the button off the bar.)
  if (width >= 768) {
    const flows = [
      ["Creation Flow", `/build/${DRAFT_ID}?step=background`, "Create Custom"],
      ["Level-Up Flow", `/levelup/${EDIT_BUILD_ID}`, /Fighter/],
    ];
    for (const [flowName, route, ready] of flows) {
      const flowPage = await ctx.newPage();
      await gotoApp(flowPage, `${BASE}${route}`);
      const readyLocator = typeof ready === "string" ? flowPage.getByText(ready, { exact: true }) : flowPage.getByText(ready);
      if (!(await readyLocator.first().waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false))) {
        fail(`${flowName} did not load (${route})`);
      } else {
        const geo = await flowPage.evaluate(findDiceButtonVsFlowFooter);
        if (!geo.button) fail(`no floating dice button in the ${flowName}`);
        else {
          for (const [what, rect] of [["primary action", geo.primary], ["identity line", geo.identity]]) {
            if (!rect) continue;
            const overX = Math.min(geo.button.right, rect.right) - Math.max(geo.button.left, rect.left);
            const overY = Math.min(geo.button.bottom, rect.bottom) - Math.max(geo.button.top, rect.top);
            if (overX > 1 && overY > 1)
              fail(
                `the dice button covers the ${flowName}'s footer ${what} by ${Math.round(overX)}x${Math.round(overY)}px ` +
                  `(button ${Math.round(geo.button.left)},${Math.round(geo.button.top)}-${Math.round(geo.button.right)},${Math.round(geo.button.bottom)} ` +
                  `over ${what} ${Math.round(rect.left)},${Math.round(rect.top)}-${Math.round(rect.right)},${Math.round(rect.bottom)})`,
              );
          }
        }
        await maybeShot(flowPage, join(SHOTS, `DiceTray-flow-footer-${flowName.replace(/\W+/g, "-")}-${width}.png`), meta);
      }
      await closePage(flowPage);
    }
  }
  return failures;
}

// The seed of the current run, so a check can open an extra browser context (e.g. with reduced motion
// emulated) seeded the same way as the width contexts.
let ACTIVE_SEED = null;

// "#rrggbb" as the CSS rgb() string getComputedStyle returns.
function hexToRgbString(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// Starts an in-page sampler that records the first 3D die's computed pose on every animation frame.
// Run before the roll so the samples cover the tumble itself; the sampler runs until 3s after the die
// first appeared (at most 15s) — the die mounts a beat after the card, once its lazy chunk loads.
function startDieSampling(p) {
  return p.evaluate(() => {
    window.__dieT0 = performance.now();
    window.__dieMountT = null;
    window.__dieSamples = [];
    const tick = () => {
      const now = performance.now() - window.__dieT0;
      const die = document.querySelector('[data-testid="die-3d-0"]');
      if (die) {
        if (window.__dieMountT === null) window.__dieMountT = now;
        window.__dieSamples.push({ t: now, pose: getComputedStyle(die).transform });
      }
      const limit = window.__dieMountT === null ? 15000 : window.__dieMountT + 3000;
      if (now < limit) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// Resolves once the sampler's clock passes `untilT` (the settle budget, 3s after the roll): { samples }.
function readDieSamples(p, untilT) {
  return p.evaluate(
    (until) =>
      new Promise((resolve) => {
        const done = () => {
          if (performance.now() - window.__dieT0 >= until) resolve({ samples: window.__dieSamples });
          else setTimeout(done, 50);
        };
        done();
      }),
    untilT,
  );
}

// The 2.5D dice of a Roll in the result card: with the 3D dice setting on (no saved value, no reduced
// motion) the text total is shown while the dice are still tumbling and lands on the Roll's faces in
// the accent colour, a dropped d20 included but muted; with the setting switched off in Options (and
// kept off across a reload), or with reduced motion emulated and no setting saved, no dice mount and
// the text appears at once; the Options switch shows the effective state.
async function checkDiceAnimation(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px dice animation]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  const shot = (name) => join(SHOTS, `DiceAnimation-${name}-${width}.png`);
  const dialogSel = '[role="dialog"]';
  const cardSel = '[data-testid="result-card"]';
  const diceSel = '[data-testid^="die-3d-"]';
  const accentHex = ACCENT_PALETTES.crimson.primary;
  const accentRgb = hexToRgbString(accentHex);
  const accentHoverRgb = hexToRgbString(ACCENT_PALETTES.crimson.secondary);
  const borderRgb = hexToRgbString(BASE_DARK_THEME.border);

  // The "3D dice" switch row's rendered border: the accent border when on, the plain border when off
  // (react-native-web does not map accessibilityState to aria-checked, so read the style).
  const switchBorder = async (p) =>
    p.evaluate(() => {
      const el = document.querySelector('[data-testid="dice-3d-switch"]');
      return el ? getComputedStyle(el).borderColor : null;
    });

  // The sampler's clock (ms since the sampler started) at the last tray roll: the settle budget counts from it.
  let rollAt = null;
  const rollTrayPool = async (p) => {
    await p.getByLabel("Dice tray").first().click();
    await p.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("the tray did not open"));
    await p.getByLabel("Add d6", { exact: true }).click();
    await p.getByLabel("Add d8", { exact: true }).click();
    for (let i = 0; i < 3; i++) await p.getByLabel("Modifier increase", { exact: true }).click();
    await settle(p);
    // Read just before the tap, so the roll itself falls after this reading and the budget never starts late.
    rollAt = await p.evaluate(() => performance.now() - window.__dieT0);
    await p.getByText("Roll 1d6 + 1d8 + 3", { exact: true }).first().click();
    await p.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("no result card after the tray roll"));
  };

  await gotoApp(page, `${BASE}/character/${CHARACTER_ID}`);

  // 3D dice on by default (no saved setting, no reduced motion): the total is there while the
  // dice still tumble, the faces shown match the Roll's chips, the dice carry the accent colour.
  // The pose sampler starts before the roll: under load the die can mount and finish tumbling before
  // a sampler started after the roll would begin.
  // The die's chunk compiles on its first use in the dev server, which takes seconds and would be charged
  // to the measured roll below. A roll in a warm-up page of this context loads it first.
  const warm = await ctx.newPage();
  await gotoApp(warm, `${BASE}/character/${CHARACTER_ID}`);
  await rollTrayPool(warm);
  await warm.waitForSelector('[data-testid="die-3d-0"]', { state: "visible", timeout: 10000 }).catch(() => fail("the warm-up roll mounted no animated die"));
  await closePage(warm);
  await startDieSampling(page);
  await rollTrayPool(page);
  const dieMounted = await page.waitForSelector('[data-testid="die-3d-0"]', { state: "visible", timeout: 10000 }).catch(() => null);
  if (!dieMounted) fail("with 3D dice on, no animated die mounted in the result card");
  else {
    const early = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="result-card"]');
      return { total: card?.querySelector('[data-testid="result-total"]')?.textContent ?? null };
    });
    // The pose samples, taken on every animation frame in the page, prove an animation ran from the
    // poses themselves, not from wall-clock frame timing: under load two samples 120ms apart can
    // land in the same frame. A die that never animates yields one constant pose and still fails.
    // The samples cover the 3s budget counted from the roll, not from the die's mount.
    const { samples } = await readDieSamples(page, rollAt + 3000);
    const timed = samples.filter((s) => s.t >= rollAt).map((s) => ({ t: s.t - rollAt, pose: s.pose }));    if (early.total === null) fail("the text total was not shown while the dice animation was still running");
    // A real tumble yields dozens of distinct poses; a die that never animates yields at most two
    // (its mount pose and its final one), so three distinct poses prove an animation ran. The poses must
    // also differ between two samples more than 100ms apart, so one frame's jitter cannot pass.
    const poses = [...new Set(timed.map((s) => s.pose))];
    const changesOverWindow = timed.some((a) => timed.some((b) => b.t - a.t > 100 && b.pose !== a.pose));
    if (timed.length === 0 || poses.length < 3 || !changesOverWindow)
      fail(`the die pose took only ${poses.length} distinct values across ${timed.length} sampled frames after the roll: no animation ran with 3D dice on`);
    // The tumble has ended once its last pose change happens: that change must come within 1.2s of the roll.
    let lastChangeT = null;
    for (let i = 1; i < timed.length; i++) if (timed[i].pose !== timed[i - 1].pose) lastChangeT = timed[i].t;
    if (lastChangeT !== null && lastChangeT > 1200) fail(`the dice were still animating more than 1.2s after the roll (last pose change at ${Math.round(lastChangeT)}ms)`);

    const faces = await page.evaluate((accent) => {
      const card = document.querySelector('[data-testid="result-card"]');
      if (!card) return null;
      const chips = [...card.querySelectorAll('[data-testid="die-chip"]')].map((c) => c.textContent ?? "");
      const dice = [...card.querySelectorAll('[data-testid^="die-3d-"]')].map((d) => d.getAttribute("aria-label") ?? "");
      const total = card.querySelector('[data-testid="result-total"]')?.textContent ?? "";
      const d6 = card.querySelector('[data-testid="die-3d-0"]');
      const d8 = card.querySelector('[data-testid="die-3d-1"]');
      const d6bg = d6?.firstElementChild ? getComputedStyle(d6.firstElementChild).backgroundColor : null;
      const d8fill = d8?.querySelector("svg polygon")?.getAttribute("fill") ?? null;
      return { chips, dice, total, d6bg, d8fill };
    }, accentHex);
    if (!faces) fail("the result card disappeared before its dice could be read");
    else {
      const chipFaces = faces.chips.map((chip) => Number(/(\d+)d\d+/.exec(chip)?.[1] ?? "NaN"));
      const shownFaces = faces.dice.map((label) => Number(/showing (\d+)/.exec(label)?.[1] ?? "NaN"));
      if (chipFaces.length !== 2 || shownFaces.length !== 2 || chipFaces.some(Number.isNaN) || shownFaces.some(Number.isNaN))
        fail(`the card does not show two chips and two animated dice: ${JSON.stringify(faces)}`);
      else if (chipFaces.join(",") !== shownFaces.join(","))
        fail(`the animated faces ${shownFaces.join(",")} do not match the Roll's chips ${chipFaces.join(",")}`);
      else if (Number(faces.total) !== chipFaces.reduce((sum, face) => sum + face, 0) + 3)
        fail(`the total ${faces.total} is not the faces plus +3`);
      if (faces.d6bg !== accentRgb) fail(`the d6 die is filled ${faces.d6bg}, expected the accent ${accentRgb}`);
      if (faces.d8fill !== accentHex) fail(`the d8 die's SVG face is filled ${faces.d8fill}, expected the accent ${accentHex}`);
    }
    await maybeShot(page, shot("animated"), meta);
  }

  // A dropped d20 of a seeded Roll animates too, but muted.
  const seeded = await page.evaluate(() => {
    const hook = window.__publishRoll;
    if (typeof hook !== "function") return false;
    hook({
      roll: { dice: [{ sides: 20, face: 17, dropped: false }, { sides: 20, face: 9, dropped: true }], modifier: 5, total: 22 },
      source: "Longsword attack",
      characterName: "Kara",
      d20Mode: "advantage",
    });
    return true;
  });
  if (!seeded) fail("the test-only publishing hook (window.__publishRoll) is not exposed on a seeded web build");
  else {
    await page.waitForSelector('[data-testid="die-3d-1"]', { state: "visible", timeout: 10000 }).catch(() => fail("the dropped d20 did not mount as an animated die"));
    const muted = await page.evaluate(() => {
      const dropped = document.querySelector('[data-testid="die-3d-1"]');
      if (!dropped) return null;
      return { label: dropped.getAttribute("aria-label") ?? "", opacity: getComputedStyle(dropped).opacity };
    });
    if (!muted) fail("no dropped die to read");
    else {
      if (!muted.label.includes("9") || !muted.label.toLowerCase().includes("dropped")) fail(`the dropped d20's label is "${muted.label}", expected its face 9 marked dropped`);
      if (Number(muted.opacity) >= 1) fail(`the dropped d20 is not muted (opacity ${muted.opacity})`);
    }
    await maybeShot(page, shot("dropped"), meta);
  }

  // The Options switch shows on with no saved value and no reduced motion, and toggling it off persists.
  await gotoApp(page, `${BASE}/options`);
  await settle(page);
  const diceSwitch = page.getByLabel("3D dice").first();
  if (!(await diceSwitch.isVisible().catch(() => false))) fail('the Options screen has no "3D dice" switch');
  else {
    if ((await switchBorder(page)) !== accentHoverRgb) fail(`the "3D dice" switch is not on by default (border ${await switchBorder(page)}, expected ${accentHoverRgb})`);
    await diceSwitch.click();
    await settle(page);
    if ((await switchBorder(page)) !== borderRgb) fail(`tapping the "3D dice" switch did not turn it off (border ${await switchBorder(page)}, expected ${borderRgb})`);
    await maybeShot(page, shot("options-off"), meta);
  }

  // With the setting off (and kept off across a reload) no animation runs, the text is at once.
  await gotoApp(page, `${BASE}/character/${CHARACTER_ID}`);
  await rollTrayPool(page);
  const offState = await page.evaluate(() => ({
    total: document.querySelector('[data-testid="result-total"]')?.textContent ?? null,
    dice: document.querySelectorAll('[data-testid^="die-3d-"]').length,
  }));
  if (offState.total === null) fail("with the setting off, the text total was not shown at once");
  if (offState.dice !== 0) fail(`with the setting off, ${offState.dice} animated dice mounted`);
  // Fixed wait on purpose: nothing observable can stand in for it — the check is that no die mounts
  // within this window after the roll, which only the passing of time can prove.
  await page.waitForTimeout(900);
  if (!(await assertAbsentFor(async () => (await page.locator(diceSel).count()) !== 0))) fail("with the setting off, animated dice mounted later");
  await maybeShot(page, shot("off"), meta);

  // Reduced motion emulated and no saved setting (a fresh context) — no animation either.
  const rctx = await ctx.browser().newContext({
    viewport: { width, height: 851 },
    deviceScaleFactor: DSF,
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  try {
    await rctx.addInitScript(seedBrowser, ACTIVE_SEED);
    const rpage = await rctx.newPage();
    await gotoApp(rpage, `${BASE}/character/${CHARACTER_ID}`);
    await rollTrayPool(rpage);
    const rmState = await rpage.evaluate(() => ({
      total: document.querySelector('[data-testid="result-total"]')?.textContent ?? null,
      dice: document.querySelectorAll('[data-testid^="die-3d-"]').length,
    }));
    if (rmState.total === null) fail("with reduced motion emulated and no saved setting, the text total was not shown at once");
    if (rmState.dice !== 0) fail(`with reduced motion emulated and no saved setting, ${rmState.dice} animated dice mounted`);
    // Fixed wait on purpose, same as above: only the passing of time proves no die mounts later.
    await rpage.waitForTimeout(900);
    if (!(await assertAbsentFor(async () => (await rpage.locator(diceSel).count()) !== 0))) fail("with reduced motion emulated, animated dice mounted later");
    await gotoApp(rpage, `${BASE}/options`);
    await settle(rpage);
    const rmSwitch = rpage.getByLabel("3D dice").first();
    if (!(await rmSwitch.isVisible().catch(() => false))) fail('the Options screen has no "3D dice" switch under reduced motion');
    else if ((await switchBorder(rpage)) !== borderRgb)
      fail(`with reduced motion emulated and no saved setting, the "3D dice" switch is on (border ${await switchBorder(rpage)}, expected ${borderRgb})`);
    await maybeShot(rpage, shot("reduced-motion"), meta);
    await closePage(rpage);
  } finally {
    await rctx.close();
  }

  await closePage(page);
  return failures;
}

// The Actions tab's roll badges at one width: a weapon attack's "to hit" badge rolls a d20 with the
// ledger's bonus and offers "Roll damage" on the result card; the damage badge rolls the ledger's pool;
// the keyboard path (context-menu key on the focused badge) opens the roll sheet, and Advantage shows two
// d20s with the dropped one struck through; a forced natural 20 offers "Roll critical damage" with doubled
// dice and the modifier once; a spell attack row rolls its profile's bonus; flat or unparseable damage shows
// plain; tapping a row still opens its details; and every roll leaves the stored character (slots, uses,
// ammunition) unchanged.
async function checkActionRolls(ctx, width, meta) {
  const page = await ctx.newPage();
  // Same as in checkDiceTrayAndLog: the card-with-follow-up check fast-forwards the clock past the 8s
  // auto-dismiss timer instead of sleeping through it.
  await page.clock.install();
  const prefix = `[${width}px actions rolls]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
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
  const storedCharacter = (id) => readStoredCharacter(page, id);
  const setFaces = (faces) => page.evaluate((f) => (window.__setRandomSource ? window.__setRandomSource(f) : "no hook"), faces);

  // The weapon attack row: badges read from the ledger, a tap rolls the attack.
  await gotoApp(page, `${BASE}/character/${ACTIONS_ID}`);
  await page.getByText("Actions", { exact: true }).first().click();
  await page.getByText(/equipped weapon attacks/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the Actions tab did not show EQUIPPED WEAPON ATTACKS"));
  const toHit = page.locator('[data-testid="roll-badge-attack-0-tohit"]');
  const damageBadge = page.locator('[data-testid="roll-badge-attack-0-damage"]');
  if (!(await toHit.isVisible().catch(() => false))) fail('no "to hit" roll badge on the weapon row');
  else if ((await badgeText(toHit)) !== "+5 to hit") fail(`the "to hit" badge reads "${await badgeText(toHit)}", expected "+5 to hit"`);
  if (!(await damageBadge.isVisible().catch(() => false))) fail("no damage roll badge on the weapon row");
  else if ((await badgeText(damageBadge)) !== "1d8 + 3 slashing") fail(`the damage badge reads "${await badgeText(damageBadge)}", expected "1d8 + 3 slashing"`);
  // The badges' accessible names carry the roll's source and value, not just the badge text.
  for (const name of ["Roll Longsword attack, +5", "Roll Longsword damage, 1d8 + 3"]) {
    if (!(await page.getByLabel(name, { exact: true }).first().isVisible().catch(() => false))) fail(`no badge accessible-labelled "${name}"`);
  }
  const before = await storedCharacter(ACTIONS_ID);
  if (!before) fail("the seeded character is not in storage");
  for (const v of await page.evaluate(findLayoutViolations, null)) fail(v);
  await maybeShot(page, shot("tab"), meta);

  // Tap the "to hit" badge: a d20 +5, fixed to 15, so total 20, with "Roll damage" on the card and no details modal.
  if ((await setFaces([15])) === "no hook") fail("the test-only random-source hook (window.__setRandomSource) is not exposed on a seeded web build");
  await toHit.click();
  await page.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("no result card after tapping the to-hit badge"));
  if (!(await assertAbsentFor(async () => (await page.locator(dialogSel).count()) > 0))) fail("tapping the badge opened the row's details modal");
  let card = await readCard();
  if (!card) fail("the result card disappeared before it could be read");
  else {
    if (card.source !== "Kara · Longsword attack") fail(`the attack card's source is "${card.source}", expected "Kara · Longsword attack"`);
    if (card.chips.length !== 1 || card.chips[0].text !== "15d20" || card.chips[0].struck) fail(`the attack card's faces are ${JSON.stringify(card.chips)}, expected one unstruck 15d20`);
    if (card.modifier !== "+5") fail(`the attack card's modifier is "${card.modifier}", expected "+5"`);
    if (card.total !== "20") fail(`the attack card's total is "${card.total}", expected "20"`);
    if (card.followUp !== "Roll damage") fail(`the attack card's follow-up is "${card.followUp}", expected "Roll damage"`);
  }
  await maybeShot(page, shot("attack"), meta);

  // The card body names the source and total for screen readers, and the follow-up button uses the
  // secondary style, not the accent fill (the screen below has its own primary action).
  if (!(await page.getByLabel("Kara · Longsword attack, total 20", { exact: true }).first().isVisible().catch(() => false)))
    fail('the result card body is not accessible-labelled "Kara · Longsword attack, total 20"');
  // The announcement is web's always-mounted live region, not the card (a card that mounts already
  // populated is not announced reliably); its text names the roll's source and total.
  const region = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="dice-announce-region"]');
    return el ? { live: el.getAttribute("aria-live"), text: (el.textContent ?? "").trim() } : null;
  });
  if (!region) fail("the always-mounted announce live region is missing on web");
  else {
    if (region.live !== "polite") fail(`the announce region's aria-live is ${region.live}, expected "polite"`);
    if (!region.text.includes("Kara") || !region.text.includes("total 20"))
      fail(`the announce region's text is "${region.text}", expected the roll's heading and total`);
  }
  const cardLive = await page.evaluate(() => document.querySelector('[data-testid="result-card"]')?.getAttribute("aria-live") ?? null);
  if (cardLive !== null) fail(`the result card itself is a live region (aria-live ${cardLive}); the announce region is the only one on web`);
  const accentFill = hexToRgbString(ACCENT_PALETTES.crimson.primary);
  const secondaryFill = hexToRgbString(BASE_DARK_THEME.surfaceHighlight);
  const followUpBg = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="result-card"]');
    if (!card) return null;
    const strip = (t) => (t ?? "").replace(/[\uE000-\uF8FF]/g, "").trim();
    // The follow-up renders as a TouchableOpacity; walk up from its text leaf to the element
    // that carries the background fill.
    const leaf = [...card.querySelectorAll("*")].find((e) => e.children.length === 0 && strip(e.textContent) === "Roll damage");
    let el = leaf ?? null;
    while (el && getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)") el = el.parentElement;
    return el ? getComputedStyle(el).backgroundColor : null;
  });
  if (followUpBg === null) fail('no "Roll damage" button on the attack card to measure');
  else if (followUpBg === accentFill || followUpBg !== secondaryFill)
    fail(`the "Roll damage" follow-up's background is ${followUpBg}, expected the secondary fill ${secondaryFill} (not the accent fill ${accentFill}) while the screen below has its own primary action`);

  // The follow-up rolls the damage pool 1d8 + 3 (fixed face clamps to 8 on the d8).
  await page.getByText("Roll damage", { exact: true }).first().click();
  await page.waitForFunction(() => document.querySelector('[data-testid="result-source"]')?.textContent?.includes("damage"), null, { timeout: 10000, polling: 100 }).catch(() => fail("the damage follow-up did not replace the card"));
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
  await settle(page);
  await page.keyboard.press("ContextMenu");
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("the context-menu key on the focused badge did not open the roll sheet"));
  for (const label of ["Disadvantage", "Roll", "Advantage"]) {
    if (!(await page.getByText(label, { exact: true }).first().isVisible().catch(() => false))) fail(`the roll sheet does not show "${label}"`);
  }
  await maybeShot(page, shot("sheet"), meta);
  await page.getByText("Advantage", { exact: true }).first().click();
  await page.waitForSelector(dialogSel, { state: "hidden", timeout: 10000 }).catch(() => fail("the roll sheet did not close after choosing Advantage"));
  await page.waitForFunction(() => document.querySelector('[data-testid="result-card"] [data-testid="die-chip"]') !== null, null, { timeout: 10000, polling: 100 }).catch(() => fail("no result card after the sheet's Advantage"));
  card = await readCard();
  if (!card) fail("the advantage card disappeared before it could be read");
  else {
    if (card.chips.length !== 2 || card.chips.some((c) => !c.text.endsWith("d20"))) fail(`advantage shows ${JSON.stringify(card.chips)}, expected two d20s`);
    else if (card.chips.filter((c) => c.struck).length !== 1) fail(`advantage shows ${JSON.stringify(card.chips)}, expected exactly one struck through`);
    else if (card.chips.map((c) => Number(/(\d+)d20/.exec(c.text)?.[1])).join(",") !== "17,9") fail(`advantage faces are ${JSON.stringify(card.chips)}, expected 17 and 9`);
    if (card.total !== "22") fail(`the advantage total is "${card.total}", expected "22" (17 + 5)`);
    if (card.modifier !== "+5") fail(`the advantage card's modifier is "${card.modifier}", expected "+5"`);
  }
  await maybeShot(page, shot("advantage"), meta);

  // A forced natural 20: the card offers "Roll critical damage" and rolls doubled dice, modifier once.
  await setFaces([20]);
  await toHit.click();
  await page.waitForFunction(() => /Roll critical damage/.test(document.querySelector('[data-testid="result-card"]')?.textContent ?? ""), null, { timeout: 10000, polling: 100 }).catch(() => fail("a natural 20 did not offer \"Roll critical damage\""));
  // The page-clock time at which the follow-up card was first seen, the start of the window below.
  const followUpSeenAt = await page.evaluate(() => Date.now());
  card = await readCard();
  if (card) {
    if (!card.markers.includes("Natural 20")) fail(`the natural-20 card's markers are ${JSON.stringify(card.markers)}`);
    if (card.followUp !== "Roll critical damage") fail(`the natural-20 card's follow-up is "${card.followUp}", expected "Roll critical damage"`);
  }
  // A card that still offers a follow-up never auto-dismisses, even after the usual ~8s: the card must
  // stay shown until 8600ms after it was first seen with its follow-up.
  if (width === SINGLE_RUN_WIDTH) {
    const gap = followUpSeenAt + 8600 - (await page.evaluate(() => Date.now()));
    if (gap > 0) await page.clock.fastForward(gap);
    const stayed = await assertAbsentFor(async () => (await page.locator(cardSel).count()) === 0);
    if (!stayed) fail('the natural-20 card with a pending "Roll critical damage" follow-up auto-dismissed');
  }
  await page.getByText("Roll critical damage", { exact: true }).first().click();
  await page.waitForFunction(() => document.querySelector('[data-testid="result-source"]')?.textContent?.includes("damage"), null, { timeout: 10000, polling: 100 }).catch(() => fail("the critical damage follow-up did not roll"));
  card = await readCard();
  if (!card) fail("the critical damage card disappeared before it could be read");
  else {
    if (card.source !== "Kara · Longsword damage") fail(`the critical card's source is "${card.source}"`);
    if (card.chips.length !== 2 || card.chips.some((c) => c.text !== "8d8")) fail(`critical damage shows ${JSON.stringify(card.chips)}, expected two doubled 8d8 (faces clamp to 8)`);
    if (card.modifier !== "+3" || card.total !== "19") fail(`critical damage reads ${card.modifier} / ${card.total}, expected +3 / 19 (the modifier once)`);
    if (!card.markers.includes("Critical")) fail(`the critical card's markers are ${JSON.stringify(card.markers)}, expected Critical`);
  }
  await maybeShot(page, shot("critical"), meta);
  await setFaces(null);

  // Tapping the row (not the badge) still opens its details.
  await page.getByText("Longsword", { exact: true }).first().click();
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("tapping the weapon row did not open its details modal"));
  await page.keyboard.press("Escape");
  await page.waitForSelector(dialogSel, { state: "hidden", timeout: 10000 }).catch(() => fail("Escape did not close the details modal"));

  // A spell attack row rolls its casting profile's bonus; its non-pool damage label stays plain.
  await gotoApp(page, `${BASE}/character/${WIZARD_ID}`);
  await page.getByText("Actions", { exact: true }).first().click();
  await page.getByText(/spell attacks/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the Actions tab did not show SPELL ATTACKS"));
  // The snapshot window covers both seeded characters: Kara (a limited-use feature with a use left and
  // ammunition) and Elowen (spell slots left, a use left, ammunition). Loading a sheet normalizes the
  // stored record once, so the wizard's "before" is read after her page has loaded, before any roll.
  const beforeWizard = await storedCharacter(WIZARD_ID);
  if (!beforeWizard) fail("the seeded wizard is not in storage");
  const spellToHit = page.locator('[data-testid="roll-badge-spell-0-tohit"]');
  if (!(await spellToHit.isVisible().catch(() => false))) fail("the Fire Bolt row has no to-hit roll badge");
  else if ((await badgeText(spellToHit)) !== "+5 to hit") fail(`the spell badge reads "${await badgeText(spellToHit)}", expected "+5 to hit"`);
  if (!(await page.getByLabel("Roll Fire Bolt attack, +5", { exact: true }).first().isVisible().catch(() => false)))
    fail('no spell badge accessible-labelled "Roll Fire Bolt attack, +5"');
  if (!(await assertAbsentFor(async () => (await page.locator('[data-testid="roll-badge-spell-0-damage"]').count()) > 0))) fail('the "Cantrip scaling" damage shows a roll badge');
  const plainDamage = await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "Cantrip scaling");
    return el ? el.closest('[data-testid^="roll-badge"]') === null : false;
  });
  if (!plainDamage) fail('"Cantrip scaling" is inside a roll badge, expected plain text');
  // Only spells that make a spell attack get a "to hit" badge: Light and Mage Hand (rows 1 and 2) keep
  // their rows and their plain damage label, but no to-hit roll badge.
  for (const idx of [1, 2]) {
    if (!(await assertAbsentFor(async () => (await page.locator(`[data-testid="roll-badge-spell-${idx}-tohit"]`).count()) > 0)))
      fail(`spell row ${idx} (Light / Mage Hand, no spell attack) shows a "to hit" roll badge`);
  }
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
  await gotoApp(page, `${BASE}/character/${CHARACTER_ID}`);
  await page.getByText("Actions", { exact: true }).first().click();
  await page.getByText(/attack action/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the Actions tab did not load for the unarmed fallback"));
  const unarmedToHit = page.locator('[data-testid="roll-badge-unarmed-tohit"]');
  if (!(await unarmedToHit.isVisible().catch(() => false))) fail("the unarmed fallback row has no to-hit roll badge");
  else if ((await badgeText(unarmedToHit)) !== "+3 to hit") fail(`the unarmed badge reads "${await badgeText(unarmedToHit)}", expected "+3 to hit"`);
  if (!(await page.getByLabel("Roll Unarmed Strike attack, +3", { exact: true }).first().isVisible().catch(() => false)))
    fail('no unarmed badge accessible-labelled "Roll Unarmed Strike attack, +3"');
  if (!(await assertAbsentFor(async () => (await page.locator('[data-testid="roll-badge-unarmed-damage"]').count()) > 0))) fail("the flat unarmed damage shows a roll badge");
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

  // Nothing was spent: every roll above — the weapon attack, its damage, the critical damage and the
  // spell attack — left both stored characters byte-identical (slots, uses and ammunition included).
  const after = await storedCharacter(ACTIONS_ID);
  if (!after) fail("the seeded character vanished from storage");
  else if (JSON.stringify(after) !== JSON.stringify(before)) fail("the rolls changed the stored character (slots, uses or ammunition)");
  const afterWizard = await storedCharacter(WIZARD_ID);
  if (!afterWizard) fail("the seeded wizard vanished from storage");
  else if (JSON.stringify(afterWizard) !== JSON.stringify(beforeWizard)) fail("the spell attack changed the stored wizard (slots, uses or ammunition)");
  await closePage(page);
  return failures;
}

// The Level-Up Flow checks walk /levelup/<id> with the seeded Ranger (Tamsin), a character no screen
// scenario mutates. `playLevelUp` picks the class, the given Hit Points mode and a CON +2 ASI where the
// level brings one, and walks to Review through whatever steps the plan lists.
const LU_ID = RANGER_ID;
const LU_NAME = "Tamsin";

// The stored Character by id, read from the browser's localStorage.
function readStoredCharacter(page, id) {
  return page.evaluate((charId) => JSON.parse(localStorage.getItem("@dnd5e_characters") ?? "[]").find((c) => c.id === charId) ?? null, id);
}

// Waits until the flow's Continue is enabled (the open step's pick is complete), then taps it. When
// Continue never enables, `fail` reports it instead of the click landing on a disabled button.
async function continueFlow(page, fail = () => {}) {
  const enabled = await page
    .waitForFunction(() => {
      const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent === "Continue");
      const target = el?.closest("[tabindex]");
      return target && target.getAttribute("aria-disabled") !== "true";
    }, null, { timeout: 10000, polling: 100 })
    .then(() => true)
    .catch(() => false);
  if (!enabled) {
    fail("Continue never enabled on the open step (its pick is incomplete)");
    return;
  }
  await page.getByText("Continue", { exact: true }).first().click();
  await settle(page);
}

// Opens the flow and picks the held class, landing on the Hit Points step.
async function openLevelUp(page) {
  await gotoApp(page, `${BASE}/levelup/${LU_ID}`);
  await page.getByLabel("Level up Ranger").first().click();
  await page.getByText("Continue", { exact: true }).first().click();
  await page.getByLabel("Roll hit points").first().waitFor({ state: "visible", timeout: 10000 });
}

// Walks from the Hit Points step to Review: the given HP mode, then on every later step the first
// Subclass option, a CON (+2) ASI and the first offered spell where those steps appear. `fail` reports
// violations seen along the way (e.g. a Subclass chip under 48dp).
async function walkToReview(page, hpMode, fail = () => {}) {
  await page.getByLabel(hpMode === "roll" ? "Roll hit points" : "Average hit points").first().click();
  await settle(page);
  for (let i = 0; i < 8; i++) {
    if ((await page.getByText("Level up", { exact: true }).count()) > 0) return;
    const sub = page.getByLabel(/^Subclass /).first();
    if ((await sub.count()) > 0) {
      await sub.click();
      await settle(page);
      const chipHeight = await sub.evaluate((el) => el.getBoundingClientRect().height).catch(() => 0);
      if (chipHeight < 47.5) fail(`a Subclass chip is ${Math.round(chipHeight)}px tall, under 48dp`);
    }
    const con = page.getByLabel("CON (+2)").first();
    if ((await con.count()) > 0) {
      await con.click();
      await settle(page);
    }
    const learn = page.getByLabel(/^Learn /).first();
    if ((await learn.count()) > 0) {
      await learn.click();
      await settle(page);
    }
    await continueFlow(page, fail);
  }
  fail('walkToReview never reached Review (no "Level up" button after 8 steps)');
}

// True when a visible leaf element shows exactly `text` (the stack can keep a hidden copy of the
// previous screen, so a plain first() locator can wait on the hidden one).
async function waitForVisibleText(page, text) {
  return page
    .waitForFunction(
      (needle) =>
        [...document.querySelectorAll("*")].some(
          (e) => e.children.length === 0 && e.textContent.trim() === needle && e.getBoundingClientRect().height > 0
        ),
      text,
      { timeout: 10000, polling: 100 }
    )
    .then(() => true)
    .catch(() => false);
}

// The Level-Up Flow's Hit Points roll is logged: rolling on the Hit Points step adds a
// "<character> · Hit Points" entry to the Roll Log.
async function checkLevelUpHpRollLogged(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px level-up HP roll]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  await openLevelUp(page);
  await page.getByLabel("Roll hit points").first().click();
  await settle(page);
  // The roll was published through the seam: open the tray on its Log segment and read the newest entries.
  await page.getByLabel("Dice tray").first().click();
  await page.waitForSelector('[role="dialog"]', { state: "visible", timeout: 10000 }).catch(() => fail("the dice tray did not open"));
  await page.getByText("Log", { exact: true }).first().click();
  await settle(page);
  const headings = await page.evaluate(() => [...document.querySelectorAll('[data-testid="log-entry-heading"]')].map((el) => el.textContent));
  if (!headings.includes(`${LU_NAME} · Hit Points`)) fail(`the Roll Log has no "${LU_NAME} · Hit Points" entry: ${JSON.stringify(headings)}`);
  await maybeShot(page, join(SHOTS, `LevelUp-HPRoll-${width}.png`), meta);
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 10000 }).catch(() => {});
  await closePage(page);
  return failures;
}

// The Hit Points state rules: re-picking the picked class keeps the plan unchanged (the roll stays
// selected, Average stays disabled); a different class starts a fresh plan whose HP may be rolled once.
async function checkLevelUpHpState(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px level-up HP state]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  const rollRow = page.getByLabel("Roll hit points").first();
  const averageRow = page.getByLabel("Average hit points").first();
  const rowState = (row) =>
    row.evaluate((el) => ({
      disabled: el.getAttribute("aria-disabled") === "true",
      selected: el.getAttribute("aria-selected") === "true",
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    }));
  const classChip = page.getByRole("button", { name: "Class", exact: true }).first();

  await openLevelUp(page); // picks the held Ranger, lands on the Hit Points step
  await rollRow.click();
  await settle(page);
  const rolled = await rowState(rollRow);
  if (!rolled.selected) fail("the Roll row is not selected after rolling");
  if (!rolled.disabled) fail("the Roll row is not disabled after rolling");
  const rolledText = rolled.text;
  const averageAfterRoll = await rowState(averageRow);
  if (!averageAfterRoll.disabled) fail("the Average row is not disabled after the roll");

  // Re-pick the same class: the plan is unchanged, the roll stays selected.
  await classChip.click();
  await settle(page);
  await page.getByLabel("Level up Ranger").first().click();
  await settle(page);
  await page.getByText("Continue", { exact: true }).first().click();
  await rollRow.waitFor({ state: "visible", timeout: 10000 });
  const afterRepick = await rowState(rollRow);
  if (!afterRepick.selected || afterRepick.text !== rolledText)
    fail(`re-picking the same class reset the Hit Points pick: roll row now "${afterRepick.text}" selected=${afterRepick.selected}, expected the kept "${rolledText}"`);
  // Tapping the disabled Average row changes nothing.
  await averageRow.click({ force: true }).catch(() => {});
  await settle(page);
  const afterAverageTap = await rowState(rollRow);
  if (!afterAverageTap.selected || afterAverageTap.text !== rolledText)
    fail(`tapping Average after the roll discarded it: roll row now "${afterAverageTap.text}" selected=${afterAverageTap.selected}`);
  await maybeShot(page, join(SHOTS, `LevelUp-HPState-rolled-${width}.png`), meta);

  // A different class starts a fresh plan: Average selected, Roll enabled, rollable once.
  await classChip.click();
  await settle(page);
  await page.getByLabel("Level up Fighter").first().click();
  await settle(page);
  await page.getByText("Continue", { exact: true }).first().click();
  await averageRow.waitFor({ state: "visible", timeout: 10000 });
  const freshAverage = await rowState(averageRow);
  const freshRoll = await rowState(rollRow);
  if (!freshAverage.selected) fail(`a fresh plan for another class does not select Average (selected=${freshAverage.selected})`);
  if (freshRoll.disabled) fail("the Roll row stays disabled for a freshly picked class");
  if (freshRoll.selected) fail("the Roll row is selected on a fresh plan before any roll");
  await maybeShot(page, join(SHOTS, `LevelUp-HPState-fresh-${width}.png`), meta);
  await closePage(page);
  return failures;
}

// Whether the flow's Continue is enabled, polling briefly for the re-render after a tap.
async function continueEnabledSoon(page, timeoutMs = 4000) {
  return page
    .waitForFunction(
      () => {
        const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent === "Continue");
        const target = el?.closest("[tabindex]");
        return target && target.getAttribute("aria-disabled") !== "true";
      },
      null,
      { timeout: timeoutMs, polling: 100 }
    )
    .then(() => true)
    .catch(() => false);
}

// Opens the Level-Up Flow for the seeded Ranger, picks the held class, takes the average Hit Points and
// walks past any Subclass step to the ASI/Feat step, with the Feat tab open.
async function openAsiFeatStep(page, fail = () => {}) {
  await openLevelUp(page); // picks the held Ranger, lands on the Hit Points step
  await page.getByLabel("Average hit points").first().click();
  await settle(page);
  for (let i = 0; i < 4; i++) {
    const sub = page.getByLabel(/^Subclass /).first();
    if ((await sub.count()) > 0) {
      await sub.click();
      await settle(page);
    }
    await continueFlow(page, fail);
    if ((await page.getByRole("button", { name: "Feat", exact: true }).count()) > 0) break;
  }
  await page.getByRole("button", { name: "Feat", exact: true }).first().click();
  await settle(page);
}

// Selecting any feat replaces the plan's pick at once: a no-choice feat completes the ASI/Feat step, then
// a feat with an ability choice leaves Continue disabled until the ability is chosen, and Review lists the
// second feat. The choice feat needs the integrated catalog; the SRD Baseline offers only one feat.
async function checkLevelUpFeatReplace(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px level-up feat replace]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  await openAsiFeatStep(page, fail);
  const noChoiceFeat = INTEGRATED ? "Alert" : "Grappler";
  const choiceFeat = "Athlete";
  await page.getByRole("button", { name: `Feat ${noChoiceFeat}`, exact: true }).first().click();
  await settle(page);
  if (!(await continueEnabledSoon(page))) fail(`picking ${noChoiceFeat} (no ability choice) did not complete the ASI/Feat step`);
  if (INTEGRATED) {
    await page.getByRole("button", { name: `Feat ${choiceFeat}`, exact: true }).first().click();
    await settle(page);
    if (await continueEnabledSoon(page))
      fail(`tapping ${choiceFeat} left Continue enabled: the plan still holds the replaced pick ${noChoiceFeat}`);
    const strChip = page.getByLabel("STR +1").first();
    if ((await strChip.count()) === 0) fail(`tapping ${choiceFeat} did not show its ability chips`);
    else {
      await strChip.click();
      await settle(page);
      if (!(await continueEnabledSoon(page))) fail(`choosing STR +1 did not complete the ASI/Feat step`);
    }
  }
  // Walk to Review (the level may bring a Spells step after ASI/Feat).
  for (let i = 0; i < 4; i++) {
    if ((await page.getByText("Level up", { exact: true }).count()) > 0) break;
    const learn = page.getByLabel(/^Learn /).first();
    if ((await learn.count()) > 0) {
      await learn.click();
      await settle(page);
    }
    await continueFlow(page, fail);
  }
  const listedFeat = INTEGRATED ? choiceFeat : noChoiceFeat;
  if (!(await waitForVisibleText(page, listedFeat))) fail(`Review does not list "${listedFeat}"`);
  if (INTEGRATED && !(await assertAbsentFor(async () => page.getByText(noChoiceFeat, { exact: true }).first().isVisible().catch(() => false))))
    fail(`Review still lists "${noChoiceFeat}": the replaced pick was applied`);
  await maybeShot(page, join(SHOTS, `LevelUp-FeatReplace-${width}.png`), meta);
  await closePage(page);
  return failures;
}

// The feat sub-choice chips are at least 48dp tall, and once the choice's cap is reached a new option is
// disabled while the picked ones stay deselectable. A feat with its own rule choice needs the integrated
// catalog; the SRD Baseline offers none.
async function checkLevelUpFeatSubChoiceChips(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px level-up feat sub-choice chips]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  await openAsiFeatStep(page, fail);
  if (!INTEGRATED) {
    await page.getByRole("button", { name: "Feat Grappler", exact: true }).first().click();
    await settle(page);
    if (!(await continueEnabledSoon(page))) fail("picking the SRD Baseline's only feat did not complete the ASI/Feat step");
    await closePage(page);
    return failures;
  }
  await page.getByRole("button", { name: "Feat Fighting Initiate", exact: true }).first().click();
  await settle(page);
  if (await continueEnabledSoon(page)) fail("tapping Fighting Initiate left Continue enabled: its style choice is not picked yet");
  const styleChip = (name) => page.getByRole("button", { name: `Fighting Initiate Style ${name}`, exact: true }).first();
  const archery = styleChip("Archery");
  if ((await archery.count()) === 0) fail("no fighting style chips under Fighting Initiate");
  else {
    const chipHeight = await archery.evaluate((el) => el.getBoundingClientRect().height).catch(() => 0);
    if (chipHeight < 47.5) fail(`a feat sub-choice chip is ${Math.round(chipHeight)}px tall, under 48dp`);
    await archery.click();
    await settle(page);
    if (!(await continueEnabledSoon(page))) fail("picking Archery did not complete the ASI/Feat step");
    if (!(await waitForVisibleText(page, "Fighting Initiate Style (1/1):"))) fail('the style counter does not read "(1/1)" after picking one');
    const defense = styleChip("Defense");
    const defenseDisabled = await defense.evaluate((el) => el.getAttribute("aria-disabled") === "true").catch(() => false);
    if (!defenseDisabled) fail("at the cap (1/1) another style chip is not disabled");
    await defense.click({ force: true }).catch(() => {});
    await settle(page);
    if (!(await waitForVisibleText(page, "Fighting Initiate Style (1/1):"))) fail("force-tapping a disabled-at-cap style chip changed the pick");
    await archery.click();
    await settle(page);
    if (await continueEnabledSoon(page)) fail("deselecting the picked style left Continue enabled");
    if (!(await waitForVisibleText(page, "Fighting Initiate Style (0/1):"))) fail('the style counter does not read "(0/1)" after deselecting');
  }
  await maybeShot(page, join(SHOTS, `LevelUp-FeatSubChoices-${width}.png`), meta);
  await closePage(page);
  return failures;
}

// Each class's plan (including its rolled Hit Points) is kept for the life of the flow: roll for class A,
// switch to class B, return to A — A's roll row is disabled and selected again with the same result, and
// the Roll Log holds exactly one "Hit Points" entry for the round trip.
async function checkLevelUpHpPerClass(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px level-up HP per class]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  const rollRow = page.getByLabel("Roll hit points").first();
  const rowState = (row) =>
    row.evaluate((el) => ({
      disabled: el.getAttribute("aria-disabled") === "true",
      selected: el.getAttribute("aria-selected") === "true",
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    }));
  const classChip = page.getByRole("button", { name: "Class", exact: true }).first();
  const goToHpStep = async (classLabel) => {
    await classChip.click();
    await settle(page);
    await page.getByLabel(classLabel).first().click();
    await settle(page);
    await page.getByText("Continue", { exact: true }).first().click();
    await rollRow.waitFor({ state: "visible", timeout: 10000 });
    await settle(page);
  };

  await openLevelUp(page); // picks the held Ranger, lands on the Hit Points step
  await rollRow.click();
  await settle(page);
  const rolledA = await rowState(rollRow);
  if (!rolledA.selected || !rolledA.disabled) fail(`the Roll row is not final after rolling for the Ranger (selected=${rolledA.selected} disabled=${rolledA.disabled})`);

  // A different class starts a fresh plan: its Roll row is enabled again.
  await goToHpStep("Level up Fighter");
  const freshB = await rowState(rollRow);
  if (freshB.disabled || freshB.selected) fail(`a fresh plan for another class does not offer Roll again (selected=${freshB.selected} disabled=${freshB.disabled})`);

  // Returning to the first class restores its plan: the roll is final again, with the same result.
  await goToHpStep("Level up Ranger");
  const backToA = await rowState(rollRow);
  if (!backToA.disabled || !backToA.selected || backToA.text !== rolledA.text)
    fail(
      `returning to the Ranger did not restore its rolled plan: roll row "${backToA.text}" selected=${backToA.selected} disabled=${backToA.disabled}, expected the kept "${rolledA.text}" final`
    );
  // A re-roll on the restored plan must not be possible; if the row is enabled, tapping it must not log another roll.
  if (!backToA.disabled) {
    await rollRow.click({ force: true }).catch(() => {});
    await settle(page);
  }
  await page.getByLabel("Dice tray").first().click();
  await page.waitForSelector('[role="dialog"]', { state: "visible", timeout: 10000 }).catch(() => fail("the dice tray did not open"));
  await page.getByText("Log", { exact: true }).first().click();
  await settle(page);
  const headings = await page.evaluate(() => [...document.querySelectorAll('[data-testid="log-entry-heading"]')].map((el) => el.textContent));
  const hpEntries = headings.filter((h) => h === `${LU_NAME} · Hit Points`);
  if (hpEntries.length !== 1) fail(`the Roll Log holds ${hpEntries.length} "${LU_NAME} · Hit Points" entries after the class round trip, expected exactly 1: ${JSON.stringify(headings)}`);
  await maybeShot(page, join(SHOTS, `LevelUp-HPPerClass-${width}.png`), meta);
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 10000 }).catch(() => {});
  await closePage(page);
  return failures;
}

// At total level 20 the sheet's header hides Level up (no level left to gain) and keeps Edit Build.
async function checkLevelUpHiddenAtMaxLevel(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px level-up hidden at 20]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  await gotoApp(page, `${BASE}/character/${MAX_LEVEL_ID}`);
  if (!(await waitForVisibleText(page, "Lvl 20"))) fail("the sheet does not show \"Lvl 20\" for the level-20 character");
  // On phones the header's actions live in its menu; at 768px and up they sit in the left rail.
  if (width < 768) {
    await page.getByLabel("Sheet menu").first().click();
    await page.getByText("Character", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the phone header menu did not open"));
  }
  if (!(await assertAbsentFor(async () => (await page.getByLabel("Level up").count()) > 0))) fail("the header still offers Level up at total level 20");
  if (!(await page.getByLabel("Edit Build").first().isVisible().catch(() => false))) fail("Edit Build is gone at total level 20");
  await maybeShot(page, join(SHOTS, `LevelUp-HiddenAt20-${width}.png`), meta);
  await closePage(page);
  return failures;
}

// A negative Constitution modifier is written with its sign in the Hit Points step's Roll row: "1d10-1", never "1d10+-1".
async function checkLevelUpHpModifierSign(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px level-up HP sign]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  await gotoApp(page, `${BASE}/levelup/${LOW_CON_ID}`);
  await page.getByLabel("Level up Fighter").first().click();
  await page.getByText("Continue", { exact: true }).first().click();
  const rollRow = page.getByLabel("Roll hit points").first();
  await rollRow.waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the Hit Points step did not open"));
  const flat = ((await rollRow.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
  if (!flat.includes("1d10-1")) fail(`the Roll row does not read "1d10-1" for Constitution 8: "${flat}"`);
  if (flat.includes("+-")) fail(`the Roll row writes the modifier as "+-": "${flat}"`);
  await maybeShot(page, join(SHOTS, `LevelUp-HPSign-${width}.png`), meta);
  await closePage(page);
  return failures;
}

// The Level-Up Flow's Cancel asks before discarding and leaves the Character unchanged, the system Back asks
// too, and Review's "Level up" applies the plan in one update.
async function checkLevelUpCancelAndReview(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px level-up cancel/review]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };

  // The system Back asks before discarding the plan: enter the flow from the sheet's header Level up button
  // (so Back pops inside the app), pick a class, then browser Back must ask and stay.
  await gotoApp(page, `${BASE}/character/${LU_ID}`);
  // On phones the header's Level up sits in its menu; at 768px and up in the left rail.
  if (width < 768) {
    await page.getByLabel("Sheet menu").first().click();
    await settle(page);
  }
  await page.getByLabel("Level up").first().click();
  await settle(page);
  if (!page.url().includes(`/levelup/${LU_ID}`)) fail(`the header's Level up did not open the flow: ${page.url()}`);
  await page.getByLabel("Level up Ranger").first().click();
  await settle(page);
  await page.goBack();
  // The popstate is asynchronous: wait for the discard question (and the still-open flow) as conditions.
  if (!(await waitForVisibleText(page, "Discard changes?")))
    fail("system Back did not ask \"Discard changes?\" before leaving the Level-Up Flow");
  // The route is prevented even though the browser URL already popped, so the flow must still be on screen.
  if (!(await page.getByLabel("Cancel level up").first().waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false)))
    fail("system Back left the Level-Up Flow instead of asking first");
  const keepEditing = page.getByText("Keep editing", { exact: true }).first();
  if ((await keepEditing.count()) === 0) fail('no "Keep editing" button after the prevented Back');
  else await keepEditing.click({ timeout: 5000 }).catch(() => fail('could not tap "Keep editing"'));
  await settle(page);
  // Back on the Class step after the prevented Back: Continue to the Hit Points step.
  await page.getByText("Continue", { exact: true }).first().click();
  await page.getByLabel("Roll hit points").first().waitFor({ state: "visible", timeout: 10000 });

  // Cancel path: a rolled Hit Points pick is made, then Cancel → Discard returns to the sheet with the
  // stored Character deep-equal to before the flow — not only at the old level.
  const beforeCancel = await readStoredCharacter(page, LU_ID);
  if (!beforeCancel) fail("the seeded character is not in storage before Cancel");
  await page.getByLabel("Roll hit points").first().click();
  await settle(page);
  await page.getByLabel("Cancel level up").first().click();
  await page.getByText("Discard changes?", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("Cancel did not ask \"Discard changes?\" before discarding the plan"));
  await page.getByText("Discard", { exact: true }).first().click();
  await settle(page);
  if (!page.url().includes(`/character/${LU_ID}`)) fail(`discard did not return to the sheet: ${page.url()}`);
  if (!(await waitForVisibleText(page, "Lvl 3")))
    fail("after discarding, the sheet does not show \"Lvl 3\": the plan was applied instead of discarded");
  const afterCancel = await readStoredCharacter(page, LU_ID);
  if (!afterCancel) fail("the seeded character vanished from storage after Cancel");
  else if (JSON.stringify(afterCancel) !== JSON.stringify(beforeCancel))
    fail("Cancel changed the stored character: the plan was not discarded whole (deep-equal comparison failed)");
  await maybeShot(page, join(SHOTS, `LevelUp-Cancelled-${width}.png`), meta);

  // Review path: average HP and a CON +2 ASI, then "Level up" applies the level and the picks together.
  await openLevelUp(page);
  await walkToReview(page, "average", fail);
  for (const needle of ["Ranger 3 → 4", "3 → 4", "CON +2"]) {
    if (!(await page.getByText(needle, { exact: true }).first().isVisible().catch(() => false))) fail(`Review does not list "${needle}"`);
  }
  if (!(await page.getByText(/\d+ → \d+/, { exact: false }).first().isVisible().catch(() => false))) fail("Review does not list the hit points before → after");
  if (!(await page.getByText(/Average \+\d+/).first().isVisible().catch(() => false))) fail("Review does not list the hit points method");
  await maybeShot(page, join(SHOTS, `LevelUp-Review-${width}.png`), meta);
  // Double-tap "Level up": the applying guard (and the stale-plan refusal behind it) must apply the plan
  // exactly once, so the stored character's total level rises by exactly 1.
  const totalLevelOf = (c) => (c?.classes ?? []).reduce((sum, cl) => sum + (cl.level ?? 0), 0);
  const storedBefore = await readStoredCharacter(page, LU_ID);
  const levelBefore = totalLevelOf(storedBefore);
  const levelUpBtn = page.getByText("Level up", { exact: true }).first();
  // A real double-tap, witnessed against the applying guard itself: both presses fire inside one
  // synchronous handler, so the second runs before React re-renders the button (React batches the
  // presses and flushes after the handler). The guard's own trace is read once that flush has run:
  // the button must read disabled. The level check below cannot tell the guard from the stale-plan
  // refusal behind it, so without this assertion the check passes even with the guard removed.
  const guardEngaged = await levelUpBtn.evaluate(async (el) => {
    const btn = el.closest("[tabindex]") ?? el;
    btn.click();
    btn.click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    return btn.getAttribute("aria-disabled") === "true";
  });
  if (!guardEngaged) fail('"Level up" never read disabled after the double-tap: the applying guard did not engage');
  await settle(page);
  if (!page.url().includes(`/character/${LU_ID}`)) fail(`"Level up" did not return to the sheet: ${page.url()}`);
  if (!(await waitForVisibleText(page, "Lvl 4")))
    fail("after Review the sheet does not show \"Lvl 4\": the plan was not applied");
  const storedAfter = await readStoredCharacter(page, LU_ID);
  const levelAfter = totalLevelOf(storedAfter);
  if (levelAfter !== levelBefore + 1)
    fail(`a double-tapped "Level up" moved the stored level from ${levelBefore} to ${levelAfter}, expected exactly +1`);
  await maybeShot(page, join(SHOTS, `LevelUp-Applied-${width}.png`), meta);
  await closePage(page);
  return failures;
}

// After a level-up through the flow, the Spells tab still learns, forgets and swaps spells. In the
// integrated catalog the Aberrant Mind Sorcerer's subclass-granted spells carry the Swap control; the SRD
// Baseline has no swappable subclass, so there the Wizard plays learn and forget.
async function checkSpellsAfterLevelUp(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px spells after level-up]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };

  if (INTEGRATED) {
    await gotoApp(page, `${BASE}/levelup/${SORCERER_SWAP_ID}`);
    await page.getByLabel("Level up Sorcerer").first().click();
    await page.getByText("Continue", { exact: true }).first().click();
    await page.getByLabel("Roll hit points").first().waitFor({ state: "visible", timeout: 10000 });
    await walkToReview(page, "average", fail);
    await page.getByText("Level up", { exact: true }).first().click();
    await settle(page);
    if (!(await page.getByText("Lvl 2", { exact: true }).first().isVisible().catch(() => false)))
      fail("the sorcerer's level-up did not apply (the sheet does not show \"Lvl 2\")");
    // Spells tab: learn a spell through Add Spells.
    await page.getByText("Spells", { exact: true }).first().click();
    await settle(page);
    await page.getByText("Add Spells", { exact: true }).first().click();
    await page.waitForSelector('[role="dialog"]', { state: "visible", timeout: 10000 }).catch(() => fail("the Add Spells modal did not open"));
    await page.getByPlaceholder("Search Sorcerer spells...").fill("Sleep");
    await page.getByText("Add", { exact: true }).first().click();
    await settle(page);
    if (!(await page.getByText("Added", { exact: true }).first().isVisible().catch(() => false))) fail("learning a spell did not mark its row \"Added\"");
    await page.keyboard.press("Escape");
    await page.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 10000 }).catch(() => fail("Escape did not close the Add Spells modal"));
    // Swap a subclass-granted spell.
    const swap = page.getByText("Swap", { exact: true }).first();
    if ((await swap.count()) === 0) fail("no Swap control on a subclass-granted spell after the level-up");
    else {
      await swap.click();
      await page.getByText("Swap Subclass Spell", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the swap modal did not open"));
      await page.getByText("Select", { exact: true }).first().click();
      await settle(page);
      if (!(await page.getByText("Reset to Default", { exact: true }).first().isVisible().catch(() => false)))
        fail("swapping did not replace the subclass spell (no \"Reset to Default\")");
    }
    await maybeShot(page, join(SHOTS, `SpellsAfterLevelUp-swap-${width}.png`), meta);
  } else {
    await gotoApp(page, `${BASE}/levelup/${WIZARD_ID}`);
    await page.getByLabel("Level up Wizard").first().click();
    await page.getByText("Continue", { exact: true }).first().click();
    await page.getByLabel("Roll hit points").first().waitFor({ state: "visible", timeout: 10000 });
    await walkToReview(page, "average", fail);
    await page.getByText("Level up", { exact: true }).first().click();
    await settle(page);
    if (!(await page.getByText("Lvl 4", { exact: true }).first().isVisible().catch(() => false)))
      fail("the wizard's level-up did not apply (the sheet does not show \"Lvl 4\")");
    // Spells tab: learn, then forget, a spell.
    await page.getByText("Spells", { exact: true }).first().click();
    await settle(page);
    await page.getByText("Add Spells", { exact: true }).first().click();
    await page.waitForSelector('[role="dialog"]', { state: "visible", timeout: 10000 }).catch(() => fail("the Add Spells modal did not open"));
    await page.getByPlaceholder("Search Wizard spells...").fill("Burning Hands");
    await page.getByText("Add", { exact: true }).first().click();
    await settle(page);
    await page.keyboard.press("Escape");
    await page.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 10000 }).catch(() => fail("Escape did not close the Add Spells modal"));
    if (!(await page.getByLabel("Remove Burning Hands").first().isVisible().catch(() => false)))
      fail("the learned spell \"Burning Hands\" has no Remove control after the level-up");
    else {
      await page.getByLabel("Remove Burning Hands").first().click();
      await settle(page);
      if (!(await assertAbsentFor(async () => (await page.getByLabel("Remove Burning Hands").count()) > 0))) fail("forgetting did not remove \"Burning Hands\"");
    }
    await maybeShot(page, join(SHOTS, `SpellsAfterLevelUp-learn-${width}.png`), meta);
  }
  await closePage(page);
  return failures;
}

// The Stats tab's roll badges: a check, a save, a skill and initiative roll d20 + their bonus; the keyboard
// path to the roll sheet rolls with advantage (two d20s, one struck through); the initiative box still opens
// its breakdown modal when tapped outside the badge.
async function checkStatsRolls(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px stats rolls]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  const shot = (name) => join(SHOTS, `StatsRolls-${name}-${width}.png`);
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
  const setFaces = (faces) => page.evaluate((f) => (window.__setRandomSource ? window.__setRandomSource(f) : "no hook"), faces);
  const dismissCard = async () => {
    await page.getByLabel("Dismiss result").click({ timeout: 3000 }).catch(() => {});
    await page.waitForSelector(cardSel, { state: "hidden", timeout: 3000 }).catch(() => {});
  };

  await gotoApp(page, `${BASE}/character/${CHARACTER_ID}`);
  await page.getByText("Stats", { exact: true }).first().click();
  await page.getByText(/ability scores/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the Stats tab did not load"));

  // Every ability check, the proficient save, a skill and initiative are roll badges with the engine's bonus.
  const badges = [
    ["str check", '[data-testid="roll-badge-check-str"]', "+1"],
    ["dex check", '[data-testid="roll-badge-check-dex"]', "+0"],
    ["con check", '[data-testid="roll-badge-check-con"]', "+0"],
    ["int check", '[data-testid="roll-badge-check-int"]', "+0"],
    ["wis check", '[data-testid="roll-badge-check-wis"]', "+0"],
    ["cha check", '[data-testid="roll-badge-check-cha"]', "+0"],
    ["wis save", '[data-testid="roll-badge-save-wis"]', "+2"],
    ["athletics", '[data-testid="roll-badge-skill-athletics"]', "+1"],
    ["initiative", '[data-testid="roll-badge-initiative"]', "+0"],
  ];
  for (const [name, sel, label] of badges) {
    const loc = page.locator(sel);
    if (!(await loc.isVisible().catch(() => false))) fail(`the Stats tab has no ${name} roll badge`);
    else if ((await badgeText(loc)) !== label) fail(`the ${name} badge reads "${await badgeText(loc)}", expected "${label}"`);
  }
  // The badges' accessible names carry the roll's source and value, so a screen reader can tell ~30
  // badges apart ("Roll Strength check, +1", not "Roll +1").
  for (const name of ["Roll Strength check, +1", "Roll Dexterity check, +0", "Roll Wisdom save, +2", "Roll Athletics, +1", "Roll Initiative, +0"]) {
    if (!(await page.getByLabel(name, { exact: true }).first().isVisible().catch(() => false))) fail(`no badge accessible-labelled "${name}"`);
  }
  for (const v of await page.evaluate(findLayoutViolations, null)) fail(v);
  await maybeShot(page, shot("tab"), meta);

  if ((await setFaces([12])) === "no hook") fail("the test-only random-source hook (window.__setRandomSource) is not exposed on a seeded web build");

  // Tap the Strength check badge: d20 + 1, fixed to 12, so total 13, logged as "Rendar · Strength check".
  await page.locator('[data-testid="roll-badge-check-str"]').click();
  await page.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("no result card after tapping the Strength check badge"));
  if (!(await assertAbsentFor(async () => (await page.locator(dialogSel).count()) > 0))) fail("tapping the check badge opened a modal");
  let card = await readCard();
  if (!card) fail("the check card disappeared before it could be read");
  else {
    if (card.source !== "Rendar · Strength check") fail(`the check card's source is "${card.source}", expected "Rendar · Strength check"`);
    if (card.chips.length !== 1 || card.chips[0].text !== "12d20" || card.chips[0].struck) fail(`the check card's faces are ${JSON.stringify(card.chips)}, expected one unstruck 12d20`);
    if (card.modifier !== "+1" || card.total !== "13") fail(`the check card reads ${card.modifier} / ${card.total}, expected +1 / 13`);
    if (card.followUp !== null) fail(`the check card offers a follow-up "${card.followUp}", expected none`);
  }
  await maybeShot(page, shot("check"), meta);
  await dismissCard();

  // The Wisdom save: d20 + 2, fixed to 5, so total 7.
  await setFaces([5]);
  await page.locator('[data-testid="roll-badge-save-wis"]').click();
  await page.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("no result card after tapping the Wisdom save badge"));
  card = await readCard();
  if (!card) fail("the save card disappeared before it could be read");
  else {
    if (card.source !== "Rendar · Wisdom save") fail(`the save card's source is "${card.source}", expected "Rendar · Wisdom save"`);
    if (card.chips.length !== 1 || card.chips[0].text !== "5d20" || card.chips[0].struck) fail(`the save card's faces are ${JSON.stringify(card.chips)}, expected one unstruck 5d20`);
    if (card.modifier !== "+2" || card.total !== "7") fail(`the save card reads ${card.modifier} / ${card.total}, expected +2 / 7`);
  }
  await maybeShot(page, shot("save"), meta);
  await dismissCard();

  // The Athletics skill: d20 + 1, fixed to 18, so total 19.
  await setFaces([18]);
  await page.locator('[data-testid="roll-badge-skill-athletics"]').click();
  await page.waitForSelector(cardSel, { state: "visible", timeout: 10000 }).catch(() => fail("no result card after tapping the Athletics badge"));
  card = await readCard();
  if (!card) fail("the skill card disappeared before it could be read");
  else {
    if (card.source !== "Rendar · Athletics") fail(`the skill card's source is "${card.source}", expected "Rendar · Athletics"`);
    if (card.chips.length !== 1 || card.chips[0].text !== "18d20" || card.chips[0].struck) fail(`the skill card's faces are ${JSON.stringify(card.chips)}, expected one unstruck 18d20`);
    if (card.modifier !== "+1" || card.total !== "19") fail(`the skill card reads ${card.modifier} / ${card.total}, expected +1 / 19`);
  }
  await maybeShot(page, shot("skill"), meta);
  await dismissCard();

  // The keyboard path to the roll sheet on the initiative badge: the context-menu key opens it, Advantage
  // rolls two d20s (17 and 3) with the lower struck through, total 17 with the +0 initiative.
  await setFaces([17, 3]);
  const initiativeBadge = page.locator('[data-testid="roll-badge-initiative"]');
  await initiativeBadge.focus();
  // The badge subscribes its key listener when React processes the focus event.
  await settle(page);
  await page.keyboard.press("ContextMenu");
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("the context-menu key on the focused initiative badge did not open the roll sheet"));
  for (const label of ["Disadvantage", "Roll", "Advantage"]) {
    if (!(await page.getByText(label, { exact: true }).first().isVisible().catch(() => false))) fail(`the roll sheet does not show "${label}"`);
  }
  await maybeShot(page, shot("sheet"), meta);
  await page.getByText("Advantage", { exact: true }).first().click();
  await page.waitForSelector(dialogSel, { state: "hidden", timeout: 10000 }).catch(() => fail("the roll sheet did not close after choosing Advantage"));
  await page.waitForFunction(() => document.querySelector('[data-testid="result-card"] [data-testid="die-chip"]') !== null, null, { timeout: 10000, polling: 100 }).catch(() => fail("no result card after the sheet's Advantage"));
  card = await readCard();
  if (!card) fail("the advantage card disappeared before it could be read");
  else {
    if (card.source !== "Rendar · Initiative") fail(`the initiative card's source is "${card.source}", expected "Rendar · Initiative"`);
    if (card.chips.length !== 2 || card.chips.some((c) => !c.text.endsWith("d20"))) fail(`advantage shows ${JSON.stringify(card.chips)}, expected two d20s`);
    else if (card.chips.filter((c) => c.struck).length !== 1) fail(`advantage shows ${JSON.stringify(card.chips)}, expected exactly one struck through`);
    else if (card.chips.map((c) => Number(/(\d+)d20/.exec(c.text)?.[1])).join(",") !== "17,3") fail(`advantage faces are ${JSON.stringify(card.chips)}, expected 17 and 3`);
    else if (!card.chips[1].struck) fail(`the dropped d20 is ${JSON.stringify(card.chips)}, expected the 3 struck through`);
    // A zero modifier renders no modifier chip on the card, so the modifier element is absent.
    if (card.modifier !== "" || card.total !== "17") fail(`the advantage card reads ${card.modifier} / ${card.total}, expected no modifier / 17 (17 kept)`);
  }
  await maybeShot(page, shot("advantage"), meta);
  await setFaces(null);
  await dismissCard();

  // Tapping the initiative box outside the badge still opens its breakdown modal.
  await page.getByText("INITIATIVE", { exact: true }).first().click();
  await page.waitForSelector(dialogSel, { state: "visible", timeout: 10000 }).catch(() => fail("tapping the initiative box did not open its breakdown modal"));
  await page.keyboard.press("Escape");
  await page.waitForSelector(dialogSel, { state: "hidden", timeout: 10000 }).catch(() => fail("Escape did not close the breakdown modal"));

  await closePage(page);
  return failures;
}

// The sheet's chrome at one width: on phones one bottom bar holding all six tabs (each a 48dp target with
// an untruncated label), one compact header bar whose menu holds Level up and Edit Build, and the floating
// dice button above the bar; at 768px and up a left rail with the six tabs and the header actions, Stats in
// two columns, and no horizontal scroll. At every width the Stats roll badges must be centred in their card
// (within 2px) and sized to their content (height at most content plus padding and border).
async function checkSheetChrome(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px sheet chrome]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  const TAB_LABELS = ["Stats", "Actions", "Spells", "Inventory", "Features", "Journal"];

  await gotoApp(page, `${BASE}/character/${CHARACTER_ID}`);
  await page.getByText("Stats", { exact: true }).first().click();
  await page.getByText(/hit points/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => fail("the Stats tab did not load"));

  const chrome = await page.evaluate((labels) => {
    const bar = document.querySelector('[data-testid="sheet-tab-bar"]');
    const rail = document.querySelector('[data-testid="sheet-tab-rail"]');
    const header = document.querySelector('[data-testid="sheet-header"]');
    const button = document.querySelector('[data-testid="dice-button"]');
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const nav = bar ?? rail;
    const tabs = labels.map((label) => {
      const el = nav ? [...nav.querySelectorAll('[role="button"]')].find((b) => b.getAttribute("aria-label") === label) : null;
      if (!el) return { label, missing: true };
      const text = [...el.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === label);
      return {
        label,
        rect: rect(el),
        labelTruncated: text ? text.scrollWidth > text.clientWidth + 1 : null,
      };
    });
    const actions = ["Level up", "Edit Build"].map((label) => {
      const el = nav ? [...nav.querySelectorAll('[role="button"]')].find((b) => b.getAttribute("aria-label") === label) : null;
      return { label, present: !!el, rect: el ? rect(el) : null, visibleNow: !!el && el.getBoundingClientRect().height > 0 };
    });
    return {
      bar: bar ? rect(bar) : null,
      rail: rail ? rect(rail) : null,
      headerHeight: header ? rect(header).height : null,
      button: button ? rect(button) : null,
      tabs,
      actions,
      menuCount: document.querySelectorAll('[aria-label="Sheet menu"]').length,
      vw: window.innerWidth,
      vh: window.innerHeight,
      scrollW: document.documentElement.scrollWidth,
    };
  }, TAB_LABELS);

  if (width < 768) {
    if (!chrome.bar) fail("no bottom tab bar (data-testid=\"sheet-tab-bar\") on the phone sheet");
    else {
      if (Math.abs(chrome.bar.bottom - chrome.vh) > 1) fail(`the tab bar is not flush with the bottom edge (bottom ${Math.round(chrome.bar.bottom)} of ${chrome.vh})`);
      for (const tab of chrome.tabs) {
        if (tab.missing) {
          fail(`the tab bar has no "${tab.label}" tab`);
          continue;
        }
        if (tab.rect.height < 47.5) fail(`the "${tab.label}" tab target is ${Math.round(tab.rect.height)}px tall, under 48dp`);
        if (tab.labelTruncated) fail(`the "${tab.label}" tab label is truncated`);
        if (tab.rect.left < chrome.bar.left - 1 || tab.rect.right > chrome.bar.right + 1 || tab.rect.top < chrome.bar.top - 1)
          fail(`the "${tab.label}" tab sticks out of the bar`);
      }
      if (chrome.bar.height < 56) fail(`the tab bar is ${Math.round(chrome.bar.height)}px tall, under 56dp`);
    }
    if (chrome.headerHeight === null || chrome.headerHeight > 96) fail(`the header is ${chrome.headerHeight === null ? "missing" : Math.round(chrome.headerHeight) + "px tall"}, not one compact bar`);
    if (chrome.menuCount !== 1) fail(`the phone header has ${chrome.menuCount} "Sheet menu" buttons, expected 1`);
    // The four header controls — back, HP chip, AC chip, menu — share one 48dp height and one vertical
    // centre; at 320 nothing overflows the row, and the name keeps its ellipsis clipping.
    const controls = await page.evaluate(() => {
      const header = document.querySelector('[data-testid="sheet-header"]');
      const inner = header ? header.firstElementChild : null;
      const rect = (el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, centreY: (r.top + r.bottom) / 2 };
      };
      const found = {};
      for (const id of ["back", "hp", "ac", "menu"]) {
        const el = document.querySelector(`[data-testid="sheet-header-${id}"]`);
        found[id] = el ? rect(el) : null;
      }
      const nameBtn = document.querySelector('[aria-label="Edit character name"]');
      const nameText = nameBtn ? [...nameBtn.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim().length > 0) : null;
      const ncs = nameText ? getComputedStyle(nameText) : null;
      return {
        inner: inner ? { ...rect(inner), scrollWidth: inner.scrollWidth, clientWidth: inner.clientWidth } : null,
        controls: found,
        name: nameText && ncs ? { ...rect(nameText), textOverflow: ncs.textOverflow, overflow: ncs.overflow } : null,
      };
    });
    const controlIds = ["back", "hp", "ac", "menu"];
    for (const id of controlIds) if (!controls.controls[id]) fail(`the phone header has no ${id} control (data-testid="sheet-header-${id}")`);
    if (controlIds.every((id) => controls.controls[id])) {
      for (const id of controlIds) {
        const c = controls.controls[id];
        if (Math.abs(c.height - 48) > 1) fail(`the ${id} header control is ${Math.round(c.height * 10) / 10}px tall, not 48dp ±1`);
      }
      const centres = controlIds.map((id) => controls.controls[id].centreY);
      if (Math.max(...centres) - Math.min(...centres) > 1)
        fail(`the header controls' vertical centres span ${Math.round((Math.max(...centres) - Math.min(...centres)) * 10) / 10}px, not one shared centre ±1`);
      if (width === 320 && controls.inner) {
        for (const id of controlIds) {
          const c = controls.controls[id];
          if (c.left < controls.inner.left - 1 || c.right > controls.inner.right + 1)
            fail(`at 320 the ${id} control overflows the header row (${Math.round(c.left)}..${Math.round(c.right)} of row ${Math.round(controls.inner.left)}..${Math.round(controls.inner.right)})`);
        }
        if (controls.inner.scrollWidth > controls.inner.clientWidth + 1)
          fail(`at 320 the header row overflows by ${controls.inner.scrollWidth - controls.inner.clientWidth}px`);
      }
      if (!controls.name) fail("the header name is missing");
      else {
        if (controls.name.textOverflow !== "ellipsis" || controls.name.overflow !== "hidden")
          fail(`the header name lost its ellipsis clipping (text-overflow: ${controls.name.textOverflow}, overflow: ${controls.name.overflow})`);
        if (controls.inner && controls.name.right > controls.inner.right + 1)
          fail(`the header name overflows the row (right ${Math.round(controls.name.right)} over row right ${Math.round(controls.inner.right)})`);
      }
    }
    for (const action of chrome.actions) if (action.visibleNow) fail(`"${action.label}" is visible in the phone header before the menu opens`);
    if (chrome.button) {
      if (!chrome.bar) fail("cannot check the dice button against a missing bar");
      else if (chrome.button.bottom > chrome.bar.top + 1)
        fail(`the dice button covers the tab bar (button bottom ${Math.round(chrome.button.bottom)} over bar top ${Math.round(chrome.bar.top)})`);
    } else fail("no floating dice button on the sheet");
    // The menu holds Level up and Edit Build as 48dp rows.
    await page.getByLabel("Sheet menu").first().click();
    await page.waitForSelector('[role="dialog"]', { state: "visible", timeout: 10000 }).catch(() => fail("the sheet menu did not open"));
    const menuRows = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return [];
      return ["Level up", "Edit Build"].map((label) => {
        const el = [...dialog.querySelectorAll('[role="button"]')].find((b) => b.getAttribute("aria-label") === label);
        return { label, height: el ? el.getBoundingClientRect().height : null };
      });
    });
    for (const row of menuRows) {
      if (row.height === null) fail(`the sheet menu has no "${row.label}" row`);
      else if (row.height < 47.5) fail(`the menu's "${row.label}" row is ${Math.round(row.height)}px tall, under 48dp`);
    }
    // No button in the sheet header, or in the open menu, may contain another button.
    for (const v of await page.evaluate(findNestedButtonViolations, '[data-testid="sheet-header"]')) fail(`nested button in the sheet header: ${v}`);
    for (const v of await page.evaluate(findNestedButtonViolations, '[role="dialog"]')) fail(`nested button in the sheet menu: ${v}`);
    await page.keyboard.press("Escape");
    await page.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 10000 }).catch(() => fail("Escape did not close the sheet menu"));

    // The bar's height must be re-reported when the sheet regains focus: open Level up from the menu, go
    // back, and the dice button must sit at or above the bar's top again (a pushed screen resets the
    // obstruction to 0 when it pops).
    await page.getByLabel("Sheet menu").first().click();
    await page.getByLabel("Level up").first().click();
    await page.waitForURL(/\/levelup\//, { timeout: 15000 }).catch(() => fail("Level up did not open the Level-Up Flow"));
    await settle(page);
    await page.goBack();
    await page.getByText(/hit points/i).first().waitFor({ state: "visible", timeout: 15000 }).catch(() => fail("the sheet did not come back from Level up"));
    await settle(page);
    const afterBack = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="sheet-tab-bar"]');
      const button = document.querySelector('[data-testid="dice-button"]');
      if (!bar || !button) return null;
      return { barTop: bar.getBoundingClientRect().top, buttonBottom: button.getBoundingClientRect().bottom };
    });
    if (!afterBack) fail("no tab bar or dice button on the sheet after returning from Level up");
    else if (afterBack.buttonBottom > afterBack.barTop + 1)
      fail(`after returning from Level up the dice button covers the tab bar (button bottom ${Math.round(afterBack.buttonBottom)} over bar top ${Math.round(afterBack.barTop)})`);
  } else {
    if (chrome.bar) fail("the wide sheet still shows the phone bottom tab bar");
    if (!chrome.rail) fail("no left rail (data-testid=\"sheet-tab-rail\") at a wide width");
    else {
      for (const tab of chrome.tabs) {
        if (tab.missing) fail(`the rail has no "${tab.label}" tab`);
        else if (tab.rect.height < 47.5) fail(`the rail's "${tab.label}" tab is ${Math.round(tab.rect.height)}px tall, under 48dp`);
      }
      for (const action of chrome.actions) {
        if (!action.present) fail(`the rail has no "${action.label}" action`);
        else if (action.rect.height < 47.5) fail(`the rail's "${action.label}" action is ${Math.round(action.rect.height)}px tall, under 48dp`);
      }
    }
    if (chrome.menuCount !== 0) fail("the wide header still shows the phone menu button");
    if (chrome.headerHeight === null || chrome.headerHeight > 96) fail(`the wide header is ${chrome.headerHeight === null ? "missing" : Math.round(chrome.headerHeight) + "px tall"}, not one slim bar`);
    // Stats in two columns.
    const cols = await page.evaluate(() => {
      const side = document.querySelector('[data-testid="stats-col-side"]');
      const main = document.querySelector('[data-testid="stats-col-main"]');
      if (!side || !main) return null;
      const a = side.getBoundingClientRect();
      const b = main.getBoundingClientRect();
      return { side: { left: a.left, right: a.right, top: a.top, width: a.width }, main: { left: b.left, right: b.right, top: b.top, width: b.width } };
    });
    if (!cols) fail("the wide Stats tab is not split into its two columns (stats-col-side / stats-col-main)");
    else {
      if (cols.side.width <= 0 || cols.main.width <= 0) fail("one of the wide Stats columns has no width");
      if (cols.side.right > cols.main.left + 1) fail(`the Stats columns overlap (side right ${Math.round(cols.side.right)} over main left ${Math.round(cols.main.left)})`);
      if (Math.abs(cols.side.top - cols.main.top) > 2) fail(`the Stats columns do not start on the same row (tops ${Math.round(cols.side.top)} and ${Math.round(cols.main.top)})`);
    }
    if (chrome.scrollW > chrome.vw + 1) fail(`the wide sheet scrolls sideways by ${chrome.scrollW - chrome.vw}px`);
  }

  // The Stats roll badges: centred in their card and sized to their content, at every width.
  const badges = await page.evaluate(() => {
    const cards = ["str", "dex", "con", "int", "wis", "cha"].map((k) => ({
      name: k,
      card: document.querySelector(`[data-testid="ability-tile-${k}"]`),
      badge: document.querySelector(`[data-testid="roll-badge-check-${k}"]`),
    }));
    cards.push({
      name: "initiative",
      card: document.querySelector('[data-testid="stat-box-initiative"]'),
      badge: document.querySelector('[data-testid="roll-badge-initiative"]'),
    });
    return cards.map(({ name, card, badge }) => {
      if (!card || !badge) return { name, missing: true };
      const cr = card.getBoundingClientRect();
      const br = badge.getBoundingClientRect();
      const cs = getComputedStyle(badge);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const borderY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      const contentH = Math.max(0, ...[...badge.children].map((c) => c.getBoundingClientRect().height));
      return {
        name,
        centerOff: Math.abs((br.left + br.right) / 2 - (cr.left + cr.right) / 2),
        height: br.height,
        contentPlusPad: contentH + padY + borderY,
      };
    });
  });
  for (const b of badges) {
    if (b.missing) {
      fail(`no ${b.name} Stats card or roll badge to measure`);
      continue;
    }
    if (b.centerOff > 2) fail(`the ${b.name} roll badge is ${Math.round(b.centerOff * 10) / 10}px off its card's centre axis`);
    if (b.height > b.contentPlusPad + 1)
      fail(`the ${b.name} roll badge is ${Math.round(b.height)}px tall, over its content plus padding (${Math.round(b.contentPlusPad)}px)`);
  }

  // The header's race/class line: on phones race • class and level (no size), whole; at 768px and up the
  // full line with the size. Neither may be truncated at any width.
  const headerLine = await page.evaluate(() => {
    const header = document.querySelector('[data-testid="sheet-header"]');
    if (!header) return null;
    const leaves = [...header.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 0);
    const sub = leaves.find((e) => e.textContent.includes("•"));
    if (!sub) return null;
    return { text: sub.textContent.trim(), sw: sub.scrollWidth, cw: sub.clientWidth };
  });
  if (!headerLine) fail("the sheet header's race/class line is missing");
  else {
    if (width < 768) {
      if (!/• Paladin 1$/.test(headerLine.text)) fail(`the phone header line is "${headerLine.text}", expected it to end with the class level ("• Paladin 1")`);
      if (/Medium/.test(headerLine.text)) fail(`the phone header line still shows the size: "${headerLine.text}"`);
    } else if (!/• Paladin 1 • Medium$/.test(headerLine.text)) fail(`the wide header line is "${headerLine.text}", expected the full line with the size`);
    if (headerLine.sw > headerLine.cw + 1)
      fail(`the header race/class line is truncated at ${width}px (${headerLine.sw}px of text in ${headerLine.cw}px): "${headerLine.text}"`);
  }

  // The four combat stat cards: four across, or 2x2 when the row is too narrow for four - never a 3+1 wrap -
  // with every label on one line and unclipped.
  const quads = await page.evaluate(() => {
    const ids = ["stat-box-ac", "stat-box-initiative", "stat-box-speed", "stat-box-proficiency"];
    return ids.map((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return { id, missing: true };
      const r = el.getBoundingClientRect();
      const label = [...el.querySelectorAll("*")].find((e) => e.children.length === 0 && /^[A-Z ]{4,}$/.test(e.textContent.trim()));
      return {
        id,
        top: r.top,
        width: r.width,
        labelSW: label ? label.scrollWidth : null,
        labelCW: label ? label.clientWidth : null,
        labelH: label ? label.getBoundingClientRect().height : null,
      };
    });
  });
  if (quads.some((q) => q.missing)) fail("missing one of the four combat stat boxes (stat-box-ac / -initiative / -speed / -proficiency)");
  else {
    const rows = new Map();
    for (const q of quads) {
      const key = Math.round(q.top);
      rows.set(key, (rows.get(key) ?? 0) + 1);
    }
    const pattern = [...rows.values()].sort((a, b) => b - a);
    const ok = (pattern.length === 1 && pattern[0] === 4) || (pattern.length === 2 && pattern[0] === 2 && pattern[1] === 2);
    if (!ok) fail(`the four stat cards lay out ${pattern.join("+")} at ${width}px, expected 4 across or 2x2, never 3+1`);
    for (const q of quads) {
      if (q.labelSW !== null && q.labelSW > q.labelCW + 1) fail(`the ${q.id} label is clipped (${q.labelSW}px of text in ${q.labelCW}px)`);
      if (q.labelH !== null && q.labelH > 14) fail(`the ${q.id} label wraps to ${Math.round(q.labelH)}px, over one 9px line`);
    }
  }

  // The rest button's label is "Take Rest" on one line (the short/long choice lives in the modal).
  const rest = await page.evaluate(() => {
    const leaves = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 0);
    const restLabel = leaves.find((e) => /Take Rest/.test(e.textContent));
    const condLabel = leaves.find((e) => /^Conditions \(/.test(e.textContent.trim()));
    if (!restLabel) return null;
    return { text: restLabel.textContent.trim(), h: restLabel.getBoundingClientRect().height, condH: condLabel ? condLabel.getBoundingClientRect().height : null };
  });
  if (!rest) fail("no Take Rest button on the Stats tab");
  else {
    if (rest.text !== "Take Rest") fail(`the rest button's label is "${rest.text}", expected "Take Rest"`);
    if (rest.condH !== null && rest.h > rest.condH + 2) fail(`the rest button's label wraps to ${Math.round(rest.h)}px at ${width}px, over the one-line "Conditions" label (${Math.round(rest.condH)}px)`);
  }

  await maybeShot(page, join(SHOTS, `SheetChrome-${width}.png`), meta);
  await closePage(page);
  return failures;
}

// Home at one width: a single-column list on phones, a multi-column card grid at 768px and up, no HP badge on
// any entry, and every finished entry carrying its Lvl badge (drafts read "Draft · <step>").
async function checkHomeLayout(ctx, width, meta) {
  const page = await ctx.newPage();
  const prefix = `[${width}px home layout]`;
  let failures = 0;
  let failedShotTaken = false;
  const fail = (msg) => {
    failures++;
    console.log(`${prefix} ${msg}`);
    if (!failedShotTaken) {
      failedShotTaken = true;
      shotFailed(page, meta, width);
    }
  };
  await gotoApp(page, `${BASE}/`);
  await page.getByText(/5e Character Builder/).first().waitFor({ state: "visible", timeout: 10000 });
  // The entry list renders after the header: wait for the first entry before measuring the layout.
  await page.locator('[data-testid^="home-entry-"]').first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});

  const layout = await page.evaluate(() => {
    const entries = [...document.querySelectorAll('[data-testid^="home-entry-"]')].map((el) => {
      const r = el.getBoundingClientRect();
      const leaves = [...el.querySelectorAll("*")].filter((e) => e.children.length === 0);
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        width: r.width,
        hasLvl: leaves.some((e) => /^Lvl \d+$/.test(e.textContent.trim())),
        isDraft: leaves.some((e) => /^Draft · /.test(e.textContent.trim())),
      };
    });
    const hpBadge = [...document.querySelectorAll("*")].some(
      (e) => e.children.length === 0 && /^HP: /.test(e.textContent.trim()) && e.getBoundingClientRect().height > 0,
    );
    return { entries, hpBadge, vw: window.innerWidth };
  });

  // No button on Home may contain another button (the entry cards' action buttons must be siblings of the
  // entry's main region, not children of it).
  for (const v of await page.evaluate(findNestedButtonViolations, "")) fail(`nested button on Home: ${v}`);

  if (layout.entries.length < 2) fail(`only ${layout.entries.length} home entries found, expected several`);
  if (layout.hpBadge) fail("a home entry still shows an HP badge");
  for (const [i, entry] of layout.entries.entries()) {
    if (!entry.isDraft && !entry.hasLvl) fail(`home entry ${i} is finished but carries no Lvl badge`);
    if (entry.isDraft && entry.hasLvl) fail(`home entry ${i} is a draft but carries a Lvl badge`);
  }
  if (width < 768) {
    const first = layout.entries[0];
    for (const [i, entry] of layout.entries.entries()) {
      if (Math.abs(entry.left - first.left) > 2) fail(`home entry ${i} is not in the single list column (left ${Math.round(entry.left)} vs ${Math.round(first.left)})`);
      if (entry.width < (layout.vw - 32) * 0.75) fail(`home entry ${i} is only ${Math.round(entry.width)}px wide, not a full-width list row`);
    }
  } else {
    const gridPair = layout.entries.some((a, i) =>
      layout.entries.some((b, j) => j > i && Math.abs(a.top - b.top) <= 2 && Math.abs(a.left - b.left) > 20),
    );
    if (!gridPair) fail("no two home entries share a row: the wide Home is not a grid");
    // Every card keeps its column width: a lone last card must not grow to full width.
    const widths = [...new Set(layout.entries.map((e) => Math.round(e.width)))];
    if (widths.length > 1 && Math.max(...widths) - Math.min(...widths) > 2)
      fail(`the wide grid's entries have unequal widths (${widths.join(", ")}px): a lone last card grew past its column`);
    // The grid's outer edges are the search bar's: the first card of every row starts at the search
    // bar's left edge, the last card of a full row ends at its right edge (±1px), and the cards have
    // equal widths and equal gaps.
    const edges = await page.evaluate(() => {
      const search = document.querySelector('[data-testid="home-search-bar"]');
      const sr = search ? search.getBoundingClientRect() : null;
      const grids = [...document.querySelectorAll('[data-testid="home-grid"]')];
      const entries = [...document.querySelectorAll('[data-testid^="home-entry-"]')].map((el) => {
        const r = el.getBoundingClientRect();
        const grid = el.closest('[data-testid="home-grid"]');
        return { left: r.left, right: r.right, top: r.top, width: r.width, grid: grid ? grids.indexOf(grid) : -1 };
      });
      return { search: sr ? { left: sr.left, right: sr.right } : null, entries };
    });
    if (!edges.search) fail('no search bar (data-testid="home-search-bar") to align the grid against');
    else {
      const cols = width >= 1200 ? 3 : 2;
      const cardWidths = edges.entries.map((e) => e.width);
      if (cardWidths.length > 1 && Math.max(...cardWidths) - Math.min(...cardWidths) > 1)
        fail(`the wide grid's cards have unequal widths (${Math.round(Math.min(...cardWidths))}..${Math.round(Math.max(...cardWidths))}px)`);
      const grids = new Map();
      for (const e of edges.entries) {
        if (!grids.has(e.grid)) grids.set(e.grid, []);
        grids.get(e.grid).push(e);
      }
      const gaps = [];
      for (const entries of grids.values()) {
        const rows = new Map();
        for (const e of entries) {
          const key = [...rows.keys()].find((k) => Math.abs(k - e.top) <= 2);
          if (key === undefined) rows.set(e.top, [e]);
          else rows.get(key).push(e);
        }
        for (const row of rows.values()) {
          row.sort((a, b) => a.left - b.left);
          if (Math.abs(row[0].left - edges.search.left) > 1)
            fail(`a grid row's first card starts ${Math.round(row[0].left - edges.search.left)}px away from the search bar's left edge (${Math.round(row[0].left)} vs ${Math.round(edges.search.left)})`);
          if (row.length === cols && Math.abs(row[row.length - 1].right - edges.search.right) > 1)
            fail(`a full grid row's last card ends ${Math.round(row[row.length - 1].right - edges.search.right)}px away from the search bar's right edge (${Math.round(row[row.length - 1].right)} vs ${Math.round(edges.search.right)})`);
          for (let i = 1; i < row.length; i++) gaps.push(row[i].left - row[i - 1].right);
        }
      }
      if (gaps.length > 1 && Math.max(...gaps) - Math.min(...gaps) > 1)
        fail(`the wide grid's gaps are unequal (${Math.round(Math.min(...gaps))}..${Math.round(Math.max(...gaps))}px)`);
    }
  }
  await maybeShot(page, join(SHOTS, `HomeLayout-${width}.png`), meta);
  await closePage(page);
  return failures;
}

// The checks that open their own page rather than a SCREENS entry. Each is a scenario, so ONLY selects it by name.
const EXTRA_CHECKS = [
  { name: "HP modals", run: checkHitPointModals },
  { name: "Wild Shape Stats", run: checkWildShapeScreen },
  { name: "Wild Shape Features", run: checkWildShapeFeatures },
  { name: "Modal closing", run: checkModalClosing },
  { name: "New character draft folder", run: checkDraftFolder },
  { name: "Dice tray and Roll Log", run: checkDiceTrayAndLog, shot: true },
  { name: "Level-Up Flow HP roll logged", run: checkLevelUpHpRollLogged },
  { name: "Level-Up Flow HP state", run: checkLevelUpHpState },
  { name: "Level-Up Flow HP per class", run: checkLevelUpHpPerClass },
  { name: "Level-Up Flow feat replace", run: checkLevelUpFeatReplace },
  { name: "Level-Up Flow feat sub-choice chips", run: checkLevelUpFeatSubChoiceChips },
  { name: "Level-Up Flow HP modifier sign", run: checkLevelUpHpModifierSign },
  { name: "Level up hidden at level 20", run: checkLevelUpHiddenAtMaxLevel },
  { name: "Level-Up Flow cancel and review", run: checkLevelUpCancelAndReview },
  { name: "Spells after level-up", run: checkSpellsAfterLevelUp },
  { name: "Dice animation", run: checkDiceAnimation },
  { name: "Sheet chrome", run: checkSheetChrome },
  { name: "Home layout", run: checkHomeLayout },
  { name: "Actions rolls", run: checkActionRolls },
  { name: "Stats rolls", run: checkStatsRolls },
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
  const startedAt = Date.now();
  const ctx = await browser.newContext({ viewport: { width, height: 851 }, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
  // React logs "<button> cannot contain a nested <button>" as a console error when a pressable with a
  // button role wraps another one; collect those from every page of this width and fail the run on them.
  // Each entry names the page URL: the page may be closed by the time the run reports it, so no screenshot.
  const nestedConsoleErrors = [];
  ctx.on("page", (page) => {
    page.on("console", (msg) => {
      if (msg.type() === "error" && /cannot contain a nested/i.test(msg.text())) {
        nestedConsoleErrors.push({ text: msg.text().slice(0, 120), url: page.url() });
      }
    });
  });
  try {
    await ctx.addInitScript(seedBrowser, seed);
    let failures = await checkScreens(ctx, width);
    for (const check of EXTRA_CHECKS) if (selected(check.name)) failures += await check.run(ctx, width, check);
    const seen = new Set();
    for (const { text, url } of nestedConsoleErrors) {
      if (seen.has(text)) continue;
      seen.add(text);
      failures++;
      console.log(`[${width}px] console error: ${text} (page ${url})`);
    }
    return failures;
  } finally {
    // Failure screenshots still being written are awaited before the context they belong to closes.
    await Promise.allSettled([...failureShotsPending]);
    await ctx.close();
    console.log(`[${width}px] checks done in ${Math.round((Date.now() - startedAt) / 1000)}s`);
  }
}

// Runs every check at every width, MAX_PARALLEL widths at a time (a pool, so a width's context is closed before
// the next one opens). Returns the number of violations.
async function runChecks(browser) {
  const seed = buildSeed({ root: ROOT, integrated: INTEGRATED });
  ACTIVE_SEED = seed;
  const queue = [...WIDTHS];
  let failures = 0;
  const worker = async () => {
    while (queue.length > 0) failures += await checkWidth(browser, seed, queue.shift());
  };
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, WIDTHS.length) }, worker));
  return failures;
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
    // --prod checks the export it builds, so another server on BASE would be tested instead of the export.
    if (!DEV) {
      console.error(`Something already answers at ${BASE}. --prod needs the port free: stop that server or set BASE to another URL.`);
      return 2;
    }
    console.log(`Using the server already running at ${BASE}. If it started before your latest code change it may be stale; stop it and rerun to test fresh code.`);
  } else {
    console.log(`Starting ${DEV ? "the Expo web dev server" : "a static server over a fresh production export"} on port ${PORT} (log: ${logPath}).`);
    const state = await startServer(logPath);
    if (state !== "up") {
      console.error(
        state === "exited"
          ? `The server stopped before it answered 200 at ${BASE}. Server log: ${logPath}`
          : `No server answered 200 at ${BASE} within ${SERVER_WAIT_MS / 1000} s. Server log: ${logPath}`,
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
process.on("exit", () => signalChildGroups("SIGKILL"));

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
