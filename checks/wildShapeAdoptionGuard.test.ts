import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// A Wild Shape form is adopted through one handler: adoptWildShape in rules/wildShape.ts, which pays the
// charges (1 for a beast, 2 for an elemental) and enters the form. This guard scans src/ for the three
// ways a file would adopt a form or touch the Wild Shape counter on its own:
//   - a write of the active form (`activeWildShape: <value>`; `activeWildShape: null` clears a form, so it is not adoption)
//   - a use of enterWildShape, the form-entry primitive that only the handler calls
//   - the wild_shape counter id, quoted or as a key, in a write or a read
// The allowlist names each remaining use with a reason. A file-wide entry covers a module that owns the form
// arithmetic or the counter's starting value; a line entry covers one read. A listed entry must still match a use.

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

type Kind = "form" | "entry" | "counter";

const PATTERNS: { kind: Kind; pattern: RegExp; message: string }[] = [
  {
    kind: "form",
    // `\S` after the lookahead stops the optional whitespace from backtracking into `null`.
    pattern: /\bactiveWildShape\s*:\s*(?!null\b)\S/g,
    message: "writes an active Wild Shape form outside the adoption handler",
  },
  {
    kind: "entry",
    pattern: /\benterWildShape\b/g,
    message: "uses enterWildShape outside the adoption handler",
  },
  {
    kind: "counter",
    pattern: /\bwild_shape\b/g,
    message: "touches the wild_shape counter outside the adoption handler",
  },
];

interface Allowance {
  file: string;
  kind: Kind;
  /** Text the flagged line must contain. Omitted means the whole file is allowed for this kind. */
  line?: string;
  reason: string;
}

const ALLOWANCES: Allowance[] = [
  {
    file: "rules/wildShape.ts",
    kind: "entry",
    reason: "the adoption handler is the only caller of enterWildShape",
  },
  {
    file: "rules/wildShape.ts",
    kind: "counter",
    reason: "the adoption handler writes the counter, and the charge reader reads it",
  },
  {
    file: "rules/wildShapeHp.ts",
    kind: "form",
    reason: "the form arithmetic and the form-entry primitive, which only the adoption handler calls",
  },
  {
    file: "rules/wildShapeHp.ts",
    kind: "entry",
    reason: "defines enterWildShape, the primitive the adoption handler calls",
  },
  {
    file: "rules/resourceCounters.ts",
    kind: "counter",
    reason: "gives a new Druid the counter at its starting value on a class change, which is not an adoption",
  },
  {
    file: "components/tabs/FeaturesTab.tsx",
    kind: "counter",
    line: 'c.id === "wild_shape"',
    reason: "marks the Wild Shape tracker unlimited in the generic counter list (a read; its stepper is disabled)",
  },
];

interface Finding {
  file: string;
  kind: Kind;
  line: number;
  text: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** The source with comments blanked out (line breaks kept, so line numbers stay right). */
function codeOnly(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, " ");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, (match, lead: string) => lead + blank(match.slice(lead.length)));
}

/** Every adoption or counter use in one file. `file` is relative to src/, with forward slashes. */
function findingsIn(file: string, source: string): Finding[] {
  const code = codeOnly(source);
  const lines = code.split("\n");
  return PATTERNS.flatMap(({ kind, pattern }) =>
    [...code.matchAll(pattern)].map((match) => {
      const index = match.index ?? 0;
      const line = code.slice(0, index).split("\n").length;
      return { file, kind, line, text: (lines[line - 1] ?? "").trim() };
    }),
  );
}

function allowedBy(finding: Finding, allowances: Allowance[]): boolean {
  return allowances.some(
    (a) =>
      a.file === finding.file &&
      a.kind === finding.kind &&
      (a.line === undefined || finding.text.includes(a.line)),
  );
}

function describe(finding: Finding): string {
  const message = PATTERNS.find((p) => p.kind === finding.kind)!.message;
  return `${finding.file}:${finding.line} ${message}: ${finding.text}`;
}

/** The findings in one file that no allowance covers. */
function violationsFor(file: string, source: string, allowances: Allowance[]): Finding[] {
  return findingsIn(file, source).filter((finding) => !allowedBy(finding, allowances));
}

