import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import type { AbilityScores, Character, CharacterClass } from "../src/types/character.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { ruleChoiceId } from "../src/rules/ruleChoices.ts";
import { initiativeClasses, initiativeFeats, initiativeRaces } from "./initiativeFixture.ts";

// Initiative is the Dexterity modifier plus each Initiative Bonus the character's features carry (ADR 0016). The
// classes, feats and races are invented (checks/initiativeFixture.ts); the engine reads their bonuses the same way for every rule.

const catalogs = {
  compendium: inMemoryCompendium({ classes: initiativeClasses(), feats: initiativeFeats(), races: initiativeRaces() }),
};

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

const warden = (level: number): CharacterClass => ({ className: "Sample Warden", source: "PHB", level });

const watchword = { level: 4, type: "feat" as const, featName: "Sample Watchword", featSource: "PHB" };
const originWatchword = { ...watchword, level: 1 };

test("a feat's flat Initiative Bonus adds to initiative when the feat is taken through an ability score improvement", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [scout(4)], baseAbilityScores: scores({ dex: 14 }), asiSelections: [watchword] }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 7);
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Watchword", value: 5 },
  ]);
});

test("a feat's flat Initiative Bonus adds to initiative when the feat is an origin feat", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [scout(4)], baseAbilityScores: scores({ dex: 14 }), originFeats: [originWatchword] }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 7);
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Watchword", value: 5 },
  ]);
});

test("a feat held through both an ability score improvement and an origin feat is counted once", () => {
  const evaluated = evaluateCharacter(
    makeChar({
      classes: [scout(4)],
      baseAbilityScores: scores({ dex: 14 }),
      asiSelections: [watchword],
      originFeats: [originWatchword],
    }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 7);
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Watchword", value: 5 },
  ]);
});

test("a proficiency Initiative Bonus is the proficiency bonus, and grows with character level", () => {
  const at3 = evaluateCharacter(makeChar({ classes: [warden(3)], baseAbilityScores: scores({ dex: 14 }) }), catalogs);
  assert.equal(at3.initiative, 4, "DEX +2 and proficiency +2 at level 3");
  assert.deepEqual(at3.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Vigil", value: 2 },
  ]);
  const at5 = evaluateCharacter(makeChar({ classes: [warden(5)], baseAbilityScores: scores({ dex: 14 }) }), catalogs);
  assert.equal(at5.initiative, 5, "proficiency +3 at level 5");
  assert.deepEqual(at5.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Vigil", value: 3 },
  ]);
});

test("a proficiency Initiative Bonus is absent below the level of its feature", () => {
  const evaluated = evaluateCharacter(makeChar({ classes: [warden(2)], baseAbilityScores: scores({ dex: 14 }) }), catalogs);
  assert.equal(evaluated.initiative, 2);
  assert.deepEqual(evaluated.initiativeBreakdown, [{ label: "Dexterity", value: 2 }]);
});

test("ability, flat and proficiency bonuses from a feat and two classes all stack, in the order the features are held", () => {
  const evaluated = evaluateCharacter(
    makeChar({
      classes: [scout(3, "Sample Blade"), mage(2), warden(3)],
      baseAbilityScores: scores({ dex: 14, cha: 16, int: 14 }),
      asiSelections: [watchword],
    }),
    catalogs,
  );
  // Total level 8, so the proficiency bonus is +3: DEX +2, CHA +3, INT +2, proficiency +3, flat +5.
  assert.equal(evaluated.initiative, 15);
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Gambit", value: 3 },
    { label: "Sample Insight", value: 2 },
    { label: "Sample Vigil", value: 3 },
    { label: "Sample Watchword", value: 5 },
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

const kin = (subrace?: { name: string; source: string }): Character["race"] => ({
  name: "Sample Kin",
  source: "PHB",
  ...(subrace ? { subraceName: subrace.name, subraceSource: subrace.source } : {}),
});

test("a race trait's Initiative Bonus adds to initiative, on a line named after the trait", () => {
  const evaluated = evaluateCharacter(
    makeChar({ race: kin(), classes: [scout(1)], baseAbilityScores: scores({ dex: 14 }) }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 4, "DEX +2 and proficiency +2 at level 1");
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Hop", value: 2 },
  ]);
});

test("a subrace trait's Initiative Bonus adds to initiative, after the race's own trait", () => {
  const evaluated = evaluateCharacter(
    makeChar({
      race: kin({ name: "Sample Hillward", source: "PHB" }),
      classes: [scout(1)],
      baseAbilityScores: scores({ dex: 14, wis: 14 }),
    }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 6);
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Hop", value: 2 },
    { label: "Sample Gift", value: 2 },
  ]);
});

test("a race trait a variant ancestry replaces adds nothing once the variant's choice replaces it", () => {
  const variantChoice = ruleChoiceId({
    source: "PHB",
    race: "Sample Kin",
    subrace: { name: "Sample Variant" },
    trait: "Variant Feature (Choose 1)",
  });
  const variant = (picked: string) =>
    makeChar({
      race: kin({ name: "Sample Variant", source: "PHB" }),
      classes: [scout(1)],
      baseAbilityScores: scores({ dex: 14 }),
      ruleChoices: [
        { id: variantChoice, trait: "Variant Feature (Choose 1)", origin: "race", choose: 1, from: ["Sample Hop", "Sample Grit"], picked: [picked] },
      ],
    });
  const replaced = evaluateCharacter(variant("Sample Grit"), catalogs);
  assert.equal(replaced.initiative, 2, "the variant replaced Sample Hop, so only Dexterity counts");
  assert.deepEqual(replaced.initiativeBreakdown, [{ label: "Dexterity", value: 2 }]);

  const kept = evaluateCharacter(variant("Sample Hop"), catalogs);
  assert.deepEqual(
    kept.initiativeBreakdown,
    [
      { label: "Dexterity", value: 2 },
      { label: "Sample Hop", value: 2 },
    ],
    "picking the option that keeps Sample Hop keeps its bonus",
  );
});

test("a lineage replacement drops the original race's trait bonus, and the lineage's own trait adds its bonus", () => {
  const evaluated = evaluateCharacter(
    makeChar({
      race: kin(),
      lineageReplacement: "Sample Lineage",
      classes: [scout(1)],
      baseAbilityScores: scores({ dex: 14 }),
    }),
    catalogs,
  );
  assert.equal(evaluated.initiative, 3);
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Sample Trance", value: 1 },
  ]);
});
