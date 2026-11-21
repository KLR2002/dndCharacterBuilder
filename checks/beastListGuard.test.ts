import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The beast browser lists beasts from the active Compendium: currentCompendium().for(activeBooks).beasts().
// services/compendium.ts owns the bundled src/data/beasts.json (the SRD Baseline's beasts) and is the only file
// that imports it, so no other file can list beasts around the active catalog.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const BROWSER = "components/WildShapeModal.tsx";
const BUNDLE_OWNER = "services/compendium.ts";

const BUNDLE_IMPORT = /["'][^"']*\bdata\/beasts\.json["']/;
const BEAST_LISTING = /currentCompendium\(\)\.for\(activeBooks\)\.beasts\(\)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

function treeSources(): { file: string; source: string }[] {
  return sourceFiles(SRC).map((path) => ({
    file: relative(SRC, path).split(sep).join("/"),
    source: readFileSync(path, "utf8"),
  }));
}

/** The lines of one file that import the bundled beasts. `file` is relative to src/, with forward slashes. */
function bundleImportsIn(file: string, source: string): string[] {
  if (file === BUNDLE_OWNER) return [];
  return source.split("\n").flatMap((text, index) =>
    BUNDLE_IMPORT.test(text) ? [`${file}:${index + 1} imports the bundled beasts: ${text.trim()}`] : [],
  );
}

test("guard, synthetic: a component that imports the bundled beasts fails", () => {
  const offending = [
    'import beasts from "../data/beasts.json" with { type: "json" };',
    "export const allBeasts = beasts as BeastData[];",
    "",
  ].join("\n");
  assert.deepEqual(bundleImportsIn("components/Synthetic.tsx", offending), [
    'components/Synthetic.tsx:1 imports the bundled beasts: import beasts from "../data/beasts.json" with { type: "json" };',
  ]);
});

test("guard, synthetic: a component that lists beasts through the Compendium is not flagged", () => {
  const clean = "const allBeasts = useMemo(() => currentCompendium().for(activeBooks).beasts(), [activeBooks]);\n";
  assert.deepEqual(bundleImportsIn("components/Synthetic.tsx", clean), []);
});

test("guard, synthetic: the Compendium owner is not flagged", () => {
  const owner = 'import beastsRaw from "../data/beasts.json" with { type: "json" };\n';
  assert.deepEqual(bundleImportsIn(BUNDLE_OWNER, owner), []);
});

test("guard: only the Compendium owner imports the bundled beasts under src/", () => {
  const importers = treeSources()
    .filter(({ source }) => source.split("\n").some((line) => BUNDLE_IMPORT.test(line)))
    .map(({ file }) => file);
  assert.deepEqual(importers, [BUNDLE_OWNER], "only services/compendium.ts may import src/data/beasts.json");
});

test("guard: the beast browser lists its beasts from the active Compendium", () => {
  const source = readFileSync(join(SRC, BROWSER), "utf8");
  assert.match(source, BEAST_LISTING, `${BROWSER} must list its beasts with currentCompendium().for(activeBooks).beasts()`);
});
