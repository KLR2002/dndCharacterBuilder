import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The Class step's parts live in one component per Creation Step under components/builder/. The Class Choices
// part is ClassChoiceCards: it renders the view it is given and reports choices through callbacks, so the
// Level-Up Flow can feed it its own plan. No builder file the split produced grows past 500 lines.

const BUILDER = fileURLToPath(new URL("../src/components/builder/", import.meta.url));
const BUILDER_TAB = fileURLToPath(new URL("../src/components/tabs/BuilderTab.tsx", import.meta.url));

const PARTS = [
  "ClassSteps.tsx",
  "ClassLevelsSection.tsx",
  "ClassListSection.tsx",
  "SubclassSection.tsx",
  "ClassChoiceCards.tsx",
  "OptionalFeatureCard.tsx",
  "ClassEquipmentSection.tsx",
];

test("the Class step is split into one component per part", () => {
  for (const file of PARTS) {
    assert.ok(existsSync(BUILDER + file), `${file} exists under components/builder/`);
  }
  assert.equal(existsSync(BUILDER + "ClassProgressionSection.tsx"), false);
  assert.doesNotMatch(readFileSync(BUILDER_TAB, "utf8"), /ClassProgressionSection/);
});

test("ClassChoiceCards reports choices through callbacks and never writes the character", () => {
  const source = readFileSync(BUILDER + "ClassChoiceCards.tsx", "utf8");
  assert.doesNotMatch(source, /\bonUpdate\b/);
  assert.doesNotMatch(source, /builderTransitions|characterReconciler|\bpickRuleChoice\b|clearProficiencyPick|toggleExpertiseChoice/);
  assert.doesNotMatch(source, /currentCompendium/);
});

test("no file the split produced is over 500 lines", () => {
  for (const file of PARTS) {
    const lines = readFileSync(BUILDER + file, "utf8").split("\n").length;
    assert.ok(lines <= 500, `${file} has ${lines} lines`);
  }
});
