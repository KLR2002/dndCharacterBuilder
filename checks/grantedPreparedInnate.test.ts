import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { grantedSpellSources } from "../src/rules/grantedSpells.ts";
import { featCounterId, featSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import type { AbilityKey, AbilityScores, AsiSelection, Character, CharacterClass, RuleChoiceEntry } from "../src/types/character.ts";
import type { ClassSpellProfile } from "../src/rules/spellcasting.ts";
import type { InnateSpellProfile } from "../src/rules/innateMagic.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedSpellClasses } from "./grantedSpellsFixture.ts";
import { preparedGrantFeats, preparedGrantRaces, preparedGrantSpells } from "./grantedPreparedFixture.ts";

// A prepared group that names its own casting ability, or gives at-will or daily casts, is Innate Magic: a card with that
// ability's DC and attack, and its spells are not in any class list (ADR 0017 amendment). Every name here is invented
// (checks/grantedPreparedFixture.ts). A plain prepared group stays in the class list (grantedPrepared.test.ts).

const compendium = inMemoryCompendium({
  classes: grantedSpellClasses(),
  feats: preparedGrantFeats(),
  races: preparedGrantRaces(),
  spells: preparedGrantSpells(),
});
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

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });
const cleric = (level: number): CharacterClass => ({ className: "Sample Cleric", source: "TST", level });

/** A feat taken through an ability score improvement at level 4, with the ability its increase raised when given. */
const takenFeat = (featName: string, featAbility?: AbilityKey): AsiSelection => ({
  level: 4,
  type: "feat",
  featName,
  featSource: "TST",
  ...(featAbility ? { featAbility } : {}),
});

/** The casting ability a player picked for a feat (its Rule Choice id is the feat's owner key and "Casting Ability"). */
const featAbilityPick = (featName: string, picked: AbilityKey): RuleChoiceEntry => ({
  id: `TST__Feat Spells__${featName}__Casting Ability`,
  trait: `${featName} Casting Ability`,
  origin: "feat",
  choose: 1,
  from: ["int", "wis", "cha"],
  picked: [picked],
});

const sourceTitled = (sources: InnateSpellProfile[], title: string): InnateSpellProfile | undefined =>
  sources.find((source) => source.title === title);

const profileFor = (profiles: ClassSpellProfile[], className: string): ClassSpellProfile => {
  const profile = profiles.find((p) => p.className === className);
  assert.ok(profile, `${className} has a spell profile`);
  return profile;
};

const listedNames = (profile: ClassSpellProfile): string[] => (profile.alwaysPreparedSpells ?? []).map((s) => s.name);

test("a prepared group naming its own ability is a card with that ability's DC and attack, and its spells are in no class list", () => {
  // Total level 5 gives proficiency +3. Intelligence 16 gives +3, so the card's DC is 14 and its attack bonus is +6.
  const character = makeChar({
    classes: [mage(4), cleric(1)],
    asiSelections: [takenFeat("Sample Ember Mark")],
    baseAbilityScores: scores({ int: 16 }),
    ruleChoices: [featAbilityPick("Sample Ember Mark", "int")],
  });
  const card = sourceTitled(grantedSpellSources(character, catalogs), "Sample Ember Mark");
  assert.ok(card, "the feat has its own card");
  assert.equal(card.ability, "int");
  assert.equal(card.spellSaveDc, 14);
  assert.equal(card.spellAttackBonus, 6);
  const bulwark = card.spells.find((spell) => spell.name === "Sample Bulwark");
  assert.ok(bulwark, "the daily spell is on the card");
  assert.equal(bulwark.maxUses, 1, "a daily spell is cast once per Long Rest");
  assert.ok(bulwark.resourceCounterId, "and carries a Long Rest counter");

  const evaluated = evaluateCharacter(character, catalogs);
  for (const className of ["Sample Mage", "Sample Cleric"]) {
    assert.ok(!listedNames(profileFor(evaluated.spellProfiles, className)).includes("Sample Bulwark"), `${className}'s list does not hold it`);
  }
  assert.deepEqual(
    evaluated.spellProfiles.flatMap((profile) => profile.knownSpells.map((k) => k.name)).filter((name) => name === "Sample Bulwark"),
    [],
    "and it is stored nowhere",
  );
});

test("a chosen ability not yet picked keeps the card's spells, with no DC, and raises a notice; the ability is offered on the feat", () => {
  const character = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Ember Mark")] });
  const card = sourceTitled(grantedSpellSources(character, catalogs), "Sample Ember Mark");
  assert.ok(card, "the card stays, so its spell is not lost");
  assert.equal(card.ability, undefined);
  assert.equal(card.spellSaveDc, undefined);
  assert.deepEqual(card.notices, ["Needs review: choose a casting ability"]);
  assert.ok(card.spells.some((spell) => spell.name === "Sample Bulwark"));
  assert.ok(
    featSpellRuleChoices(character, compendium).some((choice) => choice.id === "TST__Feat Spells__Sample Ember Mark__Casting Ability"),
    "the ability pick is offered where the feat is held",
  );
});

