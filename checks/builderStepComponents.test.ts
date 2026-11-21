import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ClassChoiceCards renders the view it is given and reports choices through callbacks, so the Level-Up Flow can
// feed it its own plan: it never writes the character itself.

const BUILDER = fileURLToPath(new URL("../src/components/builder/", import.meta.url));

test("ClassChoiceCards reports choices through callbacks and never writes the character", () => {
  const source = readFileSync(BUILDER + "ClassChoiceCards.tsx", "utf8");
  assert.doesNotMatch(source, /\bonUpdate\b/);
  assert.doesNotMatch(source, /builderTransitions|characterReconciler|\bpickRuleChoice\b|clearProficiencyPick|toggleExpertiseChoice/);
  assert.doesNotMatch(source, /currentCompendium/);
});
