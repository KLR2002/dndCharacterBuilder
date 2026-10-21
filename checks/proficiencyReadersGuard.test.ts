import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The Proficiency Sheet is the only reader of race, background and class proficiency fields (ADR 0015).
// This guard scans src/ for those field names, for imports of the sheet's private folder, and for imports
// or re-exports of the proficiency tables the sheet reads, including reads through a namespace import
// (`ns.TABLE`, `ns["TABLE"]`, `const { TABLE } = ns`) and `export *` of a module that exports a table.
// It fails on any use outside the sheet unless the allowlist below names it with a reason. Allowlist entries
// must still match a use, so a removed use takes its entry out with it. Names ADR 0015 deleted (tables, the
// tool chains, special cases and their modules) fail anywhere under src/, and the allowlist may not name them.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const SHEET_FILE = "rules/proficiencySheet.ts";
const PRIVATE_FOLDER = "rules/proficiencySources/";
const ADR_0015 = fileURLToPath(new URL("../docs/adr/0015-proficiency-grants-live-in-the-catalog.md", import.meta.url));

/** Proficiency tables that remain and that only the sheet reads. A named import or re-export of one is a read. */
const GUARDED_CONSTANTS = ["MULTICLASS_PROFICIENCIES"];

/** An identifier and the pattern that finds it in code. */
function identifier(name: string): { name: string; pattern: RegExp } {
  return { name, pattern: new RegExp(`\\b${name}\\b`) };
}

/**
 * What ADR 0015 deleted: hand tables, the class-name and race or background tool chains, and special cases.
 * Each pattern runs on code with comments removed. A match fails anywhere under src/, the sheet and its
 * private folder included, so a reintroduction cannot hide behind an exemption.
 */
const DELETED_NAMES: { name: string; pattern: RegExp }[] = [
  identifier("RACE_WEAPON_PROFICIENCIES"),
  identifier("RACE_SKILL_PROFICIENCIES"),
  identifier("BACKGROUND_SKILL_PROFICIENCIES"),
  identifier("OPTION_FEATURE_CHOICES"),
  identifier("CLASS_DATA"),
  identifier("getClassToolGrant"),
  identifier("getRaceToolGrant"),
  identifier("getRaceLanguageGrant"),
  identifier("getBackgroundToolGrant"),
  identifier("getBackgroundLanguageGrant"),
  identifier("sourceToolAndLanguageGrants"),
  identifier("raceTraining"),
  identifier("optionGrantApplies"),
  identifier("KENSEI_SUBCLASS"),
  { name: '"Way of the Kensei"', pattern: /["']Way of the Kensei["']/ },
  {
    name: 'a race comparison with "Githyanki" or "Mountain Dwarf"',
    pattern: /["'](?:Githyanki|Mountain Dwarf)["']\s*[!=]==?|[!=]==?\s*["'](?:Githyanki|Mountain Dwarf)["']/,
  },
];

/** Source files ADR 0015 deleted, by path relative to src/. */
const DELETED_MODULES = ["rules/proficiencySources/toolsAndLanguages.ts"];

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
  constants?: string[];
  reason: string;
}

const ALLOWANCES: Allowance[] = [
  {
    files: ["rules/ancestryEngine.ts", "rules/builderTransitions.ts", "components/builder/BackgroundSection.tsx"],
    fields: ["chosenTools", "chosenLanguages"],
    reason: "a race or background change clears the saved race and background buckets the sheet still reads",
  },
  {
    files: ["rules/proficiencyPicks.ts"],
    fields: ["chosenTools", "chosenLanguages"],
    reason: "the reconciler moves the saved class tool bucket, and the race and background tool and language buckets, into their Proficiency Choices' own picks",
  },
  {
    files: ["rules/builderTransitions.ts"],
    fields: ["multiclassProficiencies", "skillProficiencies"],
    reason: "writes the multiclass record the sheet reads, and clears the background skill copies from the chosenSkills bucket",
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
    files: ["rules/builderTransitions.ts"],
    constants: ["MULTICLASS_PROFICIENCIES"],
    reason: "looks up the multiclass table to write the multiclass record the sheet reads when a class is added",
  },
];

interface Finding {
  file: string;
  kind: "field" | "import" | "constant" | "namespace" | "reexport" | "deleted";
  name: string;
}

/** The names a module exports, by path relative to src/. */
type ExportsOf = (file: string) => Set<string>;

/** Finding kinds that name a guarded table. */
const TABLE_KINDS: Finding["kind"][] = ["constant", "namespace", "reexport"];

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

/** A relative module specifier written in `file`, as a path relative to src/. */
function moduleOf(file: string, spec: string): string {
  return relative(SRC, resolve(SRC, dirname(file), spec)).split(sep).join("/");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The names each module exports, following `export * from` to the modules it pulls names from. `sources` maps
 * a path relative to src/ to its source. A module outside the map exports nothing.
 */
function buildExportsIndex(sources: Map<string, string>): ExportsOf {
  const direct = new Map<string, { names: Set<string>; stars: string[] }>();
  for (const [file, source] of sources) {
    const code = codeOnly(source);
    const names = new Set<string>();
    for (const m of code.matchAll(/\bexport\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|enum|type|interface)\s+([\w$]+)/g)) {
      names.add(m[1]);
    }
    for (const m of code.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}/g)) {
      for (const part of m[1].split(",")) {
        const name = part.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, "");
        if (name) names.add(name);
      }
    }
    const stars = [...code.matchAll(/\bexport\s*\*\s*from\s*["'](\.[^"']+)["']/g)].map((m) => moduleOf(file, m[1]));
    direct.set(file, { names, stars });
  }
  return (file) => {
    const out = new Set<string>();
    const seen = new Set<string>();
    const visit = (current: string) => {
      if (seen.has(current)) return;
      seen.add(current);
      const module = direct.get(current);
      if (!module) return;
      for (const name of module.names) out.add(name);
      for (const star of module.stars) visit(star);
    };
    visit(file);
    return out;
  };
}

