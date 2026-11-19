import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Book admission is answered by the Compendium's listings (ADR 0025). The rule itself lives in services/compendium.ts
// and rules/bookAdmission.ts, so neither is scanned. Everywhere else in src/rules, src/components and src/app, no line may:
//   - upper- or lower-case a value named like books (activeBooks, books, upperBooks)
//   - call .includes(, .some( or .has( on activeBooks
//   - name SRD_SOURCE or "SRD" (admission already admits SRD records; the sites that remain are listed below)
// Import lines are not scanned.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const SCANNED_FOLDERS = ["rules/", "components/", "app/"];
const RULE_OWNERS = ["rules/bookAdmission.ts"];

// A case call on a book value itself, or on each element of one: `books.toLowerCase()`, `activeBooks.map((b) => b.toUpperCase())`.
const CASE_OF_BOOKS = /\b(?:activeBooks|books|upperBooks)\s*\.\s*(?:toUpperCase|toLowerCase)\(|\b(?:activeBooks|books|upperBooks)\b[^\n]*=>\s*\w+\.(?:toUpperCase|toLowerCase)\(/;
const BOOK_SEARCH = /\bactiveBooks\s*(?:(?:\|\||\?\?)\s*\[\]\s*\)\s*)?\.(?:includes|some|has)\(/;
const SRD_NAME = /\bSRD_SOURCE\b|["']SRD["']/;
const IMPORT = /\bimport\s[\s\S]*?\sfrom\s*["'][^"']+["'];?|\bimport\s*["'][^"']+["'];?/g;

const RULES: { why: string; test: RegExp }[] = [
  { why: "cases a book value", test: CASE_OF_BOOKS },
  { why: "searches activeBooks by hand", test: BOOK_SEARCH },
  { why: "names the SRD source", test: SRD_NAME },
];

/**
 * A violation the guard tolerates: the file, a fragment of the trimmed line that it appears on, and why the line is not
 * book admission. Every entry must still match a line, so a removed site takes its entry with it.
 */
const ALLOW_LIST: { file: string; text: string; reason: string }[] = [
  {
    file: "rules/choices/fightingStyles.ts",
    text: "heldSourceOf(entry.source, heldClass(entry, classes) ?? { source: SRD_SOURCE })",
    reason: "A held class with no record in the catalog takes the SRD source for its Rule Choice ids. A source is named, not admitted.",
  },
  {
    file: "rules/proficiencySources/classBase.ts",
    text: "cls.source !== SRD_SOURCE && cls.source !== SRD_PRINTED_SOURCE",
    reason: "A grant built from an SRD or PHB class record takes the PHB id the Catalog's own grants use. It names a grant id, not admission.",
  },
  {
    file: "rules/proficiencySources/classBase.ts",
    text: "aliases: [`${SRD_SOURCE}/${rest}`]",
    reason: "The SRD-named id such a grant had before is kept as an alias, so a pick saved under it moves. A grant id, not admission.",
  },
  {
    file: "rules/srdNames.ts",
    text: "source === SRD_SOURCE ?",
    reason: "The SRD name migration renames only saves whose record is SRD-sourced. It decides which name a save takes, not admission.",
  },
  {
    file: "rules/subclassSpells.ts",
    text: "copies.find((s) => s.source !== SRD_SOURCE && listings.admits(s.source))",
    reason: "pickSpell prefers an active book's copy over an SRD copy. Admission is listings.admits; this is the preference order.",
  },
  {
    file: "rules/subclassSpells.ts",
    text: "copies.find((s) => s.source === SRD_SOURCE)",
    reason: "With activeOnly, pickSpell falls back to the SRD copy. The fallback order, not admission.",
  },
  {
    file: "rules/spellGrants.ts",
    text: "feat.source !== SRD_SOURCE",
    reason: "The feat ordering puts an active book's feat first. Admission is listings.admits; the SRD test is the ordering.",
  },
];

interface Violation {
  file: string;
  line: number;
  why: string;
  text: string;
}

/** The lines of one source file that break the rule. `file` is relative to src/, with forward slashes. */
function violationsIn(file: string, source: string): Violation[] {
  // Import statements are blanked, keeping the line count, so a named import of SRD_SOURCE is not a use.
  const code = source.replace(IMPORT, (statement) => statement.replace(/[^\n]/g, ""));
  return code.split("\n").flatMap((text, index) =>
    RULES.filter((rule) => rule.test.test(text)).map((rule) => ({
      file,
      line: index + 1,
      why: rule.why,
      text: text.trim(),
    })),
  );
}

function isAllowed(violation: Violation): boolean {
  return ALLOW_LIST.some((entry) => entry.file === violation.file && violation.text.includes(entry.text));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

function scannedSources(): { file: string; source: string }[] {
  return SCANNED_FOLDERS.flatMap((folder) => sourceFiles(join(SRC, folder)))
    .map((path) => ({ file: relative(SRC, path).split(sep).join("/"), source: readFileSync(path, "utf8") }))
    .filter(({ file }) => !RULE_OWNERS.includes(file));
}

function describe(violation: Violation): string {
  return `${violation.file}:${violation.line} ${violation.why}: ${violation.text}`;
}

test("guard, synthetic: a rule that lowers book codes by hand fails", () => {
  const offending = "const books = activeBooks.map((b) => b.toLowerCase());\n";
  assert.deepEqual(violationsIn("rules/synthetic.ts", offending).map(describe), [
    "rules/synthetic.ts:1 cases a book value: const books = activeBooks.map((b) => b.toLowerCase());",
  ]);
});

test("guard, synthetic: a component that searches activeBooks by hand fails, with or without the empty-list fallback", () => {
  assert.equal(violationsIn("components/Synthetic.tsx", "if (activeBooks.includes(\"VRGR\")) list.push(x);\n").length, 1);
  assert.equal(violationsIn("components/Synthetic.tsx", "(activeBooks || []).some((b) => b === \"MM\");\n").length, 1);
});

test("guard, synthetic: naming the SRD source fails, and an import of it does not", () => {
  assert.equal(violationsIn("rules/synthetic.ts", "if (record.source === SRD_SOURCE) return true;\n").length, 1);
  assert.equal(violationsIn("rules/synthetic.ts", "if (record.source === \"SRD\") return true;\n").length, 1);
  assert.deepEqual(violationsIn("rules/synthetic.ts", 'import { SRD_SOURCE } from "../constants/books.ts";\n'), []);
  assert.deepEqual(violationsIn("rules/synthetic.ts", "import {\n  SRD_SOURCE,\n  type ActiveBooks,\n} from \"../constants/books.ts\";\n"), []);
});

test("guard, synthetic: a listing that admits through the Compendium is not flagged", () => {
  const clean = [
    "const listed = catalogListings({ activeBooks }).admits(record.source);",
    "const upper = record.source.toUpperCase() === owner;",
    "const book = currentCompendium().for(activeBooks).spells();",
    "",
  ].join("\n");
  assert.deepEqual(violationsIn("rules/synthetic.ts", clean), []);
});

test("guard: no line of src/rules, src/components or src/app compares book codes by hand, outside the allow-list", () => {
  const found = scannedSources().flatMap(({ file, source }) => violationsIn(file, source)).filter((v) => !isAllowed(v));
  assert.deepEqual(found.map(describe), [], "admit a book through the Compendium's listings (admits) instead");
});

test("guard: every allow-list entry still matches a line, so a fixed site drops its entry", () => {
  const all = scannedSources().flatMap(({ file, source }) => violationsIn(file, source));
  const stale = ALLOW_LIST.filter((entry) => !all.some((v) => v.file === entry.file && v.text.includes(entry.text)));
  assert.deepEqual(stale.map((entry) => `${entry.file}: ${entry.text}`), []);
});

test("guard: every allow-list entry gives a reason", () => {
  for (const entry of ALLOW_LIST) {
    assert.ok(entry.reason.trim().length > 20, `${entry.file} needs a reason`);
  }
});

