// Responsive layout check for the builder (Class and Background subtabs) at phone widths,
// the hit point modal (opened from the Stats tab HP number and from the header HP badge), and the
// Active Wild Shape box (Stats tab, plus the header badge while a form is active, and the Features tab).
//
// Usage: `npm run layout:check` (not part of check:all). Needs the Expo web server running
// (`npx expo start --web --port 8099`) and, once, `npx playwright install chromium`.
//
// Fails (exit 1, one line per violation) on squeezed text and on elements that stick out of a
// non-scrolling parent. Env: BASE (default http://localhost:8099), WIDTHS (default "393,360,320,412"),
// SHOTS (screenshot dir, default a layout-check folder under the OS temp dir).
import { tmpdir } from "node:os";
import { join } from "node:path";
import fs from "node:fs";
import { chromium } from "playwright";
import { makeChar, defaultSettings } from "../checks/testUtils.ts";

const BASE = process.env.BASE ?? "http://localhost:8099";
const SHOTS = process.env.SHOTS ?? join(tmpdir(), "layout-check");
const WIDTHS = (process.env.WIDTHS ?? "393,360,320,412").split(",").map(Number);

try {
  await fetch(BASE);
} catch {
  console.error(`No dev server at ${BASE}. Start it with: npx expo start --web --port 8099`);
  process.exit(2);
}

// The character the builder shows: Half-Orc, Acolyte background, level 1 Paladin, equipment claimed.
const CHARACTER_ID = "char_rendar";
// A level 4 Druid in a Black Bear (SRD: AC 11, 19 HP), with the bear at 12 of 19 HP.
const DRUID_ID = "char_druid";
const seed = {
  characters: [
    makeChar({
      id: CHARACTER_ID,
      name: "Rendar",
      createdAt: 1,
      updatedAt: 1,
      race: { name: "Half-Orc", source: "PHB" },
      background: { name: "Acolyte", source: "PHB" },
      startingOption: "equipment",
      classes: [{ className: "Paladin", source: "PHB", level: 1 }],
      currentHp: 10,
      startingGrantsApplied: true,
      backgroundGrantsApplied: true,
    }),
    makeChar({
      id: DRUID_ID,
      name: "Mossa",
      createdAt: 2,
      updatedAt: 2,
      startingOption: "equipment",
      classes: [{ className: "Druid", source: "PHB", level: 4 }],
      currentHp: 14,
      startingGrantsApplied: true,
      backgroundGrantsApplied: true,
      activeWildShape: { name: "Black Bear", source: "SRD", ac: 11, currentHp: 12, maxHp: 19 },
    }),
  ],
  folders: [],
  settings: { ...defaultSettings(), hasCompletedFirstRun: true },
};

fs.mkdirSync(SHOTS, { recursive: true });
let browser;
try {
  browser = await chromium.launch();
} catch (error) {
  console.error(`Could not launch Chromium (${error.message.split("\n")[0]}).\nInstall it once with: npx playwright install chromium`);
  process.exit(2);
}
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
    const fontSize = parseFloat(getComputedStyle(el).fontSize) || 14;
    if (el.children.length === 0 && text.length >= 20 && r.height / (fontSize * 1.25) >= 5)
      out.push(`squeezed text (${Math.round(r.width)}px wide, ${Math.round(r.height)}px tall, ~${Math.round(r.height / (fontSize * 1.25))} lines): "${text.slice(0, 40)}"`);
    if (r.width === 0) continue;
    const p = el.parentElement;
    if (!p || scrollerX(p)) continue;
    let inScroller = false;
    for (let a = p; a; a = a.parentElement) if (scrollerX(a) && a !== document.documentElement && a !== document.body) { inScroller = true; break; }
    if (inScroller) continue;
    const pr = p.getBoundingClientRect();
    if (pr.width > 0 && r.right > pr.right + 1) out.push(`sticks out of its parent by ${Math.round(r.right - pr.right)}px: "${text.slice(0, 40)}"`);
  }
  return [...new Set(out)];
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

// Opens the wild shape HP box from one control, checks it (no violations, no Temp HP line), closes it.
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
    if (text.includes("Temp")) {
      failures++;
      console.log(`${prefix} modal shows a Temp HP line`);
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
  const controls = await page.evaluate(findWildShapeControls);
  failures += await checkWildShapeBox(page, controls.stats, `[${width}px wild shape box from Stats number]`, `WildShapeModal-${width}.png`);
  failures += await checkWildShapeBox(page, controls.header, `[${width}px wild shape box from header badge]`, `WildShapeModal-header-${width}.png`);
  await page.close();
  return failures;
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
  let failures = 0;
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

let failures = 0;
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 851 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript((s) => {
    if (localStorage.getItem("__seeded")) return;
    localStorage.setItem("@dnd5e_characters", JSON.stringify(s.characters));
    localStorage.setItem("@dnd5e_folders", JSON.stringify(s.folders));
    localStorage.setItem("@dnd5e_app_settings", JSON.stringify(s.settings));
    localStorage.setItem("__seeded", "1");
  }, seed);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/character/${CHARACTER_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  for (const [tab, scrollTo] of [["Class", "Starting Equipment"], ["Background", "Claim again"]]) {
    await page.getByText(tab, { exact: true }).first().click();
    await page.waitForTimeout(500);
    await page.evaluate((needle) => {
      const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && (e.textContent || "").includes(needle));
      el?.scrollIntoView({ block: "center" });
    }, scrollTo);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOTS, `${tab}-${width}.png`) });
    const violations = await page.evaluate(findLayoutViolations, null);
    for (const v of violations) {
      failures++;
      console.log(`[${width}px ${tab}] ${v}`);
    }
  }
  // Screenshot only (no assertion): the Temp HP input lives on the Stats tab.
  await page.getByText("Stats", { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, `Stats-${width}.png`) });
  // Open the hit point modal from the Stats HP number, then from the header badge, and check each.
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
  failures += await checkWildShapeScreen(ctx, width);
  failures += await checkWildShapeFeatures(ctx, width);
  await ctx.close();
}
await browser.close();
console.log(failures === 0 ? "GREEN: no layout violations" : `RED: ${failures} violations`);
process.exit(failures === 0 ? 0 : 1);
