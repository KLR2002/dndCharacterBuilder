// Responsive layout check for the builder (Class and Background subtabs) at phone widths,
// plus the hit point modal that opens when the Stats tab HP number is tapped.
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
// Runs in the browser. Returns one message per layout violation. With `inHpModal`, only the open
// hit point modal is checked: the smallest ancestor of its Amount field that holds the title and the buttons.
function findLayoutViolations(inHpModal) {
  let nodes = document.querySelectorAll("*");
  if (inHpModal) {
    let modal = null;
    for (let a = document.querySelector('[aria-label="Amount"]'); a && !modal; a = a.parentElement) {
      const text = a.textContent || "";
      if (text.includes("Hit Points") && text.includes("Set to")) modal = a;
    }
    if (!modal) return ["hit point modal not found"];
    nodes = modal.querySelectorAll("*");
  }
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
    const violations = await page.evaluate(findLayoutViolations, false);
    for (const v of violations) {
      failures++;
      console.log(`[${width}px ${tab}] ${v}`);
    }
  }
  // Screenshot only (no assertion): the Temp HP input lives on the Stats tab.
  await page.getByText("Stats", { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, `Stats-${width}.png`) });
  // Tap the big HP number in the HIT POINTS card. The header badge has the same label, so pick the
  // control that sits under the HIT POINTS label.
  const hpIndex = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[aria-label="Change hit points"]')];
    const label = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "HIT POINTS");
    for (let a = label?.parentElement; a; a = a.parentElement) {
      const hit = all.find((el) => a.contains(el));
      if (hit) return all.indexOf(hit);
    }
    return -1;
  });
  if (hpIndex < 0) {
    failures++;
    console.log(`[${width}px HP modal] no "Change hit points" control under the HIT POINTS label`);
  } else {
    await page.locator('[aria-label="Change hit points"]').nth(hpIndex).click();
    await page.getByText("Set to", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(SHOTS, `HpModal-${width}.png`) });
    for (const v of await page.evaluate(findLayoutViolations, true)) {
      failures++;
      console.log(`[${width}px HP modal] ${v}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(failures === 0 ? "GREEN: no layout violations" : `RED: ${failures} violations`);
process.exit(failures === 0 ? 0 : 1);
