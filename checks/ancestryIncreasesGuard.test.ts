import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The one combining module (src/rules/ancestryIncreases.ts) is the only code under src/ that reads a race's or
// subrace's `abilityScoreIncrease`. A subrace that replaces its race's increases must give only its own, and a
// reader that sums the two itself would stack them again. Feat records are not race data and are exempt.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const MODULE = "rules/ancestryIncreases.ts";

/** Legitimate reads outside the module, per file, with the reason. An entry must still match a read, or it is stale. */
const ALLOWANCES: { file: string; reason: string }[] = [
  {
    file: "rules/leveling.ts",
    reason: "a feat's ability increase, which is not race data (spec: feat records are exempt)",
  },
];

/** A read of the field: a property access, a quoted key, or a destructuring of it. */
const READ_PATTERNS: RegExp[] = [
  /\.abilityScoreIncrease\b/,
  /["']abilityScoreIncrease["']/,
  /\{[^{}]*\babilityScoreIncrease\b[^{}]*\}\s*=/,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** The source without comments, so that a doc comment naming the field is not a read. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " ")).replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");
}

function readsIn(source: string): number[] {
  const lines = codeOnly(source).split("\n");
  return lines.flatMap((line, index) => (READ_PATTERNS.some((pattern) => pattern.test(line)) ? [index + 1] : []));
}

test("only the combining module reads a race's or subrace's abilityScoreIncrease under src/", () => {
  const readers = new Map<string, number[]>();
  for (const path of sourceFiles(SRC)) {
    const file = relative(SRC, path).split(sep).join("/");
    if (file === MODULE) continue;
    const lines = readsIn(readFileSync(path, "utf8"));
    if (lines.length > 0) readers.set(file, lines);
  }

  const unlisted = [...readers.entries()].filter(([file]) => !ALLOWANCES.some((allowed) => allowed.file === file));
  assert.deepEqual(
    unlisted.map(([file, lines]) => `${file}:${lines.join(",")}`),
    [],
    "these files read a race's or subrace's abilityScoreIncrease outside rules/ancestryIncreases.ts",
  );

  const stale = ALLOWANCES.filter((allowed) => !readers.has(allowed.file)).map((allowed) => allowed.file);
  assert.deepEqual(stale, [], "these allowances no longer match a read and must be removed");
});
