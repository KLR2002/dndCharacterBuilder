import { test } from "node:test";
import assert from "node:assert/strict";
import { INVOCATION_AT_WILL_SPELLS } from "../src/rules/ruleChoices.ts";
import { integratedTestCompendium } from "./testUtils.ts";

/**
 * The at-will invocation table is curated. The default test catalog's Eldritch Invocation records
 * say which invocations grant an at-will spell. The check reads that text here, in the test only;
 * nothing parses it at runtime.
 */
const compendium = integratedTestCompendium();
const invocations = compendium
  .for()
  .optionsAndFeatures()
  .filter((o) => (o.featureType ?? []).includes("EI"));
const invocationNames = new Set(invocations.map((o) => o.name.toLowerCase()));
const spellNames = new Set(compendium.for().spells().map((s) => s.name.toLowerCase()));

test("every at-will table key is an Eldritch Invocation record in the default test catalog", () => {
  const unknown = Object.keys(INVOCATION_AT_WILL_SPELLS).filter(
    (name) => !invocationNames.has(name.toLowerCase()),
  );
  assert.deepEqual(unknown, []);
});

test("every Eldritch Invocation whose text says \"at will\" has a table entry", () => {
  const tableKeys = new Set(Object.keys(INVOCATION_AT_WILL_SPELLS).map((k) => k.toLowerCase()));
  const atWill = invocations
    .filter((o) => /at will/i.test(o.description ?? ""))
    .map((o) => o.name);
  assert.ok(atWill.length > 0, "the catalog has at-will invocations to check");
  const missing = atWill.filter((name) => !tableKeys.has(name.toLowerCase()));
  assert.deepEqual(missing, []);
});

test("every at-will table value is a spell in the default test catalog", () => {
  const unknown = Object.entries(INVOCATION_AT_WILL_SPELLS)
    .filter(([, spell]) => !spellNames.has(spell.toLowerCase()))
    .map(([invocation, spell]) => `${invocation} -> ${spell}`);
  assert.deepEqual(unknown, []);
});
