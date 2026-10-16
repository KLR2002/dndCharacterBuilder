import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// The rules layer takes a Compendium as a parameter. It must never reach the process-wide
// singleton helpers in services/dataService.ts (get*/find*/set/init/clear store functions).

const RULES_DIR = new URL("../src/rules/", import.meta.url).pathname;
const SINGLETON_MODULE = /services\/dataService(\.ts)?$/;

function ruleFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return ruleFiles(path);
    return entry.endsWith(".ts") ? [path] : [];
  });
}

function importsOf(source: string): string[] {
  const specifiers: string[] = [];
  const staticImport = /(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/g;
  const sideEffectImport = /import\s*["']([^"']+)["']/g;
  const dynamicImport = /import\(\s*["']([^"']+)["']\s*\)/g;
  for (const re of [staticImport, sideEffectImport, dynamicImport]) {
    for (const m of source.matchAll(re)) specifiers.push(m[1]);
  }
  return specifiers;
}

test("guard: no file under src/rules imports the singleton helpers from services/dataService", () => {
  const files = ruleFiles(RULES_DIR);
  assert.ok(files.length > 0, "the guard must find rules modules to check");

  const offenders = files.flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return importsOf(source)
      .filter((spec) => SINGLETON_MODULE.test(spec))
      .map((spec) => `${relative(RULES_DIR, file)} imports "${spec}"`);
  });

  assert.deepEqual(
    offenders,
    [],
    "rules modules must take a Compendium parameter instead of importing the singleton helpers",
  );
});