function treeFindings(): Finding[] {
  return sourceFiles(SRC).flatMap((path) => {
    const file = relative(SRC, path).split(sep).join("/");
    return findingsIn(file, readFileSync(path, "utf8"));
  });
}

test("guard, synthetic: a component that writes a form straight into the character fails", () => {
  const offending = [
    "export function quickShape(character: Character, beast: BeastData) {",
    "  return updateCharacter(character.id, {",
    "    activeWildShape: { name: beast.name, source: beast.source, currentHp: 4, maxHp: 4, ac: 12 },",
    "  });",
    "}",
    "",
  ].join("\n");
  const violations = violationsFor("components/Synthetic.tsx", offending, []);
  assert.deepEqual(
    violations.map((v) => [v.kind, v.line]),
    [["form", 3]],
  );
  assert.equal(
    describe(violations[0]),
    'components/Synthetic.tsx:3 writes an active Wild Shape form outside the adoption handler: activeWildShape: { name: beast.name, source: beast.source, currentHp: 4, maxHp: 4, ac: 12 },',
  );
});

test("guard, synthetic: a component that calls enterWildShape directly fails", () => {
  const offending = 'import { enterWildShape } from "../rules/wildShapeHp.ts";\nconst patch = enterWildShape(c, shape);\n';
  const violations = violationsFor("components/Synthetic.tsx", offending, []);
  assert.deepEqual(
    violations.map((v) => [v.kind, v.line]),
    [
      ["entry", 1],
      ["entry", 2],
    ],
  );
});

test("guard, synthetic: a component that writes the Wild Shape counter fails", () => {
  const offending = [
    "updateCharacter(id, {",
    "  resourceCounters: { ...counters, wild_shape: { id: 'wild_shape', name: 'Wild Shape', current: 1, max: 2, resetOn: 'short' } },",
    "});",
  ].join("\n");
  const violations = violationsFor("components/Synthetic.tsx", offending, []);
  assert.deepEqual(
    violations.map((v) => [v.kind, v.line]),
    [
      ["counter", 2],
      ["counter", 2],
    ],
  );
});

test("guard, synthetic: reads and clears of the form, and comments, are not flagged", () => {
  const clean = [
    "// The handler writes activeWildShape: { name } and calls enterWildShape(c, shape).",
    "/* resourceCounters.wild_shape is spent by adoptWildShape */",
    "const inForm = Boolean(character.activeWildShape);",
    "const label = character.activeWildShape ? 'Wolf' : 'Normal';",
    "return updateCharacter(id, { activeWildShape: null, tempHp: 0 });",
    "",
  ].join("\n");
  assert.deepEqual(violationsFor("components/Synthetic.tsx", clean, []), []);
});

test("guard, synthetic: a use covered by a matching allowance is not flagged, and a different line is", () => {
  const source = [
    'const unlimited = c.id === "wild_shape" && c.max >= 999;',
    'const other = counters["wild_shape"];',
    "",
  ].join("\n");
  const allowances: Allowance[] = [
    { file: "components/Synthetic.tsx", kind: "counter", line: 'c.id === "wild_shape"', reason: "a read" },
  ];
  const violations = violationsFor("components/Synthetic.tsx", source, allowances);
  assert.deepEqual(
    violations.map((v) => v.line),
    [2],
  );
});

test("guard: no file under src/ adopts a Wild Shape form or touches its counter outside the allowlist", () => {
  const found = treeFindings();
  const unallowed = found.filter((f) => !allowedBy(f, ALLOWANCES));
  assert.deepEqual(
    unallowed.map(describe),
    [],
    "route the adoption through adoptWildShape (rules/wildShape.ts), or allowlist the use with a reason",
  );
});

test("guard: every allowlisted use still matches a use in src/", () => {
  const found = treeFindings();
  const stale = ALLOWANCES.filter(
    (a) =>
      !found.some(
        (f) => f.file === a.file && f.kind === a.kind && (a.line === undefined || f.text.includes(a.line)),
      ),
  );
  assert.deepEqual(
    stale.map((a) => `${a.file} (${a.kind}${a.line ? `: ${a.line}` : ""})`),
    [],
    "a removed or changed use must take its allowlist entry out with it",
  );
});
