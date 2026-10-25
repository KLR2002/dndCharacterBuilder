import { test } from "node:test";
import assert from "node:assert/strict";
import { extractInitiativeBonus } from "../src/parser/initiative-bonuses.ts";

// Every name and sentence in this file is invented. The extractor reads prose; it must not need real rule text.

test("a bonus to initiative rolls equal to an ability modifier is an ability Initiative Bonus", () => {
  const result = extractInitiativeBonus(
    "Sample Gambit. Once per turn you can give yourself a bonus to your initiative rolls equal to your Charisma modifier.",
  );
  assert.deepEqual(result, { bonus: { kind: "ability", ability: "cha" }, unparsed: [] });
});

test("adding an ability modifier to initiative rolls is an ability Initiative Bonus", () => {
  const result = extractInitiativeBonus("Sample Reflex. Your mind is quick: you add your Intelligence modifier to your initiative rolls.");
  assert.deepEqual(result, { bonus: { kind: "ability", ability: "int" }, unparsed: [] });
});

test("every ability name reads as its key", () => {
  const abilities: Array<[string, string]> = [
    ["Strength", "str"],
    ["Dexterity", "dex"],
    ["Constitution", "con"],
    ["Intelligence", "int"],
    ["Wisdom", "wis"],
    ["Charisma", "cha"],
  ];
  for (const [name, key] of abilities) {
    const result = extractInitiativeBonus(`Sample Sense. You add your ${name} modifier to your initiative rolls.`);
    assert.deepEqual(result.bonus, { kind: "ability", ability: key }, name);
  }
});

test("advantage on initiative rolls is not an Initiative Bonus and is not reported", () => {
  const result = extractInitiativeBonus("Sample Edge. You have advantage on initiative rolls.");
  assert.deepEqual(result, { bonus: undefined, unparsed: [] });
});

test("a companion that shares the initiative count is not an Initiative Bonus and is not reported", () => {
  const result = extractInitiativeBonus(
    "Sample Companion. In combat, the companion shares your initiative count, but it takes its turn immediately after yours.",
  );
  assert.deepEqual(result, { bonus: undefined, unparsed: [] });
});

test("a feature that triggers on rolling initiative is not an Initiative Bonus and is not reported", () => {
  const result = extractInitiativeBonus("Sample Surge. When you roll initiative and have no uses left, you regain one use.");
  assert.deepEqual(result, { bonus: undefined, unparsed: [] });
});

test("a feature with no initiative sentence has no Initiative Bonus", () => {
  const result = extractInitiativeBonus("Sample Walk. You move without a sound. Nothing else changes.");
  assert.deepEqual(result, { bonus: undefined, unparsed: [] });
});

test("an initiative bonus this extractor does not read is reported, not dropped", () => {
  const result = extractInitiativeBonus("Sample Banner. Each ally within 30 feet gains a +2 bonus to initiative rolls.");
  assert.deepEqual(result, { bonus: undefined, unparsed: ["Each ally within 30 feet gains a +2 bonus to initiative rolls"] });
});

test("two different initiative bonuses in one feature are reported, not picked between", () => {
  const result = extractInitiativeBonus(
    "Sample Twin. You add your Wisdom modifier to your initiative rolls. You can give yourself a bonus to your initiative rolls equal to your Charisma modifier.",
  );
  assert.equal(result.bonus, undefined);
  assert.equal(result.unparsed.length, 2);
});
