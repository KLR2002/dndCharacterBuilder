import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import type { AbilityScores, CharacterClass } from "../src/types/character.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { initiativeClasses } from "./initiativeFixture.ts";

// Jack of All Trades (a Bard of 2nd level or higher) and Remarkable Athlete (a Champion of 7th level or higher) are
// half-proficiency rules. Initiative is a Dexterity check, so both reach it; skills take the one that fits each skill.
// Only the higher of the two applies. Both are SRD rules and live in code, so these tests use no invented catalog
// for them except where an Initiative Bonus is needed to show the line order.

const compendium = inMemoryCompendium({ classes: initiativeClasses() });
const catalogs = { compendium };

const scores = (overrides: Partial<AbilityScores>): AbilityScores => ({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  ...overrides,
});

const bard = (level: number): CharacterClass => ({ className: "Bard", source: "PHB", level });
const champion = (level: number): CharacterClass => ({
  className: "Fighter",
  source: "PHB",
  level,
  subclassName: "Champion",
  subclassSource: "PHB",
});
const fighterOther = (level: number): CharacterClass => ({
  className: "Fighter",
  source: "PHB",
  level,
  subclassName: "Battle Master",
  subclassSource: "PHB",
});
const scout = (level: number, subclassName?: string): CharacterClass => ({
  className: "Sample Scout",
  source: "PHB",
  level,
  ...(subclassName ? { subclassName, subclassSource: "PHB" } : {}),
});

const initiativeOf = (classes: CharacterClass[], baseAbilityScores: AbilityScores) =>
  evaluateCharacter(makeChar({ classes, baseAbilityScores }), catalogs);

const skillRow = (
  classes: CharacterClass[],
  name: string,
  extra: { baseAbilityScores?: AbilityScores; chosenSkills?: string[]; chosenExpertise?: string[] } = {},
) => {
  const evaluated = evaluateCharacter(makeChar({ classes, ...extra }), catalogs);
  const row = evaluated.skills.find((s) => s.name === name);
  assert.ok(row, `skill ${name} is listed`);
  return row;
};

// Initiative: Jack of All Trades

test("a Bard of 1st level adds nothing to initiative", () => {
  const evaluated = initiativeOf([bard(1)], scores({ dex: 14 }));
  assert.equal(evaluated.initiative, 2);
  assert.deepEqual(evaluated.initiativeBreakdown, [{ label: "Dexterity", value: 2 }]);
});

test("a Bard of 2nd level adds half the proficiency bonus, rounded down, on its own line", () => {
  const evaluated = initiativeOf([bard(2)], scores({ dex: 14 }));
  assert.equal(evaluated.initiative, 3, "proficiency bonus 2, half rounded down is 1");
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Jack of All Trades", value: 1 },
  ]);
});

test("Jack of All Trades on initiative rounds half the proficiency bonus down at every tier", () => {
  // Proficiency bonus 3 (levels 5-8), 4 (9-12), 5 (13-16), 6 (17-20): floor halves are 1, 2, 2, 3.
  const expected: [number, number][] = [
    [2, 1],
    [5, 1],
    [9, 2],
    [13, 2],
    [17, 3],
  ];
  for (const [level, value] of expected) {
    const evaluated = initiativeOf([bard(level)], scores({ dex: 10 }));
    assert.deepEqual(
      evaluated.initiativeBreakdown.find((part) => part.label === "Jack of All Trades"),
      { label: "Jack of All Trades", value },
      `Bard ${level}`,
    );
  }
});

// Initiative: Remarkable Athlete

test("a Champion of 6th level gets no Remarkable Athlete line on initiative", () => {
  const evaluated = initiativeOf([champion(6)], scores({ dex: 14 }));
  assert.equal(evaluated.initiative, 2);
  assert.deepEqual(evaluated.initiativeBreakdown, [{ label: "Dexterity", value: 2 }]);
});

test("a Champion of 7th level adds half the proficiency bonus, rounded up, on its own line", () => {
  const evaluated = initiativeOf([champion(7)], scores({ dex: 14 }));
  assert.equal(evaluated.initiative, 4, "proficiency bonus 3, half rounded up is 2");
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Remarkable Athlete", value: 2 },
  ]);
});

test("Remarkable Athlete on initiative rounds half the proficiency bonus up at every tier", () => {
  // Proficiency bonus 3 (level 7), 4 (9-12), 5 (13-16), 6 (17-20): ceil halves are 2, 2, 3, 3.
  const expected: [number, number][] = [
    [7, 2],
    [9, 2],
    [13, 3],
    [17, 3],
  ];
  for (const [level, value] of expected) {
    const evaluated = initiativeOf([champion(level)], scores({ dex: 10 }));
    assert.deepEqual(
      evaluated.initiativeBreakdown.find((part) => part.label === "Remarkable Athlete"),
      { label: "Remarkable Athlete", value },
      `Champion ${level}`,
    );
  }
});

test("a Fighter who is not a Champion gets no Remarkable Athlete line", () => {
  const evaluated = initiativeOf([fighterOther(7)], scores({ dex: 14 }));
  assert.deepEqual(evaluated.initiativeBreakdown, [{ label: "Dexterity", value: 2 }]);
});

// Initiative: the higher of the two, never the sum

test("a Bard 2 and Champion 7 at proficiency bonus 4 gets one half-proficiency line, not two", () => {
  const evaluated = initiativeOf([bard(2), champion(7)], scores({ dex: 14 }));
  assert.equal(evaluated.initiative, 4, "both halves are 2 at proficiency bonus 4, and only one applies");
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Remarkable Athlete", value: 2 },
  ]);
});

