import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The beast browser lists beasts through getBeasts in services/dataService.ts, which reads the active Compendium.
// This guard scans src/ for two ways to read the beast list without that path:
//   - an import of the bundled src/data/beasts.json (the SRD Baseline's beasts)
//   - a `.beasts()` call on a Compendium listing outside services/
// services/compendium.ts owns the bundle and is the only file that imports it.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const BROWSER = "components/WildShapeModal.tsx";
const BUNDLE_OWNER = "services/compendium.ts";
const SERVICES_FOLDER = "services/";

const BUNDLE_IMPORT = /["'][^"']*\bdata\/beasts\.json["']/;
const LISTING_CALL = /\.beasts\(\)/;
const GET_BEASTS_IMPORT = /import\s*\{[^}]*\bgetBeasts\b[^}]*\}\s*from\s*["']\.\.\/services\/dataService(\.ts)?["']/;
const GET_BEASTS_CALL = /\bgetBeasts\(/;

interface SourceFile {
  file: string;
  source: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

function treeSources(): SourceFile[] {
  return sourceFiles(SRC).map((path) => ({
    file: relative(SRC, path).split(sep).join("/"),
    source: readFileSync(path, "utf8"),
  }));
}

/** The reads of beast data in one file that skip getBeasts. `file` is relative to src/, with forward slashes. */
function bypassesIn(file: string, source: string): string[] {
  return source.split("\n").flatMap((text, index) => {
    const reads: string[] = [];
    if (BUNDLE_IMPORT.test(text) && file !== BUNDLE_OWNER) reads.push("imports the bundled beasts");
    if (LISTING_CALL.test(text) && !file.startsWith(SERVICES_FOLDER)) reads.push("reads a Compendium beast listing");
    return reads.map((why) => `${file}:${index + 1} ${why}: ${text.trim()}`);
  });
}

test("guard, synthetic: a component that imports the bundled beasts fails", () => {
  const offending = [
    'import beasts from "../data/beasts.json" with { type: "json" };',
    "export const allBeasts = beasts as BeastData[];",
    "",
  ].join("\n");
  assert.deepEqual(bypassesIn("components/Synthetic.tsx", offending), [
    'components/Synthetic.tsx:1 imports the bundled beasts: import beasts from "../data/beasts.json" with { type: "json" };',
  ]);
});

test("guard, synthetic: a rule that reads a Compendium beast listing fails", () => {
  const offending = "const beasts = currentCompendium().for(activeBooks).beasts();\n";
  assert.deepEqual(bypassesIn("rules/synthetic.ts", offending), [
    "rules/synthetic.ts:1 reads a Compendium beast listing: const beasts = currentCompendium().for(activeBooks).beasts();",
  ]);
});

test("guard, synthetic: a component that lists beasts through getBeasts is not flagged", () => {
  const clean = [
    'import { getBeasts } from "../services/dataService.ts";',
    "const allBeasts = useMemo(() => getBeasts(activeBooks), [activeBooks]);",
    "",
  ].join("\n");
  assert.deepEqual(bypassesIn("components/Synthetic.tsx", clean), []);
});

test("guard, synthetic: the Compendium owner and the services layer are not flagged", () => {
  const owner = 'import beastsRaw from "../data/beasts.json" with { type: "json" };\n';
  const facade = "return currentCompendium().for(activeBooks).beasts();\n";
  assert.deepEqual(bypassesIn(BUNDLE_OWNER, owner), []);
  assert.deepEqual(bypassesIn("services/dataService.ts", facade), []);
});

test("guard: only the Compendium owner imports the bundled beasts under src/", () => {
  const importers = treeSources()
    .filter(({ source }) => source.split("\n").some((line) => BUNDLE_IMPORT.test(line)))
    .map(({ file }) => file);
  assert.deepEqual(importers, [BUNDLE_OWNER], "only services/compendium.ts may import src/data/beasts.json");
});

test("guard: no file under src/ reads beasts around getBeasts", () => {
  const found = treeSources().flatMap(({ file, source }) => bypassesIn(file, source));
  assert.deepEqual(found, [], "list beasts through getBeasts (services/dataService.ts) instead");
});

test("guard: the beast browser lists its beasts through getBeasts", () => {
  const source = readFileSync(join(SRC, BROWSER), "utf8");
  assert.match(source, GET_BEASTS_IMPORT, `${BROWSER} must import getBeasts from services/dataService`);
  assert.match(source, GET_BEASTS_CALL, `${BROWSER} must list its beasts with getBeasts`);
});
