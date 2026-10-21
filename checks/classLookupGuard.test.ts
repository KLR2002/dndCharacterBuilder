import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// A catalog class is identified by name and source (two classes can share a name). This guard scans src/
// for the two by-name shapes that resolve a catalog class from a name alone:
//   - a `.find` over a class list whose predicate reads `.name` (e.g. `listings.classes().find((c) => c.name === ...)`)
//   - a `.findClass(` call outside the services layer, where the Compendium's own lookup is exact-or-undefined
// Resolve a class entry with `findClassData` from rules/catalogs.ts instead. The allowlist names each remaining
// by-name lookup with its reason. A listed entry must still match a use, so a removed use takes its entry with it.
// The scan is line by line: a `.find` whose predicate sits on a later line is not seen.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const HELPER_FILE = "rules/catalogs.ts";
const SERVICES_FOLDER = "services/";

// The receiver must be a class list (`classes`, `allClasses`, `listings.classes()`), not `subclasses`.
const BY_NAME_FIND = /(?<!\w)(?:classes|[a-zA-Z]*Classes)(?:\(\))?\??\.find\(\s*\(?\s*(\w+)\s*\)?\s*=>.*\b\1\.name\b/;
const FIND_CLASS_CALL = /\.findClass\(/;

interface Allowance {
  file: string;
  /** Text the matched line must contain, so the entry stops matching when the use is removed. */
  line: string;
  reason: string;
}

const ALLOWANCES: Allowance[] = [
  {
    file: "rules/subclassChoiceTable.ts",
    line: "row.owner.className.toLowerCase()",
    reason:
      "a pointer row names its owner class by name only (ADR 0014 pointer rows carry no class source), so the row cannot pick between two same-named classes",
  },
];

interface Finding {
  file: string;
  text: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** The lookups on one line that resolve a catalog class without its source. */
function lookupsIn(line: string, file: string): boolean {
  if (file === HELPER_FILE) return false;
  if (BY_NAME_FIND.test(line)) return true;
  return !file.startsWith(SERVICES_FOLDER) && FIND_CLASS_CALL.test(line);
}

function findings(): Finding[] {
  return sourceFiles(SRC).flatMap((path) => {
    const file = relative(SRC, path).split("\\").join("/");
    return readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => lookupsIn(line, file))
      .map((text) => ({ file, text: text.trim() }));
  });
}

test("guard: the by-name class lookup patterns match the shapes they guard", () => {
  assert.ok(BY_NAME_FIND.test("const m = listings.classes().find((c) => c.name === \"Monk\");"));
  assert.ok(BY_NAME_FIND.test("const f = allClasses.find((cl) => cl.name.toLowerCase() === x);"));
  assert.ok(!BY_NAME_FIND.test("const h = character.classes.find((c) => c.className === name);"));
  assert.ok(!BY_NAME_FIND.test("const s = cls.subclasses.find((s) => s.name === name);"));
  assert.ok(FIND_CLASS_CALL.test("const cls = compendium.findClass(className);"));
});

test("guard: every by-name class lookup in src/ is allowlisted with a reason", () => {
  const found = findings();
  const unallowed = found.filter(
    (f) => !ALLOWANCES.some((a) => a.file === f.file && f.text.includes(a.line)),
  );
  assert.deepEqual(
    unallowed.map((f) => `${f.file}: ${f.text}`),
    [],
    "resolve the class entry with findClassData (rules/catalogs.ts), or allowlist the lookup with a reason",
  );
});

test("guard: every allowlisted lookup still matches a use", () => {
  const found = findings();
  const stale = ALLOWANCES.filter(
    (a) => !found.some((f) => f.file === a.file && f.text.includes(a.line)),
  );
  assert.deepEqual(
    stale.map((a) => `${a.file}: ${a.line}`),
    [],
    "a removed or changed lookup must take its allowlist entry out",
  );
});
