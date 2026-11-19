import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The legacy fields the migration passes read (ADR 0026). The passes also read old ids inside current fields
// (Fighting Style ids in ruleChoices, innate counters in resourceCounters); every edit writes those fields, so
// a file list cannot tell an old id from a current one and they are not guarded here. A current transition must not write them: the
// passes move a legacy shape on load and on a Catalog change, not on every edit, so a new writer would leave its
// state unmoved until the next load. This guard scans src/ for writes to these fields (an object literal key,
// a property assignment, or a delete) and fails on any write from a file the allowlist does not name for that
// field. Allowlist entries must still match a write, so a removed write takes its entry out with it.

const ts = createRequire(import.meta.url)("typescript");
const SRC = fileURLToPath(new URL("../src/", import.meta.url));

const GUARDED_FIELDS = [
  "chosenSkills",
  "skillChoices",
  "chosenTools",
  "chosenLanguages",
] as const;

/**
 * A file, by path relative to src/, the guarded fields it may write, and why. A write in a file listed here clears or
 * filters a legacy field, or is a migration pass.
 */
const ALLOWED_WRITERS: Record<string, { fields: readonly string[]; reason: string }> = {
  "components/builder/BackgroundSection.tsx": {
    fields: ["chosenLanguages", "chosenTools"],
    reason: "clears the background's tool and language buckets to empty when the background changes",
  },
  "context/CharacterContext.tsx": {
    fields: ["chosenSkills"],
    reason: "a new character starts with empty fields",
  },
  "rules/ancestryEngine.ts": {
    fields: ["chosenLanguages", "chosenTools"],
    reason: "a lineage change empties the race's tool and language buckets",
  },
  "rules/builderTransitions.ts": {
    fields: ["skillChoices", "chosenSkills", "chosenLanguages", "chosenTools"],
    reason: "current transitions remove the entries a lineage, class or background held, and empty its buckets; none adds a name",
  },
  "rules/legacyBackgroundSkills.ts": {
    fields: ["chosenSkills"],
    reason: "dropLegacyBackgroundSkills, a migration pass",
  },
  "rules/migrateCharacter.ts": {
    fields: ["chosenSkills", "skillChoices"],
    reason: "load-time normalization of older saves, before migrateSavedPicks runs",
  },
  "rules/proficiencyPicks.ts": {
    fields: ["chosenTools", "chosenLanguages", "chosenSkills", "skillChoices"],
    reason: "the migration passes write the buckets they move names out of",
  },
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Each guarded field this file writes, with the line of the write. */
function writesIn(file: string): { field: string; line: number }[] {
  const text = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const writes: { field: string; line: number }[] = [];
  const record = (field: string, node: { getStart(): number }) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    writes.push({ field, line: line + 1 });
  };
  const guarded = (name: string) => (GUARDED_FIELDS as readonly string[]).includes(name);
  const visit = (node: any): void => {
    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : "";
      if (guarded(name)) record(name, node);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = node.left;
      if (ts.isPropertyAccessExpression(left) && guarded(left.name.text)) record(left.name.text, node);
    }
    if (ts.isDeleteExpression(node) && ts.isPropertyAccessExpression(node.expression) && guarded(node.expression.name.text)) {
      record(node.expression.name.text, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return writes;
}

test("only the allowlisted files write the legacy fields the migration passes read", () => {
  const writers = new Map<string, { field: string; line: number }[]>();
  for (const file of sourceFiles(SRC)) {
    const writes = writesIn(file);
    if (writes.length > 0) writers.set(relative(SRC, file).split(sep).join("/"), writes);
  }

  const unlisted: string[] = [];
  for (const [file, writes] of writers) {
    for (const { field, line } of writes) {
      if (!ALLOWED_WRITERS[file]?.fields.includes(field)) unlisted.push(`${file}:${line} writes ${field}`);
    }
  }
  assert.deepEqual(unlisted, [], "a write outside the allowlist: name the file and its reason in ALLOWED_WRITERS, or move the write into a migration pass");

  const stale: string[] = [];
  for (const [file, entry] of Object.entries(ALLOWED_WRITERS)) {
    for (const field of entry.fields) {
      const matched = writers.get(file)?.some((write) => write.field === field);
      if (!matched) stale.push(`${file} no longer writes ${field}`);
    }
  }
  assert.deepEqual(stale, [], "an allowlist entry must still match a write");
});
