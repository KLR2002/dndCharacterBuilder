import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import type { AbilityScores, CharacterClass } from "../src/types/character.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { initiativeClasses } from "./initiativeFixture.ts";

// Initiative is the Dexterity modifier plus each Initiative Bonus the character's features carry (ADR 0016). The
// classes are invented (checks/initiativeFixture.ts); the engine reads their bonuses the same way for every rule.

const catalogs = { compendium: inMemoryCompendium({ classes: initiativeClasses() }) };

const scores = (overrides: Partial<AbilityScores>): AbilityScores => ({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  ...overrides,
});

const scout = (level: number, subclassName?: string): CharacterClass => ({
  className: "Sample Scout",
  source: "PHB",
  level,
  ...(subclassName ? { subclassName, subclassSource: "PHB" } : {}),
});

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "PHB", level });

test("a character with no Initiative Bonus has the Dexterity modifier as initiative, and one line for it", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [scout(1)], baseAbilityScores: scores({ dex: 14 }) }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 2);
  assert.deepEqual(evaluated.initiativeBreakdown, [{ label: "Dexterity", value: 2 }]);
});

test("an ability-modifier Initiative Bonus adds to initiative, on a line named after its feature", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [scout(3, "Sample Blade")], baseAbilityScores: scores({ dex: 14, cha: 16 }) }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 5);
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Gambit", value: 3 },
  ]);
});

test("an Initiative Bonus is absent below the level of its feature", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [scout(2, "Sample Blade")], baseAbilityScores: scores({ dex: 14, cha: 16 }) }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 2);
  assert.deepEqual(evaluated.initiativeBreakdown, [{ label: "Dexterity", value: 2 }]);
});

test("a negative ability modifier adds nothing and its line is left out", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [scout(3, "Sample Blade")], baseAbilityScores: scores({ dex: 14, cha: 8 }) }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 2, "a CHA 8 bonus is 0, not -1");
  assert.deepEqual(evaluated.initiativeBreakdown, [{ label: "Dexterity", value: 2 }]);
});

test("changing subclass swaps the Initiative Bonus", () => {
  const baseAbilityScores = scores({ dex: 14, cha: 16, wis: 14 });
  const blade = evaluateCharacter(makeChar({ classes: [scout(3, "Sample Blade")], baseAbilityScores }), catalogs);
  const watch = evaluateCharacter(makeChar({ classes: [scout(3, "Sample Watch")], baseAbilityScores }), catalogs);
  assert.deepEqual(blade.initiativeBreakdown.map((part) => part.label), ["Dexterity", "Sample Gambit"]);
  assert.deepEqual(watch.initiativeBreakdown.map((part) => part.label), ["Dexterity", "Sample Lookout"]);
  assert.equal(watch.initiative, 4);
});

test("Initiative Bonuses from two classes add together, listed in class order", () => {
  const evaluated = evaluateCharacter(
    makeChar({
      classes: [scout(3, "Sample Blade"), mage(2)],
      baseAbilityScores: scores({ dex: 14, cha: 16, int: 14 }),
    }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 7);
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Gambit", value: 3 },
    { label: "Sample Insight", value: 2 },
  ]);
});

test("a rule reached twice is counted once", () => {
  const evaluated = evaluateCharacter(
    makeChar({
      classes: [scout(3, "Sample Blade"), scout(3, "Sample Blade")],
      baseAbilityScores: scores({ dex: 14, cha: 16 }),
    }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 5);
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Gambit", value: 3 },
  ]);
});

test("an ability-score change moves the Initiative Bonus with the modifier", () => {
  const before = evaluateCharacter(
    makeChar({ classes: [scout(3, "Sample Blade")], baseAbilityScores: scores({ dex: 14, cha: 16 }) }),
    catalogs,
  );
  const after = evaluateCharacter(
    makeChar({ classes: [scout(3, "Sample Blade")], baseAbilityScores: scores({ dex: 14, cha: 18 }) }),
    catalogs,
  );
  assert.equal(before.initiative, 5);
  assert.equal(after.initiative, 6);
  assert.deepEqual(after.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Gambit", value: 4 },
  ]);
});