test("a fixed ability's prepared group is a card with that ability, at-will spells, and a spell from its level", () => {
  // Wisdom 14 gives +2. Level 2 has proficiency +2, so the DC is 12; the same card is read from level 3 with the level-3 spell.
  const holding = (level: number) =>
    makeChar({ classes: [mage(level)], asiSelections: [takenFeat("Sample Ward Mark")], baseAbilityScores: scores({ wis: 14 }) });
  const below = sourceTitled(grantedSpellSources(holding(2), catalogs), "Sample Ward Mark");
  assert.ok(below, "the card is there at level 2");
  assert.equal(below.ability, "wis");
  assert.equal(below.spellSaveDc, 12);
  assert.equal(below.spellAttackBonus, 4);
  const bulwark = below.spells.find((spell) => spell.name === "Sample Bulwark");
  assert.equal(bulwark?.resourceCounterId, undefined, "an at-will spell has no counter");
  assert.equal(bulwark?.maxUses, undefined);
  assert.ok(!below.spells.some((spell) => spell.name === "Sample Thread"), "the level 3 spell is absent at level 2");

  const from = sourceTitled(grantedSpellSources(holding(3), catalogs), "Sample Ward Mark");
  assert.ok(from?.spells.some((spell) => spell.name === "Sample Thread"), "the level 3 spell is on the card at level 3");
  assert.ok(!listedNames(profileFor(evaluateCharacter(holding(3), catalogs).spellProfiles, "Sample Mage")).includes("Sample Bulwark"));
});

test("an inherited ability is read from the feat's ability increase, and a missing increase raises a notice", () => {
  const withIncrease = makeChar({
    classes: [mage(4)],
    asiSelections: [takenFeat("Sample Familiar Mark", "wis")],
    baseAbilityScores: scores({ wis: 16 }),
  });
  const card = sourceTitled(grantedSpellSources(withIncrease, catalogs), "Sample Familiar Mark");
  assert.equal(card?.ability, "wis", "the card casts with the ability the increase raised");
  // Level 4 has proficiency +2 and Wisdom 16 gives +3.
  assert.equal(card?.spellSaveDc, 13);
  assert.equal(card?.notices, undefined);

  const withoutIncrease = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Familiar Mark")] });
  const pending = sourceTitled(grantedSpellSources(withoutIncrease, catalogs), "Sample Familiar Mark");
  assert.equal(pending?.ability, undefined);
  assert.deepEqual(pending?.notices, ["Needs review: the ability increase is not recorded"]);
});

test("a prepared group with daily casts and no ability is a card with no ability, DC or attack row", () => {
  const character = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Cloud Mark")] });
  const card = sourceTitled(grantedSpellSources(character, catalogs), "Sample Cloud Mark");
  assert.ok(card, "the feat has its own card");
  assert.equal(card.ability, undefined);
  assert.equal(card.spellSaveDc, undefined);
  assert.equal(card.spellAttackBonus, undefined);
  assert.equal(card.notices, undefined, "no ability is named, so there is none to choose");
  const lure = card.spells.find((spell) => spell.name === "Sample Lure");
  assert.equal(lure?.maxUses, 1, "the daily spell has a Long Rest counter");
  assert.ok(lure?.resourceCounterId);
  assert.ok(!listedNames(profileFor(evaluateCharacter(character, catalogs).spellProfiles, "Sample Mage")).includes("Sample Lure"));
});

test("a named list with its own ability is a card once picked, and its spell's counter is named for the list", () => {
  const character = makeChar({
    classes: [mage(4)],
    asiSelections: [takenFeat("Sample Boon")],
    ruleChoices: [
      {
        id: "TST__Feat Spells__Sample Boon__Spell List",
        trait: "Sample Boon Spell List",
        origin: "feat",
        choose: 1,
        from: ["Sample Mark A", "Sample Mark B"],
        picked: ["Sample Mark A"],
      },
      featAbilityPick("Sample Boon", "cha"),
    ],
  });
  const card = sourceTitled(grantedSpellSources(character, catalogs), "Sample Boon (Sample Mark A)");
  assert.ok(card, "the picked list has its card");
  assert.equal(card.ability, "cha");
  const bulwark = card.spells.find((spell) => spell.name === "Sample Bulwark");
  assert.equal(bulwark?.resourceCounterId, featCounterId("Sample Boon", "Sample Mark A", "Sample Bulwark"));
  assert.ok(!listedNames(profileFor(evaluateCharacter(character, catalogs).spellProfiles, "Sample Mage")).includes("Sample Bulwark"));
});

test("a race's prepared group with a chosen ability is a card with that ability, its spell on a Long Rest counter, and not in the class list", () => {
  const character = makeChar({
    classes: [mage(4)],
    race: { name: "Sample Hexed", source: "TST" },
    ruleChoices: [
      {
        id: "-__Race Spells__Sample Hexed__Casting Ability",
        trait: "Sample Hexed Casting Ability",
        origin: "race",
        choose: 1,
        from: ["int", "wis", "cha"],
        picked: ["cha"],
      },
    ],
  });
  const card = sourceTitled(grantedSpellSources(character, catalogs), "Sample Hexed");
  assert.ok(card, "the race has its card");
  assert.equal(card.ability, "cha");
  const fetch = card.spells.find((spell) => spell.name === "Sample Fetch");
  assert.equal(fetch?.maxUses, 1, "the once-per-rest spell is cast once per Long Rest");
  assert.ok(!listedNames(profileFor(evaluateCharacter(character, catalogs).spellProfiles, "Sample Mage")).includes("Sample Fetch"));
});
