// Helpers for driving the app in a browser: start and stop the Expo web server, seed the browser's storage with
// characters and the catalog, and read catalog records by name. layout-check.mjs and debugging scripts import them.
// See docs/agents/driving-the-app.md.
import fs from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { REQUIRED_CATALOG_FORMAT } from "../../src/services/compendiumStorage.ts";

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// HTTP status of `url`, or 0 when nothing answers.
export async function httpStatus(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    await res.body?.cancel();
    return res.status;
  } catch {
    return 0;
  }
}

// Starts `npx expo start --web --clear` on `port` with CI set (no reload prompts, no telemetry), logging to `logPath`.
// `--clear` drops Metro's cache, so a stale bundle cannot pass a check. The child runs in its own process group
// (detached), so signalExpoGroup reaches its children too. Returns the child; `child.exited` turns true when it ends.
export function spawnExpoWeb({ root, port, logPath }) {
  const fd = fs.openSync(logPath, "w");
  const child = spawn("npx", ["expo", "start", "--web", "--port", String(port), "--clear"], {
    cwd: root,
    env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  child.exited = false;
  child.on("exit", () => {
    child.exited = true;
  });
  child.on("error", () => {
    child.exited = true;
  });
  return child;
}

// Waits until `base` answers 200. Resolves "up" once it does, "exited" if the child ends first, "timeout" if `waitMs` runs out.
export async function waitForExpoWeb(child, base, waitMs) {
  const deadline = Date.now() + waitMs;
  while (!child.exited && Date.now() < deadline) {
    if ((await httpStatus(base)) === 200) return "up";
    await sleep(1000);
  }
  return child.exited ? "exited" : "timeout";
}

// Sends `signal` to the child's process group. A group that is already gone is not an error.
export function signalExpoGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    // The group is already gone.
  }
}

export function expoGroupAlive(child) {
  try {
    process.kill(-child.pid, 0);
    return true;
  } catch {
    return false;
  }
}

// SIGTERM to the group, up to 5 s to exit, then SIGKILL.
export async function stopExpoWeb(child) {
  if (!child) return;
  signalExpoGroup(child, "SIGTERM");
  for (let i = 0; i < 25 && expoGroupAlive(child); i++) await sleep(200);
  if (expoGroupAlive(child)) signalExpoGroup(child, "SIGKILL");
}

// Runs in the browser before the app loads (pass it to context.addInitScript with the seed as the argument).
// Seeds localStorage once per context and, when `s.integrated` is set, the IndexedDB catalog the app reads on launch.
export function seedBrowser(s) {
  if (localStorage.getItem("__seeded")) return;
  localStorage.setItem("@dnd5e_characters", JSON.stringify(s.characters));
  localStorage.setItem("@dnd5e_folders", JSON.stringify(s.folders));
  localStorage.setItem("@dnd5e_app_settings", JSON.stringify(s.settings));
  if (s.integrated) {
    const open = indexedDB.open("dnd5e_compendium_db", 2);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains("collections")) open.result.createObjectStore("collections");
    };
    open.onsuccess = () => {
      const tx = open.result.transaction("collections", "readwrite");
      tx.objectStore("collections").put(s.integrated, "@dnd5e_integrated_compendium");
    };
  }
  localStorage.setItem("__seeded", "1");
}

// The integrated catalog's collections, read from `root`/dnd5eToolsScrap/data. Conditions are optional.
export function integratedCollections(root) {
  const dir = join(root, "dnd5eToolsScrap", "data");
  const readScrapJson = (name) => JSON.parse(fs.readFileSync(join(dir, `${name}.json`), "utf8"));
  const hasConditions = fs.existsSync(join(dir, "conditions.json"));
  return {
    hasIntegratedCatalog: true,
    catalogFormat: REQUIRED_CATALOG_FORMAT,
    integratedAt: new Date().toISOString(),
    races: readScrapJson("races"),
    classes: readScrapJson("classes"),
    feats: readScrapJson("feats"),
    backgrounds: readScrapJson("backgrounds"),
    items: readScrapJson("items"),
    spells: readScrapJson("spells"),
    beasts: readScrapJson("beasts"),
    conditions: hasConditions ? readScrapJson("conditions") : [],
    optionsAndFeatures: readScrapJson("options_and_features"),
    books: readScrapJson("books"),
  };
}

// A reader over one catalog folder (`src/data` for the SRD Baseline, `dnd5eToolsScrap/data` for the integrated catalog).
// `catalogSource(collection, name)` is the source of the record named `name`, so seeded characters refer to records
// the app can find. It throws when the record is missing.
export function makeCatalogReader(catalogDir) {
  const cache = new Map();
  function records(collection) {
    if (!cache.has(collection)) {
      cache.set(collection, JSON.parse(fs.readFileSync(join(catalogDir, `${collection}.json`), "utf8")));
    }
    return cache.get(collection);
  }
  function catalogSource(collection, name) {
    const record = records(collection).find((r) => r.name === name);
    if (!record) throw new Error(`${name} is not in ${collection}.json (${catalogDir})`);
    return record.source;
  }
  return { records, catalogSource };
}