test("a Bard 2 and Champion 13 at proficiency bonus 5 gets the larger half, Remarkable Athlete's rounded up", () => {
  const evaluated = initiativeOf([bard(2), champion(13)], scores({ dex: 14 }));
  assert.equal(evaluated.initiative, 5, "Remarkable Athlete 3, not Jack of All Trades 2 and not 2 + 3");
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Remarkable Athlete", value: 3 },
  ]);
});

test("the half-proficiency line comes after the Initiative Bonus lines", () => {
  const evaluated = evaluateCharacter(
    makeChar({
      classes: [scout(3, "Sample Blade"), champion(7)],
      baseAbilityScores: scores({ dex: 14, cha: 16 }),
    }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 7, "Dexterity 2, Sample Gambit 3, Remarkable Athlete 2");
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Gambit", value: 3 },
    { label: "Remarkable Athlete", value: 2 },
  ]);
});

test("a Bard of 1st level with an Initiative Bonus shows only the bonus line after Dexterity", () => {
  const evaluated = initiativeOf([scout(3, "Sample Blade"), bard(1)], scores({ dex: 14, cha: 16 }));
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Gambit", value: 3 },
  ]);
});

// Skills

test("a non-proficient Athletics gets Remarkable Athlete's half proficiency, rounded up, from a Champion of 7th level", () => {
  const row = skillRow([champion(7)], "Athletics", { baseAbilityScores: scores({ str: 16 }) });
  assert.equal(row.bonus, 3 + 2, "Strength modifier 3 plus ceil(3/2)");
  assert.equal(row.isJackOfAllTrades, false);
  assert.equal(row.halfProficiency, "Remarkable Athlete");
});

test("a non-proficient Acrobatics and Stealth get Remarkable Athlete from a Champion of 7th level", () => {
  for (const name of ["Acrobatics", "Stealth"]) {
    const row = skillRow([champion(7)], name, { baseAbilityScores: scores({ dex: 14 }) });
    assert.equal(row.bonus, 2 + 2, name);
    assert.equal(row.halfProficiency, "Remarkable Athlete", name);
  }
});

test("a Champion of 6th level gets no Remarkable Athlete on skills", () => {
  const row = skillRow([champion(6)], "Athletics", { baseAbilityScores: scores({ str: 16 }) });
  assert.equal(row.bonus, 3);
  assert.equal(row.halfProficiency, null);
});

test("Remarkable Athlete does not reach a non-STR/DEX/CON skill", () => {
  const row = skillRow([champion(7)], "Perception", { baseAbilityScores: scores({ wis: 14 }) });
  assert.equal(row.bonus, 2, "Wisdom modifier only, no half proficiency");
  assert.equal(row.halfProficiency, null);
  assert.equal(row.isJackOfAllTrades, false);
});

test("a proficient Athletics keeps its proficiency bonus and is not given Remarkable Athlete", () => {
  const row = skillRow([champion(7)], "Athletics", { baseAbilityScores: scores({ str: 16 }), chosenSkills: ["Athletics"] });
  assert.equal(row.bonus, 3 + 3);
  assert.equal(row.isProficient, true);
  assert.equal(row.halfProficiency, null);
});

test("an expertise Athletics keeps double the proficiency bonus", () => {
  const row = skillRow([champion(7)], "Athletics", {
    baseAbilityScores: scores({ str: 16 }),
    chosenSkills: ["Athletics"],
    chosenExpertise: ["Athletics"],
  });
  assert.equal(row.bonus, 3 + 6);
  assert.equal(row.isExpertise, true);
  assert.equal(row.halfProficiency, null);
});

test("Remarkable Athlete and Jack of All Trades together on skills: the higher applies per skill", () => {
  // Bard 2 plus Champion 13 is level 15, proficiency bonus 5: Remarkable Athlete 3, Jack of All Trades 2.
  const classes = [bard(2), champion(13)];
  const athletics = skillRow(classes, "Athletics", { baseAbilityScores: scores({ str: 12 }) });
  assert.equal(athletics.bonus, 1 + 3, "Athletics takes Remarkable Athlete's 3");
  assert.equal(athletics.halfProficiency, "Remarkable Athlete");

  const investigation = skillRow(classes, "Investigation", { baseAbilityScores: scores({ int: 12 }) });
  assert.equal(investigation.bonus, 1 + 2, "Investigation takes Jack of All Trades' 2");
  assert.equal(investigation.isJackOfAllTrades, true);
  assert.equal(investigation.halfProficiency, "Jack of All Trades");
});

test("Bard 2 with Champion 7 on a STR/DEX skill at proficiency bonus 4 gives the one value, not the sum", () => {
  const row = skillRow([bard(2), champion(7)], "Acrobatics", { baseAbilityScores: scores({ dex: 10 }) });
  assert.equal(row.bonus, 2, "half of proficiency bonus 4, applied once");
});

test("Jack of All Trades still applies to a non-proficient skill that Remarkable Athlete does not reach", () => {
  const row = skillRow([bard(2)], "Perception", { baseAbilityScores: scores({ wis: 14 }) });
  assert.equal(row.bonus, 2 + 1);
  assert.equal(row.isJackOfAllTrades, true);
  assert.equal(row.halfProficiency, "Jack of All Trades");
});

test("a Champion named only in the subclass field, and not in subclassName, gets Remarkable Athlete", () => {
  const row = skillRow(
    [{ className: "Fighter", source: "PHB", level: 7, subclass: "Champion" }],
    "Athletics",
    { baseAbilityScores: scores({ str: 16 }) },
  );
  assert.equal(row.bonus, 3 + 2, "Strength modifier 3 plus ceil(3/2)");
  assert.equal(row.halfProficiency, "Remarkable Athlete");
});