let treeExports: ExportsOf | undefined;

/** The exports of every module under src/, read once per test run. */
function treeExportsOf(): ExportsOf {
  treeExports ??= buildExportsIndex(
    new Map(
      sourceFiles(SRC).map((path): [string, string] => [relative(SRC, path).split(sep).join("/"), readFileSync(path, "utf8")]),
    ),
  );
  return treeExports;
}

/** The identifiers bound by `import * as name` in the code. */
function namespaceNames(code: string): string[] {
  return [...code.matchAll(/\bimport\s+(?:[\w$]+\s*,\s*)?\*\s+as\s+([\w$]+)\s+from\s*["']/g)].map((m) => m[1]);
}

/** Whether `ns.NAME`, `ns?.NAME`, `ns["NAME"]` or `ns?.["NAME"]` appears in the code. */
function namespaceReads(code: string, ns: string, name: string): boolean {
  const id = escapeRegExp(ns);
  return new RegExp(`(?<![\\w$.])${id}\\s*(?:\\??\\.\\s*${name}\\b|(?:\\?\\.)?\\s*\\[\\s*["']${name}["']\\s*\\])`).test(code);
}

/** The names destructured from `ns` in the code, as in `const { NAME: local } = ns`. */
function destructuredFrom(code: string, ns: string): string[] {
  const pattern = new RegExp(`\\{([^{}]*)\\}\\s*=\\s*${escapeRegExp(ns)}(?![\\w$.?\\[])`, "g");
  return [...code.matchAll(pattern)].flatMap((m) => m[1].split(",").map((part) => part.trim().split(/[:=]/)[0].trim()));
}

/** Every guarded field, sheet-private import and guarded table reached in one file. `file` is relative to src/. */
function findingsIn(file: string, source: string, exportsOf: ExportsOf): Finding[] {
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
    const target = moduleOf(file, spec);
    if (target.startsWith(PRIVATE_FOLDER)) findings.push({ file, kind: "import", name: target });
  }
  const named = [...code.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*["']/g)].flatMap((m) =>
    m[1].split(",").map((part) => part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]),
  );
  for (const name of GUARDED_CONSTANTS) {
    if (named.includes(name)) findings.push({ file, kind: "constant", name });
  }
  for (const ns of namespaceNames(code)) {
    const destructured = destructuredFrom(code, ns);
    for (const name of GUARDED_CONSTANTS) {
      if (namespaceReads(code, ns, name) || destructured.includes(name)) findings.push({ file, kind: "namespace", name });
    }
  }
  for (const m of code.matchAll(/\bexport\s*\*\s*(?:as\s+[\w$]+\s*)?from\s*["'](\.[^"']+)["']/g)) {
    const exported = exportsOf(moduleOf(file, m[1]));
    for (const name of GUARDED_CONSTANTS) {
      if (exported.has(name)) findings.push({ file, kind: "reexport", name });
    }
  }
  return findings;
}

/** Every deleted name in one file's code, by the file that holds it. `file` is relative to src/. */
function deletedIn(file: string, source: string): Finding[] {
  const code = codeOnly(source);
  return DELETED_NAMES.filter(({ pattern }) => pattern.test(code)).map(({ name }) => ({ file, kind: "deleted", name }));
}

/** The deleted source files that are present, given every source path relative to src/. */
function deletedFileFindings(paths: string[]): Finding[] {
  return paths.filter((path) => DELETED_MODULES.includes(path)).map((path) => ({ file: path, kind: "deleted", name: path }));
}

/** The allowlist entries that name a deleted table, chain, special case or module, as `file: name`. */
function deletedAllowances(allowances: Allowance[]): string[] {
  const deleted = new Set([...DELETED_NAMES.map((d) => d.name), ...DELETED_MODULES]);
  return allowances.flatMap((a) =>
    a.files.flatMap((file) =>
      [...(a.constants ?? []), ...(a.imports ?? []), ...(a.fields ?? [])].filter((name) => deleted.has(name)).map((name) => `${file}: ${name}`),
    ),
  );
}

/** The table names in ADR 0015's Known exceptions section, in backticks. */
function knownExceptions(): string[] {
  const adr = readFileSync(ADR_0015, "utf8");
  const section = adr.split(/^## /m).find((part) => part.startsWith("Known exceptions")) ?? "";
  return [...section.matchAll(/`([A-Z][A-Z0-9_]*)`/g)].map((m) => m[1]);
}

/** Whether some module under src/ exports the name. */
function exportedSomewhere(name: string): boolean {
  return sourceFiles(SRC).some((path) => treeExportsOf()(relative(SRC, path).split(sep).join("/")).has(name));
}

/**
 * Exempt from the guard: the sheet and its private folder (they are the readers), and src/types/, which
 * only declares the shapes of saved characters and catalog records and reads nothing.
 */
function isExempt(file: string): boolean {
  return file === SHEET_FILE || file.startsWith(PRIVATE_FOLDER) || file.startsWith("types/");
}

function allowedBy(finding: Finding, allowances: Allowance[]): boolean {
  if (finding.kind === "deleted") return false;
  return allowances.some((a) => {
    if (!a.files.includes(finding.file)) return false;
    if (finding.kind === "field") return a.fields?.includes(finding.name) ?? false;
    if (finding.kind === "import") return a.imports?.includes(finding.name) ?? false;
    return a.constants?.includes(finding.name) ?? false;
  });
}

function format(finding: Finding): string {
  if (finding.kind === "deleted") return `${finding.file} reintroduces ${finding.name}; ADR 0015 deleted it`;
  if (finding.kind === "field") return `${finding.file} reads ${finding.name}; only ${SHEET_FILE} reads proficiency fields`;
  if (finding.kind === "constant") return `${finding.file} imports ${finding.name}; only ${SHEET_FILE} and its private folder read that table`;
  if (finding.kind === "namespace") {
    return `${finding.file} reaches ${finding.name} through a namespace import; only ${SHEET_FILE} and its private folder read that table`;
  }
  if (finding.kind === "reexport") return `${finding.file} re-exports ${finding.name}; only ${SHEET_FILE} and its private folder read that table`;
  return `${finding.file} imports ${finding.name}; that module is private to ${SHEET_FILE}`;
}

/** The findings in one file that no allowance covers. `exportsOf` says what each module exports. */
function violationsFor(file: string, source: string, allowances: Allowance[], exportsOf: ExportsOf = treeExportsOf()): Finding[] {
  const deleted = deletedIn(file, source);
  if (isExempt(file)) return deleted;
  return [...deleted, ...findingsIn(file, source, exportsOf).filter((finding) => !allowedBy(finding, allowances))];
}

function treeFindings(): Finding[] {
  const files = sourceFiles(SRC).map((path) => ({ file: relative(SRC, path).split(sep).join("/"), path }));
  return [
    ...deletedFileFindings(files.map(({ file }) => file)),
    ...files.flatMap(({ file, path }) => {
      const source = readFileSync(path, "utf8");
      return [...deletedIn(file, source), ...(isExempt(file) ? [] : findingsIn(file, source, treeExportsOf()))];
    }),
  ];
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
  const offending = 'import { grantedTools } from "../rules/proficiencySources/toolsAndLanguages.ts";\n';
  const violations = violationsFor("components/Synthetic.tsx", offending, []);
  assert.deepEqual(
    violations.map((v) => [v.file, v.name]),
    [["components/Synthetic.tsx", "rules/proficiencySources/toolsAndLanguages.ts"]],
  );
});

test("guard, synthetic: importing or re-exporting a guarded proficiency table fails, named by file and table", () => {
  const imported = 'import {\n  STANDARD_ARRAY,\n  MULTICLASS_PROFICIENCIES as table,\n} from "../constants/rules.ts";\n';
  const reexported = 'export { MULTICLASS_PROFICIENCIES } from "../constants/rules.ts";\n';
  const harmless = 'import { MULTICLASS_PREREQUISITES } from "../constants/rules.ts";\n';
  assert.deepEqual(
    violationsFor("components/Synthetic.tsx", imported, []).map((v) => [v.file, v.name]),
    [["components/Synthetic.tsx", "MULTICLASS_PROFICIENCIES"]],
  );
  assert.deepEqual(
    violationsFor("components/Synthetic.tsx", reexported, []).map((v) => [v.file, v.name]),
    [["components/Synthetic.tsx", "MULTICLASS_PROFICIENCIES"]],
  );
  assert.deepEqual(violationsFor("components/Synthetic.tsx", harmless, []), []);
});

test("guard, synthetic: a namespace import that reaches a guarded table fails, by dot, optional dot, bracket or destructuring", () => {
  const dot = 'import * as rules from "../constants/rules.ts";\nexport const table = rules.MULTICLASS_PROFICIENCIES;\n';
  const optional = 'import * as rules from "../constants/rules.ts";\nexport const table = rules?.RACE_WEAPON_PROFICIENCIES;\n';
  const bracket = "import * as rules from '../constants/rules.ts';\nexport const table = rules[\"MULTICLASS_PROFICIENCIES\"];\n";
  const destructured = 'import * as rules from "../constants/rules.ts";\nconst { MULTICLASS_PROFICIENCIES: table } = rules;\n';
  for (const source of [dot, optional, bracket, destructured]) {
    assert.equal(violationsFor("components/Synthetic.tsx", source, []).length, 1, source);
  }
  assert.deepEqual(
    violationsFor("components/Synthetic.tsx", dot, []).map((v) => [v.file, v.name]),
    [["components/Synthetic.tsx", "MULTICLASS_PROFICIENCIES"]],
  );
  assert.equal(
    format(violationsFor("components/Synthetic.tsx", bracket, [])[0]),
    "components/Synthetic.tsx reaches MULTICLASS_PROFICIENCIES through a namespace import; only rules/proficiencySheet.ts and its private folder read that table",
  );
});

test("guard, synthetic: a namespace import that reads only untabled members passes", () => {
  const harmless = [
    'import * as rules from "../constants/rules.ts";\nexport const size = rules.STANDARD_ARRAY;\n',
    'import * as rules from "../constants/rules.ts";\nconst { STANDARD_ARRAY } = rules;\n',
    'import * as rules from "../constants/rules.ts";\n// rules.MULTICLASS_PROFICIENCIES is named in a comment only\n',
    'import * as rules from "../constants/rules.ts";\nconst grants = otherRules.MULTICLASS_PROFICIENCIES;\n',
  ];
  for (const source of harmless) {
    assert.deepEqual(violationsFor("components/Synthetic.tsx", source, []), [], source);
  }
});

test("guard, synthetic: re-exporting a module that exports a guarded table, with export * or export * as, fails", () => {
  const star = 'export * from "../constants/rules.ts";\n';
  const namespaced = 'export * as rules from "../constants/rules.ts";\n';
  for (const source of [star, namespaced]) {
    assert.deepEqual(
      violationsFor("components/Synthetic.tsx", source, []).map((v) => [v.file, v.name]).sort(),
      [["components/Synthetic.tsx", "MULTICLASS_PROFICIENCIES"]],
      source,
    );
  }
});

test("guard, synthetic: a star re-export follows a chain of star re-exports to a guarded table, and stops at a module without one", () => {
  const exportsOf = buildExportsIndex(
    new Map([
      ["constants/tables.ts", "export const MULTICLASS_PROFICIENCIES = {};\n"],
      ["constants/barrel.ts", 'export * from "./tables.ts";\nexport { STANDARD_ARRAY } from "./plain.ts";\n'],
      ["constants/plain.ts", "export const STANDARD_ARRAY = [15, 14];\n"],
      ["constants/outer.ts", 'export * from "./barrel.ts";\n'],
      ["constants/plainBarrel.ts", 'export * from "./plain.ts";\n'],
    ]),
  );
  assert.deepEqual(
    violationsFor("components/Synthetic.tsx", 'export * from "../constants/outer.ts";\n', [], exportsOf).map((v) => [v.kind, v.name]),
    [["reexport", "MULTICLASS_PROFICIENCIES"]],
  );
  assert.deepEqual(violationsFor("components/Synthetic.tsx", 'export * from "../constants/plainBarrel.ts";\n', [], exportsOf), []);
  assert.deepEqual(violationsFor("components/Synthetic.tsx", 'export * as plain from "../constants/plain.ts";\n', [], exportsOf), []);
});

test("guard, synthetic: an allowlisted table import passes, and the sheet and its private folder are exempt", () => {
  const imported = 'import { MULTICLASS_PROFICIENCIES } from "../constants/rules.ts";\n';
  const allowed: Allowance[] = [
    { files: ["components/Synthetic.tsx"], constants: ["MULTICLASS_PROFICIENCIES", "RACE_WEAPON_PROFICIENCIES"], reason: "test" },
  ];
  assert.deepEqual(violationsFor("components/Synthetic.tsx", imported, allowed), []);
  assert.deepEqual(violationsFor(SHEET_FILE, imported, []), []);
  assert.deepEqual(violationsFor("rules/proficiencySources/classBase.ts", 'import { MULTICLASS_PROFICIENCIES } from "../../constants/rules.ts";\n', []), []);
  const namespaced = 'import * as rules from "../constants/rules.ts";\nexport const table = rules.MULTICLASS_PROFICIENCIES;\nexport * from "../constants/rules.ts";\n';
  assert.equal(violationsFor("components/Synthetic.tsx", namespaced, allowed).length, 0);
  assert.deepEqual(violationsFor(SHEET_FILE, namespaced, []), []);
});

test("guard, synthetic: comments are not reads, and the sheet itself is exempt", () => {
  assert.deepEqual(violationsFor("components/Synthetic.tsx", "// reads chosenTools in a comment\n", []), []);
  assert.deepEqual(violationsFor(SHEET_FILE, "const x = c.armorProficiencies;", []), []);
});

test("guard, synthetic: a deleted hand table declared again fails, in a component and in the sheet itself", () => {
  for (const name of ["RACE_WEAPON_PROFICIENCIES", "RACE_SKILL_PROFICIENCIES", "BACKGROUND_SKILL_PROFICIENCIES", "OPTION_FEATURE_CHOICES", "CLASS_DATA"]) {
    const table = `export const ${name} = {\n  Vellari: ["Tinkering"],\n};\n`;
    const inComponent = violationsFor("components/Synthetic.tsx", table, []);
    assert.deepEqual(inComponent.map((v) => [v.file, v.name]), [["components/Synthetic.tsx", name]], name);
    assert.equal(format(inComponent[0]), `components/Synthetic.tsx reintroduces ${name}; ADR 0015 deleted it`);
    assert.deepEqual(violationsFor(SHEET_FILE, table, []).map((v) => [v.file, v.name]), [[SHEET_FILE, name]], name);
  }
});

test("guard, synthetic: a deleted class-name or race or background tool chain called or declared again fails", () => {
  const chains = ["getClassToolGrant", "getRaceToolGrant", "getRaceLanguageGrant", "getBackgroundToolGrant", "getBackgroundLanguageGrant", "sourceToolAndLanguageGrants"];
  for (const name of chains) {
    const call = `const grant = ${name}("Scout", classes);\n`;
    const declared = `export function ${name}(race: string) {\n  return race;\n}\n`;
    assert.deepEqual(violationsFor("components/Synthetic.tsx", call, []).map((v) => v.name), [name], name);
    assert.deepEqual(violationsFor("rules/proficiencySources/classBase.ts", declared, []).map((v) => v.name), [name], name);
  }
});

test("guard, synthetic: a deleted special case fails, by its function, its name constant, its name literal or its race comparison", () => {
  const cases: [string, string][] = [
    ["raceTraining", "function raceTraining(character: Character) {\n  return character;\n}\n"],
    ["optionGrantApplies", "export function optionGrantApplies(character: Character) {\n  return character;\n}\n"],
    ["KENSEI_SUBCLASS", 'const KENSEI_SUBCLASS = "Monk";\n'],
    ['"Way of the Kensei"', 'if (monk.subclassName === "Way of the Kensei") return true;\n'],
    ['a race comparison with "Githyanki" or "Mountain Dwarf"', 'if (raceName === "Githyanki") armor.push("Light armor");\n'],
    ['a race comparison with "Githyanki" or "Mountain Dwarf"', 'if ("Mountain Dwarf" === subraceName) armor.push("Light armor");\n'],
  ];
  for (const [name, source] of cases) {
    assert.deepEqual(violationsFor("components/Synthetic.tsx", source, []).map((v) => v.name), [name], source);
  }
});

test("guard, synthetic: a deleted module that exists again fails, whoever imports it", () => {
  const found = deletedFileFindings(["rules/proficiencySources/skillGrants.ts", "rules/proficiencySources/toolsAndLanguages.ts"]);
  assert.deepEqual(
    found.map((v) => [v.file, v.name]),
    [["rules/proficiencySources/toolsAndLanguages.ts", "rules/proficiencySources/toolsAndLanguages.ts"]],
  );
});

test("the allowlist names no deleted table, chain, special case or module", () => {
  assert.deepEqual(
    deletedAllowances([
      {
        files: ["components/Synthetic.tsx"],
        constants: ["RACE_WEAPON_PROFICIENCIES", "MULTICLASS_PROFICIENCIES"],
        imports: ["rules/proficiencySources/toolsAndLanguages.ts"],
        reason: "test",
      },
    ]),
    ["components/Synthetic.tsx: RACE_WEAPON_PROFICIENCIES", "components/Synthetic.tsx: rules/proficiencySources/toolsAndLanguages.ts"],
  );
  assert.deepEqual(deletedAllowances(ALLOWANCES), []);
});

test("no deleted table, chain, special case or module is back under src/, the sheet included", () => {
  const back = treeFindings().filter((finding) => finding.kind === "deleted");
  assert.deepEqual(back.map(format), [], "deleted names are back in src/");
});

test("ADR 0015's Known exceptions names exactly the tables the guard still allowlists, and each one is exported", () => {
  const named = [...new Set(knownExceptions())].sort();
  const allowlisted = [...new Set(ALLOWANCES.flatMap((a) => a.constants ?? []))].sort();
  assert.deepEqual(named, allowlisted, "ADR 0015 Known exceptions must list the allowlisted tables, and only those");
  for (const name of named) {
    assert.ok(exportedSomewhere(name), `${name} is named in ADR 0015 but no source file exports it`);
  }
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
      ...(a.constants ?? []).filter((c) => !found.some((x) => x.file === file && TABLE_KINDS.includes(x.kind) && x.name === c)).map((c) => `${file}: ${c}`),
    ]),
  );
  assert.deepEqual(stale, [], "these allowlist entries no longer match a use; remove them");
});
