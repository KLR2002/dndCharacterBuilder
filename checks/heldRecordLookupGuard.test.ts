import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// A held race, background or feat is identified by name, source and, for a race, subrace. Two books can share a
// name, so a by-name lookup over a race, background or feat list picks the wrong record. This guard scans src/ for a
// `.find` over such a list whose predicate reads `.name`, with the comments stripped first. Resolve the record with
// `findHeldRace` (races and their subraces) or `findHeldRecord` (other records) from rules/raceLookup.ts instead.
// The allowlist names each remaining by-name lookup with its reason. A listed entry must still match a use, so a
// removed use takes its entry with it. The scan is line by line: a `.find` whose predicate sits on a later line is not seen.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const HELPER_FILE = "rules/raceLookup.ts";
const SERVICES_FOLDER = "services/";

// The receiver is a race, background or feat list, case-insensitively: `races`, `allRaces`, `listings.races()`,
// `allBackgrounds`, `allFeats`, `listings.feats()`. A subrace list (`subraces`) is left out: findHeldRace resolves
// subraces within the race it resolves.
const HELD_RECORD_FIND = /(?<!\w)(?!sub)[a-z]*(?:races|backgrounds|feats)(?:\(\))?\??\.find\(\s*\(?\s*(\w+)\s*\)?\s*=>.*\b\1\.name\b/i;

interface Allowance {
  file: string;
  /** Text the matched line must contain, so the entry stops matching when the use is removed. */
  line: string;
  reason: string;
}

const ALLOWANCES: Allowance[] = [
  {
    file: "rules/choices/featSpells.ts",
    line: "listings.feats().find((feat) => slugOf(feat.name) === featSlug)?.name",
    reason:
      "a feat counter key holds only the feat's slug (a legacy id), so the migration finds the feat's catalog name by slug",
  },
  {
    file: "rules/choices/featSpells.ts",
    line: "listings.feats().find((feat) => slugOf(feat.name) === featSlug && feat.source === book)",
    reason:
      "a feat counter key holds only the feat's slug (a legacy id), so the migration matches the slug and the book it recovered for the feat",
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

/** The source with its comments blanked, line breaks kept so the lines still line up. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");
}

/** The trimmed lines of one file that look up a held record by name. The helper file and the services folder are exempt. */
function lookupLines(text: string, file: string): string[] {
  if (file === HELPER_FILE || file.startsWith(SERVICES_FOLDER)) return [];
  return stripComments(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => HELD_RECORD_FIND.test(line));
}

function findings(): Finding[] {
  return sourceFiles(SRC).flatMap((path) => {
    const file = relative(SRC, path).split("\\").join("/");
    return lookupLines(readFileSync(path, "utf8"), file).map((text) => ({ file, text }));
  });
}

test("guard: the by-name held record patterns match the shapes they guard", () => {
  assert.ok(HELD_RECORD_FIND.test("const f = allFeats.find((f) => f.name === asi.featName);"));
  assert.ok(HELD_RECORD_FIND.test("const bg = listings.backgrounds().find((b) => b.name === name);"));
  assert.ok(HELD_RECORD_FIND.test("const r = races?.find((r) => r.name.toLowerCase() === n);"));
  assert.ok(HELD_RECORD_FIND.test("const r = listings.races().find((race) => race.name === n);"));
  assert.ok(HELD_RECORD_FIND.test("const b = allBackgrounds.find((b) => b.name === character.background.name);"));
  assert.ok(!HELD_RECORD_FIND.test("const f = allFeats.find((f) => f.source === s);"));
  assert.ok(!HELD_RECORD_FIND.test("const s = race.subraces?.find((sub) => sub.name === name);"));
  assert.ok(!HELD_RECORD_FIND.test("const c = classes.find((c) => c.name === name);"));
});

test("guard: comments are stripped and the helper file and services are exempt", () => {
  const commented = [
    "// allFeats.find((f) => f.name === a)",
    "/* races.find((r) => r.name === b) */",
    "const c = 1; // backgrounds.find((b) => b.name === c)",
  ].join("\n");
  assert.deepEqual(lookupLines(commented, "rules/example.ts"), []);
  const lookup = "const r = races.find((r) => r.name === n);";
  assert.deepEqual(lookupLines(lookup, HELPER_FILE), []);
  assert.deepEqual(lookupLines(lookup, "services/compendium.ts"), []);
  assert.deepEqual(lookupLines(lookup, "rules/example.ts"), [lookup]);
});

test("guard: every allowlist entry carries a reason", () => {
  assert.deepEqual(
    ALLOWANCES.filter((a) => a.reason.trim() === "").map((a) => `${a.file}: ${a.line}`),
    [],
  );
});

test("guard: every by-name held record lookup in src/ is allowlisted with a reason", () => {
  const found = findings();
  const unallowed = found.filter(
    (f) => !ALLOWANCES.some((a) => a.file === f.file && f.text.includes(a.line)),
  );
  assert.deepEqual(
    unallowed.map((f) => `${f.file}: ${f.text}`),
    [],
    "resolve the record with findHeldRace or findHeldRecord (rules/raceLookup.ts), or allowlist the lookup with a reason",
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
