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

test("a roll sentence under an Initiative Bonus heading is an ability Initiative Bonus, and the heading is not reported", () => {
  const result = extractInitiativeBonus(
    "### Sample Initiative Bonus\n\nWhen you roll initiative, you can add your Wisdom modifier to the roll.",
  );
  assert.deepEqual(result, { bonus: { kind: "ability", ability: "wis" }, unparsed: [] });
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

test("a bonus to initiative equal to the proficiency bonus is a proficiency Initiative Bonus", () => {
  const result = extractInitiativeBonus(
    "Sample Beacon. While you are awake, you and any companions within 10 feet of you roll initiative, and you all gain a bonus to initiative equal to your proficiency bonus.",
  );
  assert.deepEqual(result, { bonus: { kind: "proficiency" }, unparsed: [] });
});

test("a bonus to initiative rolls equal to the proficiency bonus is a proficiency Initiative Bonus", () => {
  const result = extractInitiativeBonus("Sample Snap. You can give yourself a bonus to your initiative rolls equal to your proficiency bonus.");
  assert.deepEqual(result, { bonus: { kind: "proficiency" }, unparsed: [] });
});

test("adding the proficiency bonus to initiative rolls is a proficiency Initiative Bonus", () => {
  const result = extractInitiativeBonus("Sample Reflex. Your training is sharp: you add your proficiency bonus to your initiative rolls.");
  assert.deepEqual(result, { bonus: { kind: "proficiency" }, unparsed: [] });
});

test("a roll sentence under a proficiency heading is a proficiency Initiative Bonus, and the heading is not reported", () => {
  const result = extractInitiativeBonus(
    "### Sample Keenness\n\nWhen you roll initiative, you can add your proficiency bonus to the roll.",
  );
  assert.deepEqual(result, { bonus: { kind: "proficiency" }, unparsed: [] });
});

test("a flat bonus to initiative is a flat Initiative Bonus of that value", () => {
  const result = extractInitiativeBonus("Sample Sentry. Always on the lookout, you gain a +4 bonus to initiative.");
  assert.deepEqual(result, { bonus: { kind: "flat", value: 4 }, unparsed: [] });
});

test("a flat bonus with no article reads the same as one with 'a'", () => {
  const result = extractInitiativeBonus("Sample Watch. You gain +3 bonus to initiative rolls.");
  assert.deepEqual(result, { bonus: { kind: "flat", value: 3 }, unparsed: [] });
});

test("a proficiency bonus to initiative granted only to others is reported, not given to the holder", () => {
  const result = extractInitiativeBonus(
    "Sample Chant. Each creature within 10 feet gains a bonus to initiative equal to your proficiency bonus.",
  );
  assert.deepEqual(result, {
    bonus: undefined,
    unparsed: ["Each creature within 10 feet gains a bonus to initiative equal to your proficiency bonus"],
  });
});

test("a flat bonus an ally gains is reported, not given to the holder, even when the sentence says 'you' in a condition", () => {
  const result = extractInitiativeBonus(
    "Sample Chant. While you are awake, each ally within 30 feet of you who can hear you gains a +2 bonus to initiative rolls.",
  );
  assert.deepEqual(result, {
    bonus: undefined,
    unparsed: ["While you are awake, each ally within 30 feet of you who can hear you gains a +2 bonus to initiative rolls"],
  });
});

test("a bonus to armor class or damage that does not mention initiative is not an Initiative Bonus and is not reported", () => {
  const result = extractInitiativeBonus("Sample Guard. You gain a +2 bonus to armor class. Your strikes add a +2 bonus to damage rolls.");
  assert.deepEqual(result, { bonus: undefined, unparsed: [] });
});

test("a flat and a proficiency bonus in one feature are two different bonuses, reported, not picked between", () => {
  const result = extractInitiativeBonus(
    "Sample Twin. You gain a +2 bonus to initiative. You add your proficiency bonus to your initiative rolls.",
  );
  assert.equal(result.bonus, undefined);
  assert.equal(result.unparsed.length, 2);
});
