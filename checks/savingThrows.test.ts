import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import type { AbilityKey } from "../src/types/character.ts";
import { inMemoryCompendium, integratedTestCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";
import { placeholderFeat } from "./proficiencySheetFixture.ts";

/** The saving-throw card (Stats tab) reads the Proficiency Sheet: proficiency and bonus per ability. */

const proficientAbilities = (saves: Record<AbilityKey, { proficient: boolean }>) =>
  (Object.keys(saves) as AbilityKey[]).filter((key) => saves[key].proficient).sort();

test("a monk at Diamond Soul level shows every saving throw with the proficiency bonus added", () => {
  const evaluated = evaluateCharacter(makeChar({ classes: [{ className: "Monk", source: "SRD", level: 14 }] }), {
    compendium: srdBaselineCompendium(), activeBooks: ALL_BOOKS,
  });
  assert.deepEqual(proficientAbilities(evaluated.saves), ["cha", "con", "dex", "int", "str", "wis"]);
  for (const key of Object.keys(evaluated.saves) as AbilityKey[]) {
    assert.equal(evaluated.saves[key].bonus, evaluated.effectiveScores.modifiers[key] + evaluated.proficiencyBonus);
  }
});

test("a monk below Diamond Soul level keeps only the monk's own saves", () => {
  const evaluated = evaluateCharacter(makeChar({ classes: [{ className: "Monk", source: "SRD", level: 13 }] }), {
    compendium: srdBaselineCompendium(), activeBooks: ALL_BOOKS,
  });
  assert.deepEqual(proficientAbilities(evaluated.saves), ["dex", "str"]);
});

const steadfastFeat = placeholderFeat({
  name: "Steadfast Training",
  grants: [
    {
      id: "FIX/Feat/Steadfast Training@0#0",
      kind: "choice",
      category: "savingThrows",
      count: 1,
      pool: { kind: "names", names: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"] },
    },
  ],
});

test("a feat's raised ability is a proficient save, and removing the feat takes it away", () => {
  const compendium = inMemoryCompendium({ feats: [steadfastFeat] });
  const withFeat = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 4 }],
    asiSelections: [{ level: 4, type: "feat", featName: "Steadfast Training", featSource: "PHB", featAbility: "wis" }],
  });
  assert.deepEqual(proficientAbilities(evaluateCharacter(withFeat, { compendium, activeBooks: ALL_BOOKS }).saves), ["con", "str", "wis"]);

  const withoutFeat = makeChar({ classes: [{ className: "Fighter", source: "PHB", level: 4 }] });
  assert.deepEqual(proficientAbilities(evaluateCharacter(withoutFeat, { compendium, activeBooks: ALL_BOOKS }).saves), ["con", "str"]);
});

test("a multiclass character shows the first class's saves only", () => {
  const evaluated = evaluateCharacter(
    makeChar({
      classes: [
        { className: "Fighter", source: "PHB", level: 1 },
        { className: "Wizard", source: "PHB", level: 1 },
      ],
    }),
    { compendium: inMemoryCompendium(), activeBooks: ALL_BOOKS },
  );
  assert.deepEqual(proficientAbilities(evaluated.saves), ["con", "str"]);
});

test("the integrated Resilient feat makes the ability it raised a proficient save", () => {
  const evaluated = evaluateCharacter(
    makeChar({
      classes: [{ className: "Fighter", source: "PHB", level: 4 }],
      asiSelections: [{ level: 4, type: "feat", featName: "Resilient", featSource: "PHB", featAbility: "wis" }],
    }),
    { compendium: integratedTestCompendium(), activeBooks: ALL_BOOKS },
  );
  assert.deepEqual(proficientAbilities(evaluated.saves), ["con", "str", "wis"]);
});
