# Driving the app in a browser

How to start the Expo web build, seed a character and a catalog into the browser, and open the character. The code is in `scripts/lib/app-driver.mjs`, and `scripts/layout-check.mjs` uses it. Layout rules are in `CODING_STANDARDS.md` section 7.

## Where to run it

- Run browser work from a worktree under `.claude/worktrees/` or from the main checkout. Metro cannot resolve a symlinked `node_modules` from `/tmp`. Screenshot folders can still be under `/tmp`.
- In a new worktree, run `scripts/worktree.sh` first.

## Start the web build

- Start Expo through the script, never by hand. `spawnExpoWeb({ root, port, logPath })` runs `npx expo start --web --port <port> --clear` with `CI=1` and `EXPO_NO_TELEMETRY=1`, detached in its own process group. `waitForExpoWeb(child, base, waitMs)` resolves `"up"` once `base` answers 200. `stopExpoWeb(child)` sends SIGTERM and then SIGKILL to the group.
- Or run `npm run layout:check`, which starts and stops its own server on `BASE`. `WIDTHS` (comma-separated, default `393,360,320,412`) picks the widths, which run at the same time, and `ONLY` (comma-separated substrings, ignoring case) visits only the scenarios whose name contains one of them.
- Give each run its own port and its own screenshot folder (`BASE` and `SHOTS` for layout-check). Layout-check uses a server that already answers at `BASE`, and that server may be stale, so pick a free port.
- Stop what you started. Do not `pkill -f` with a pattern that appears in your own command line.

## Seed a character and a catalog

The app reads these keys when it launches:

| Where | Key | Value |
| --- | --- | --- |
| localStorage | `@dnd5e_characters` | JSON array of characters, built with `makeChar()` from `checks/testUtils.ts` |
| localStorage | `@dnd5e_folders` | `[]` |
| localStorage | `@dnd5e_app_settings` | `defaultSettings()` with `hasCompletedFirstRun: true` |
| IndexedDB `dnd5e_compendium_db` (v2), store `collections` | `@dnd5e_integrated_compendium` | `integratedCollections(root)`, integrated mode only |

- `seedBrowser(seed)` writes these. Pass it to `context.addInitScript(seedBrowser, seed)` before the first navigation. It runs once per browser context (`__seeded` marks it), so use a new context for each seed.
- Every record a character names must exist in the catalog. `makeCatalogReader(dir).catalogSource("races", "Human")` returns the record's source and throws when the record is missing. `dir` is `src/data` for the SRD Baseline and `dnd5eToolsScrap/data` for the integrated catalog.

## Open a character

- `await page.goto(`${base}/character/${id}`, { waitUntil: "networkidle", timeout: 120000 })`, then wait about 1.5 s for the first render.
- Tabs and subtabs are text: `page.getByText("Builder", { exact: true }).first().click()`, then `"Race"` and so on. Wait for a text the screen shows once it is ready (`ready` in `SCREENS` of layout-check).
- Home is `/`, settings are `/options`.

## Gotchas

- Scroll the target into view before a click made at coordinates (`page.mouse.click(x, y)`, as layout-check's `tapHeaderAdd` does): call `el.scrollIntoView({ block: "center" })`, then measure the rect. A coordinate click on an element outside the viewport lands on nothing, which reads as a false negative. `locator.click()` scrolls the element into view by itself.
- Run Expo through `spawnExpoWeb` or `npm run layout:check`, so the process group is stopped with the run.
- Give each run its own port and screenshot folder.
- Use phone widths as layout-check does: a viewport of 393 by 851, `deviceScaleFactor: 2`, `isMobile: true`, `hasTouch: true`. The layout widths are 320, 360, 393 and 412.

## Example

Put the script in `scripts/` (or another folder inside the worktree), so the relative imports resolve. Run it with `node --experimental-strip-types`.

```js
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { chromium } from "playwright";
import { makeChar, defaultSettings } from "../checks/testUtils.ts";
import { makeCatalogReader, seedBrowser, spawnExpoWeb, stopExpoWeb, waitForExpoWeb } from "./lib/app-driver.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8113; // pick a free port
const BASE = `http://localhost:${PORT}`;
const SHOTS = "/tmp/driving-the-app"; // pick a free folder
fs.mkdirSync(SHOTS, { recursive: true });

const { catalogSource } = makeCatalogReader(join(ROOT, "src", "data"));
const seed = {
  characters: [
    makeChar({
      id: "char_demo",
      name: "Demo",
      race: { name: "Human", source: catalogSource("races", "Human") },
      background: { name: "Acolyte", source: catalogSource("backgrounds", "Acolyte") },
      classes: [{ className: "Fighter", source: catalogSource("classes", "Fighter"), level: 1 }],
      currentHp: 12,
      startingGrantsApplied: true,
      backgroundGrantsApplied: true,
    }),
  ],
  folders: [],
  settings: { ...defaultSettings(), hasCompletedFirstRun: true },
  integrated: null,
};

const server = spawnExpoWeb({ root: ROOT, port: PORT, logPath: join(SHOTS, "expo-server.log") });
try {
  if ((await waitForExpoWeb(server, BASE, 180_000)) !== "up") throw new Error(`Expo web did not answer at ${BASE}`);
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(seedBrowser, seed);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/character/char_demo`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForTimeout(1500);
    await page.getByText("Builder", { exact: true }).first().click();
    await page.getByText("Race", { exact: true }).first().click();
    await page.getByText(/traits:/i).first().waitFor({ state: "visible", timeout: 10_000 });
    await page.screenshot({ path: join(SHOTS, "demo-race-393.png") });
  } finally {
    await browser.close();
  }
} finally {
  await stopExpoWeb(server);
}
```
