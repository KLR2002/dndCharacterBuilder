import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The saved fields that the migration passes read (ADR 0026). A current transition must not write them: the
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
  "chosenExpertise",
  "ruleChoices",
  "resourceCounters",
] as const;

/**
 * A file, by path relative to src/, the guarded fields it may write, and why. A write in a file listed here is a current
 * transition or a migration pass. The fighting-style and innate-counter fields (`ruleChoices`, `resourceCounters`) are
 * current fields too, so their entries name the files that write them, not every write inside them.
 */
const ALLOWED_WRITERS: Record<string, { fields: readonly string[]; reason: string }> = {
  "components/builder/BackgroundSection.tsx": {
    fields: ["chosenLanguages", "chosenTools"],
    reason: "clears the background's tool and language buckets to empty when the background changes",
  },
  "components/builder/ClassSteps.tsx": {
    fields: ["ruleChoices"],
    reason: "reads the saved picks into the class step's view; nothing is stored",
  },
  "components/builder/classChoiceWiring.ts": {
    fields: ["ruleChoices"],
    reason: "removes one class Rule Choice when the player clears it",
  },
  "components/levelUpFlow/ClassChoicesStep.tsx": {
    fields: ["ruleChoices"],
    reason: "returns the step's choice view; nothing is stored",
  },
  "components/tabs/FeaturesTab.tsx": {
    fields: ["resourceCounters"],
    reason: "the player adjusts or resets a resource counter's current value",
  },
  "context/CharacterContext.tsx": {
    fields: ["chosenSkills", "chosenExpertise", "resourceCounters"],
    reason: "a new character starts with empty fields",
  },
  "rules/ancestryEngine.ts": {
    fields: ["chosenLanguages", "chosenTools", "ruleChoices"],
    reason: "a lineage change empties the race's tool and language buckets and removes the race's Rule Choices; clearing one ancestry choice",
  },
  "rules/backgroundSpells.ts": {
    fields: ["ruleChoices"],
    reason: "passes the saved picks to a spell-availability check; nothing is stored",
  },
  "rules/builderTransitions.ts": {
    fields: ["ruleChoices", "skillChoices", "chosenSkills", "chosenLanguages", "chosenTools"],
    reason: "current transitions remove the entries a lineage, class or background held, and empty its buckets; none adds a name",
  },
  "rules/characterReconciler.ts": {
    fields: ["ruleChoices", "resourceCounters"],
    reason: "subclass teardown removes the subclass's own Rule Choices and counters",
  },
  "rules/characterSpells.ts": {
    fields: ["resourceCounters"],
    reason: "a spell's own use counter, set when the player uses the spell",
  },
  "rules/choices/artificerInfusions.ts": {
    fields: ["ruleChoices"],
    reason: "records an Artificer infusion pick",
  },
  "rules/choices/featSpells.ts": {
    fields: ["ruleChoices", "resourceCounters"],
    reason: "feat spell picks and counters are pruned and released by current passes; the legacy race pick and cantrip moves run inside migrateCharacter on load",
  },
  "rules/choices/fightingStyles.ts": {
    fields: ["ruleChoices"],
    reason: "the fighting style picker writes the id the held class gives; its legacy move is a load-time migration; other entries are removed when their owner is",
  },
  "rules/choices/maneuvers.ts": {
    fields: ["ruleChoices"],
    reason: "records the maneuver picks",
  },
  "rules/choices/types.ts": {
    fields: ["ruleChoices"],
    reason: "setRuleChoicePick, the single writer of a Rule Choice pick",
  },
  "rules/choices/warlockChoices.ts": {
    fields: ["ruleChoices"],
    reason: "records Warlock picks and removes the ones a changed Warlock level or pact releases",
  },
  "rules/classChoices.ts": {
    fields: ["ruleChoices"],
    reason: "returns the class choices view; nothing is stored",
  },
  "rules/expertise.ts": {
    fields: ["chosenExpertise"],
    reason: "Expertise milestones still write chosenExpertise (toggleExpertiseChoice); pruneInvalidExpertise releases a mark nothing holds",
  },
  "rules/grantedSpells.ts": {
    fields: ["resourceCounters"],
    reason: "moveLegacyInnateCounters, a migration pass",
  },
  "rules/legacyBackgroundSkills.ts": {
    fields: ["chosenSkills"],
    reason: "dropLegacyBackgroundSkills, a migration pass",
  },
  "rules/migrateCharacter.ts": {
    fields: ["ruleChoices", "chosenSkills", "skillChoices"],
    reason: "load-time normalization of older saves, before migrateSavedPicks runs",
  },
  "rules/proficiencyPicks.ts": {
    fields: ["chosenTools", "chosenLanguages", "chosenSkills", "skillChoices", "chosenExpertise"],
    reason: "the migration passes write the buckets they move names out of; moveExpertisePicksToGrants stays in reconcile",
  },
  "rules/rest.ts": {
    fields: ["resourceCounters"],
    reason: "a rest resets resource counters",
  },
  "rules/ruleChoices.ts": {
    fields: ["ruleChoices"],
    reason: "a long rest clears the choices the player may change",
  },
  "rules/spellcasting.ts": {
    fields: ["ruleChoices"],
    reason: "passes the saved picks to spell checks as a view; nothing is stored",
  },
  "rules/subclassChoiceTable.ts": {
    fields: ["ruleChoices"],
    reason: "clears one subclass Rule Choice",
  },
  "rules/wildShape.ts": {
    fields: ["resourceCounters"],
    reason: "Wild Shape sets its own counter",
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
