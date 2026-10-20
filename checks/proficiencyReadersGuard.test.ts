import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The Proficiency Sheet is the only reader of race, background and class proficiency fields (ADR 0015).
// This guard scans src/ for those field names and for imports of the sheet's private folder, and fails
// on any use outside the sheet unless the allowlist below names it with a reason. Allowlist entries must
// still match a use, so a removed use takes its entry out with it.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const SHEET_FILE = "rules/proficiencySheet.ts";
const PRIVATE_FOLDER = "rules/proficiencySources/";

/** The field names only the sheet reads. A leading dot matches a property access. */
const GUARDED_FIELDS: { field: string; pattern: RegExp }[] = [
  "armorProficiencies",
  "weaponProficiencies",
  "toolProficiencies",
  "skillProficiencies",
  "languageProficiencies",
  "multiclassProficiencies",
  "chosenTools",
  "chosenLanguages",
  ".savingThrows",
].map((field) => ({
  field,
  pattern: field.startsWith(".") ? new RegExp(`\\${field}\\b`) : new RegExp(`\\b${field}\\b`),
}));

/**
 * Legitimate uses outside the sheet, per listed file. `fields` are guarded field names; `imports` are
 * sheet-private modules, relative to src/. Each entry says why the use is allowed.
 */
interface Allowance {
  files: string[];
  fields?: string[];
  imports?: string[];
  reason: string;
}

const ALLOWANCES: Allowance[] = [
  {
    files: [
      "rules/ancestryEngine.ts",
      "rules/builderTransitions.ts",
      "components/tabs/BuilderTab.tsx",
      "components/builder/AncestrySection.tsx",
      "components/builder/BackgroundSection.tsx",
    ],
    fields: ["chosenTools", "chosenLanguages"],
    reason: "the Builder edits its own race and background picks, the buckets the sheet reads",
  },
  {
    files: ["components/builder/ClassProgressionSection.tsx"],
    fields: ["chosenTools"],
    reason: "the Builder edits its own class tool picks, the bucket the sheet reads",
  },
  {
    files: ["rules/builderTransitions.ts"],
    fields: ["multiclassProficiencies", "skillProficiencies"],
    reason: "writes the multiclass record the sheet reads, and grants or clears background skills in the chosenSkills bucket",
  },
  {
    files: ["components/builder/BackgroundSection.tsx"],
    fields: ["skillProficiencies"],
    reason: "the background card lists the background's skills as tags",
  },
  {
    files: ["components/builder/ClassProgressionSection.tsx"],
    fields: [".savingThrows"],
    reason: "the class card lists the class's saving throws",
  },
  {
    files: ["rules/characterEvaluation.ts"],
    fields: [".savingThrows"],
    reason: "passes the sheet's saving throws to the saves engine (sheet.savingThrows, not class data)",
  },
  {
    files: ["rules/feats.ts"],
    fields: ["armorProficiencies", "weaponProficiencies"],
    reason: "feat prerequisite option names; the value defaults to the sheet's armor",
  },
  {
    files: ["rules/subclassSpells.ts"],
    fields: [".savingThrows"],
    reason: "a spell's own saving throw, not a class's",
  },
  {
    files: ["rules/raceRuleChoices.ts"],
    imports: ["rules/proficiencySources/skillGrants.ts"],
    reason: "Ancestral Legacy asks whether the prior race grants any skill (a lineage rule, not held proficiency)",
  },
];

interface Finding {
  file: string;
  kind: "field" | "import";
  name: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** The source without comments, so that a doc comment naming a field is not a read. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");
}

/** Every guarded field and every sheet-private import in one file. `file` is relative to src/. */
function findingsIn(file: string, source: string): Finding[] {
  const code = codeOnly(source);
  const findings: Finding[] = [];
  for (const { field, pattern } of GUARDED_FIELDS) {
    if (pattern.test(code)) findings.push({ file, kind: "field", name: field });
  }
  const specifiers = [
    ...code.matchAll(/(?:import|export)\s[^;]*?\sfrom\s*["'](\.[^"']+)["']/g),
    ...code.matchAll(/import\(\s*["'](\.[^"']+)["']\s*\)/g),
  ].map((m) => m[1]);
  for (const spec of specifiers) {
    const target = relative(SRC, resolve(SRC, dirname(file), spec)).split(sep).join("/");
    if (target.startsWith(PRIVATE_FOLDER)) findings.push({ file, kind: "import", name: target });
  }
  return findings;
}

/**
 * Exempt from the guard: the sheet and its private folder (they are the readers), and src/types/, which
 * only declares the shapes of saved characters and catalog records and reads nothing.
 */
function isExempt(file: string): boolean {
  return file === SHEET_FILE || file.startsWith(PRIVATE_FOLDER) || file.startsWith("types/");
}

function allowedBy(finding: Finding, allowances: Allowance[]): boolean {
  return allowances.some(
    (a) =>
      a.files.includes(finding.file) &&
      (finding.kind === "field" ? a.fields?.includes(finding.name) : a.imports?.includes(finding.name)),
  );
}

function format(finding: Finding): string {
  return finding.kind === "field"
    ? `${finding.file} reads ${finding.name}; only ${SHEET_FILE} reads proficiency fields`
    : `${finding.file} imports ${finding.name}; that module is private to ${SHEET_FILE}`;
}

/** The findings in one file that no allowance covers. */
function violationsFor(file: string, source: string, allowances: Allowance[]): Finding[] {
  if (isExempt(file)) return [];
  return findingsIn(file, source).filter((finding) => !allowedBy(finding, allowances));
}

function treeFindings(): Finding[] {
  return sourceFiles(SRC).flatMap((path) => {
    const file = relative(SRC, path).split(sep).join("/");
    return isExempt(file) ? [] : findingsIn(file, readFileSync(path, "utf8"));
  });
}

test("guard, synthetic: a component that reads a race tool field fails, named by file and field", () => {
  const offending = "export function leak(c: Character) {\n  return c.race?.toolProficiencies ?? [];\n}\n";
  const violations = violationsFor("components/Synthetic.tsx", offending, []);
  assert.deepEqual(
    violations.map((v) => [v.file, v.name]),
    [["components/Synthetic.tsx", "toolProficiencies"]],
  );
  assert.equal(format(violations[0]), "components/Synthetic.tsx reads toolProficiencies; only rules/proficiencySheet.ts reads proficiency fields");
});

test("guard, synthetic: a component importing a sheet-private module fails, named by file and module", () => {
  const offending = 'import { getRaceToolGrant } from "../rules/proficiencySources/toolsAndLanguages.ts";\n';
  const violations = violationsFor("components/Synthetic.tsx", offending, []);
  assert.deepEqual(
    violations.map((v) => [v.file, v.name]),
    [["components/Synthetic.tsx", "rules/proficiencySources/toolsAndLanguages.ts"]],
  );
});

test("guard, synthetic: comments are not reads, and the sheet itself is exempt", () => {
  assert.deepEqual(violationsFor("components/Synthetic.tsx", "// reads chosenTools in a comment\n", []), []);
  assert.deepEqual(violationsFor(SHEET_FILE, "const x = c.armorProficiencies;", []), []);
});

test("only the Proficiency Sheet reads proficiency fields or imports its private sources", () => {
  const violations = treeFindings().filter((finding) => !allowedBy(finding, ALLOWANCES));
  assert.equal(
    violations.length,
    0,
    `Proficiency fields are read outside the sheet:\n${violations.map(format).join("\n")}`,
  );
});

test("every allowlist entry still matches a use, so the list cannot go stale", () => {
  const found = treeFindings();
  const stale = ALLOWANCES.flatMap((a) =>
    a.files.flatMap((file) => [
      ...(a.fields ?? []).filter((f) => !found.some((x) => x.file === file && x.kind === "field" && x.name === f)).map((f) => `${file}: ${f}`),
      ...(a.imports ?? []).filter((m) => !found.some((x) => x.file === file && x.kind === "import" && x.name === m)).map((m) => `${file}: ${m}`),
    ]),
  );
  assert.deepEqual(stale, [], "these allowlist entries no longer match a use; remove them");
});
