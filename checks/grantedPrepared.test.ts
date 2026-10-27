import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { featSpellRuleChoices, raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { grantedPreparedSpells } from "../src/rules/grantedSpells.ts";
import { BACKGROUND_FEAT_SOURCE } from "../src/constants/rules.ts";
import type { AbilityKey, AbilityScores, AsiSelection, Character, CharacterClass, RuleChoiceEntry } from "../src/types/character.ts";
import type { FeatData } from "../src/types/dnd5e.ts";
import type { ClassSpellProfile } from "../src/rules/spellcasting.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedArtificerClass, grantedSpellClasses, grantedSpellSpells } from "./grantedSpellsFixture.ts";
import { preparedGrantFeats, preparedGrantRaces, preparedGrantSpells } from "./grantedPreparedFixture.ts";

// Prepared spells of a held feat or race are Always-Prepared Spells (ADR 0017, amendment). Every name here is invented
// (checks/grantedPreparedFixture.ts). The spells listed are the ones the feat or race's prepared group names.

const compendium = inMemoryCompendium({
  classes: [...grantedSpellClasses(), grantedArtificerClass()],
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
const artificer = (level: number): CharacterClass => ({ className: "Sample Artificer", source: "TST", level });

/** A feat taken through an ability score improvement at level 4. */
const takenFeat = (featName: string, featAbility?: AbilityKey): AsiSelection => ({
  level: 4,
  type: "feat",
  featName,
  featSource: "TST",
  ...(featAbility ? { featAbility } : {}),
});

const profileFor = (profiles: ClassSpellProfile[], className: string): ClassSpellProfile => {
  const profile = profiles.find((p) => p.className === className);
  assert.ok(profile, `${className} has a spell profile`);
  return profile;
};

const listedNames = (profile: ClassSpellProfile): string[] => (profile.alwaysPreparedSpells ?? []).map((s) => s.name);

test("a prepared spell of a held feat is listed in the class list, badged for the feat, and stored nowhere", () => {
  const withFeat = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Keeper Mark", "int")] });
  const without = makeChar({ classes: [mage(4)] });
  const profile = profileFor(evaluateCharacter(withFeat, catalogs).spellProfiles, "Sample Mage");
  const baseline = profileFor(evaluateCharacter(without, catalogs).spellProfiles, "Sample Mage");

  assert.ok(listedNames(profile).includes("Sample Bulwark"), "the prepared spell is listed as always prepared");
  assert.equal(profile.grantedPreparedSources?.["sample bulwark"], "Sample Keeper Mark", "the badge names the feat");
  assert.ok(!profile.knownSpells.some((k) => k.name === "Sample Bulwark"), "not a known spell");
  assert.ok(!profile.preparedSpells.some((key) => key.startsWith("Sample Bulwark__")), "not a stored prepared spell");
  assert.equal(profile.preparedLimit, baseline.preparedLimit, "the prepared limit is unchanged");
  assert.deepEqual(profile.preparedSpells, baseline.preparedSpells, "the prepared count is unchanged");
});

test("a prepared spell is listed in every spellcasting class's list, with each class's own spell ability", () => {
  const character = makeChar({
    classes: [mage(3), cleric(2)],
    asiSelections: [takenFeat("Sample Keeper Mark", "int")],
    baseAbilityScores: scores({ int: 16, wis: 10 }),
  });
  const profiles = evaluateCharacter(character, catalogs).spellProfiles;
  const mageProfile = profileFor(profiles, "Sample Mage");
  const clericProfile = profileFor(profiles, "Sample Cleric");

  assert.ok(listedNames(mageProfile).includes("Sample Bulwark"), "the mage's list has it");
  assert.ok(listedNames(clericProfile).includes("Sample Bulwark"), "the cleric's list has it");
  // Total level 5 gives proficiency +3. The mage casts with Intelligence (+3) and the cleric with Wisdom (+0).
  assert.equal(mageProfile.spellSaveDc, 14);
  assert.equal(mageProfile.spellAttackBonus, 6);
  assert.equal(clericProfile.spellSaveDc, 11);
  assert.equal(clericProfile.spellAttackBonus, 3);
});

test("a prepared spell with a character level is absent below it and listed from it", () => {
  const holding = (level: number) =>
    makeChar({ classes: [mage(level)], race: { name: "Sample Late Blood", source: "TST" } });

  const below = profileFor(evaluateCharacter(holding(2), catalogs).spellProfiles, "Sample Mage");
  const from = profileFor(evaluateCharacter(holding(3), catalogs).spellProfiles, "Sample Mage");
  assert.ok(!listedNames(below).includes("Sample Anchor"), "absent at level 2");
  assert.ok(listedNames(from).includes("Sample Anchor"), "listed at level 3");
});

test("a spell slot level gate counts the pooled slots of a multiclass caster, not the highest single class's", () => {
  // Wizard 3 / Cleric 3 has the pooled table's third-level slots; a Wizard 3 alone has second-level slots.
  const pooled = makeChar({ classes: [mage(3), cleric(3)], asiSelections: [takenFeat("Sample Third Adept")] });
  assert.ok(listedNames(profileFor(evaluateCharacter(pooled, catalogs).spellProfiles, "Sample Mage")).includes("Sample Vigil"), "listed for the pooled slots");

  const single = makeChar({ classes: [mage(3)], asiSelections: [takenFeat("Sample Third Adept")] });
  assert.equal(listedNames(profileFor(evaluateCharacter(single, catalogs).spellProfiles, "Sample Mage")).includes("Sample Vigil"), false, "not listed for a single class's slots");
});

test("an Artificer's levels round up into the pooled slots that gate a prepared spell", () => {
  // Mage 3 with Artificer 3 pools to caster level 5, so the third-level slots. Artificer 3 has its own first-level slots.
  const pooled = makeChar({ classes: [mage(3), artificer(3)], asiSelections: [takenFeat("Sample Third Adept")] });
  assert.ok(listedNames(profileFor(evaluateCharacter(pooled, catalogs).spellProfiles, "Sample Mage")).includes("Sample Vigil"), "listed for the pooled slots");

  // Mage 3 with Artificer 1 pools to caster level 4, so only the second-level slots: the third-level spell is absent.
  const short = makeChar({ classes: [mage(3), artificer(1)], asiSelections: [takenFeat("Sample Third Adept")] });
  assert.equal(listedNames(profileFor(evaluateCharacter(short, catalogs).spellProfiles, "Sample Mage")).includes("Sample Vigil"), false, "absent below the pooled third-level slots");
});

test("a prepared spell with a spell slot level is listed once the character has slots of that level", () => {
  const holding = (level: number) => makeChar({ classes: [mage(level)], asiSelections: [takenFeat("Sample Slot Adept")] });

  // Level 2 has first-level slots only: the first-level spell is listed, the second-level one is not.
  const early = profileFor(evaluateCharacter(holding(2), catalogs).spellProfiles, "Sample Mage");
  assert.ok(listedNames(early).includes("Sample Fetch"));
  assert.ok(!listedNames(early).includes("Sample Thread"));

  // Level 3 has second-level slots, so the second-level spell is listed too.
  const later = profileFor(evaluateCharacter(holding(3), catalogs).spellProfiles, "Sample Mage");
  assert.ok(listedNames(later).includes("Sample Thread"));
});

test("removing the feat removes its prepared spells from every list", () => {
  const character = makeChar({ classes: [mage(4), cleric(1)], asiSelections: [takenFeat("Sample Keeper Mark", "int")] });
  const removed = { ...character, asiSelections: [] };
  for (const className of ["Sample Mage", "Sample Cleric"]) {
    const profile = profileFor(evaluateCharacter(removed, catalogs).spellProfiles, className);
    assert.ok(!listedNames(profile).includes("Sample Bulwark"), `${className} no longer lists it`);
    assert.equal(profile.grantedPreparedSources?.["sample bulwark"], undefined);
  }
});

test("a prepared-only feat offers no casting ability and gives no card", () => {
  const character = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Keeper Mark", "int")] });
  const evaluated = evaluateCharacter(character, catalogs);

  assert.deepEqual(evaluated.grantedSpellSources, [], "no Innate Magic card and no notice-only card");
  const choices = featSpellRuleChoices(character, compendium);
  assert.ok(!choices.some((choice) => choice.id.endsWith("__Casting Ability")), "no ability pick is offered");
});

test("a named prepared list is offered as a list choice, and lists nothing until one is picked", () => {
  const unpicked = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Boon")] });
  assert.deepEqual(listedNames(profileFor(evaluateCharacter(unpicked, catalogs).spellProfiles, "Sample Mage")), []);
  const offered = featSpellRuleChoices(unpicked, compendium);
  assert.ok(offered.some((choice) => choice.id === "TST__Feat Spells__Sample Boon__Spell List"), "the list is offered");
  assert.ok(
    offered.some((choice) => choice.id === "TST__Feat Spells__Sample Boon__Casting Ability"),
    "Sample Mark A names a chosen ability (Innate Magic), so the ability is offered",
  );

  const picked: Character = {
    ...unpicked,
    ruleChoices: [
      {
        id: "TST__Feat Spells__Sample Boon__Spell List",
        trait: "Sample Boon Spell List",
        origin: "feat",
        choose: 1,
        from: ["Sample Mark A", "Sample Mark B"],
        picked: ["Sample Mark B"],
      },
    ],
  };
  const profile = profileFor(evaluateCharacter(picked, catalogs).spellProfiles, "Sample Mage");
  assert.ok(listedNames(profile).includes("Sample Fetch"), "the picked list's spell is listed");
  assert.equal(profile.grantedPreparedSources?.["sample fetch"], "Sample Boon (Sample Mark B)");
  assert.ok(!listedNames(profile).includes("Sample Bulwark"), "the other list's spell is not");
});

test("a prepared pick is listed once the player picks the spell, and is not stored", () => {
  const character = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Pick Feat")] });
  const unpicked = profileFor(evaluateCharacter(character, catalogs).spellProfiles, "Sample Mage");
  assert.deepEqual(listedNames(unpicked), [], "nothing is listed before the pick");

  const pick: RuleChoiceEntry = {
    id: "TST__Feat Spells__Sample Pick Feat__-__0",
    trait: "Sample Pick Feat Spell",
    origin: "feat",
    choose: 1,
    from: ["Sample Lure", "Sample Fetch"],
    picked: ["Sample Lure"],
  };
  const picked: Character = { ...character, ruleChoices: [pick] };
  const profile = profileFor(evaluateCharacter(picked, catalogs).spellProfiles, "Sample Mage");
  assert.ok(listedNames(profile).includes("Sample Lure"));
  assert.ok(!profile.knownSpells.some((k) => k.name === "Sample Lure"));
});

test("a race's plain prepared spell is listed, and offers no ability pick and no card", () => {
  const character = makeChar({ classes: [mage(4)], race: { name: "Sample Late Blood", source: "TST" } });
  const profile = profileFor(evaluateCharacter(character, catalogs).spellProfiles, "Sample Mage");
  assert.ok(listedNames(profile).includes("Sample Anchor"));
  assert.equal(profile.grantedPreparedSources?.["sample anchor"], "Sample Late Blood");
  assert.deepEqual(raceSpellRuleChoices(character, compendium), [], "no ability pick and no pick for the race");
  assert.deepEqual(evaluateCharacter(character, catalogs).grantedSpellSources, [], "no race card");
});

test("a prepared spell is not listed for a character with no spellcasting class", () => {
  const character = makeChar({ classes: [{ className: "Sample Fighter", source: "TST", level: 4 }], asiSelections: [takenFeat("Sample Keeper Mark", "int")] });
  assert.deepEqual(evaluateCharacter(character, catalogs).spellProfiles, []);
});

const fighter = (level: number): CharacterClass => ({ className: "Sample Fighter", source: "TST", level });

const lockedNames = (cards: { spells: { name: string }[] }[]): string[] => cards.flatMap((card) => card.spells.map((s) => s.name));

test("a held plain prepared source gives a locked card to a character with no spellcasting class", () => {
  const character = makeChar({ classes: [fighter(4)], asiSelections: [takenFeat("Sample Keeper Mark", "int")] });
  const evaluated = evaluateCharacter(character, catalogs);

  assert.deepEqual(evaluated.spellProfiles, [], "no class list");
  assert.deepEqual(evaluated.grantedSpellSources, [], "no Innate Magic card");
  assert.equal(evaluated.lockedPreparedCards.length, 1, "one locked card for the source");
  const [card] = evaluated.lockedPreparedCards;
  assert.equal(card.title, "Sample Keeper Mark", "the card is titled with the feat");
  assert.deepEqual(lockedNames([card]), ["Sample Bulwark"], "the card lists the prepared spell");
  assert.ok(!("ability" in card) && !("spellSaveDc" in card) && !("spellAttackBonus" in card), "no ability, save DC or attack row");
  assert.ok(card.spells.every((s) => !("resourceCounterId" in s) && !("maxUses" in s)), "no counters");
});

test("taking a spellcasting class removes the locked card and lists the spell in the class list", () => {
  const character = makeChar({
    classes: [fighter(4), mage(1)],
    asiSelections: [takenFeat("Sample Keeper Mark", "int")],
  });
  const evaluated = evaluateCharacter(character, catalogs);

  assert.deepEqual(evaluated.lockedPreparedCards, [], "the card is gone");
  assert.ok(listedNames(profileFor(evaluated.spellProfiles, "Sample Mage")).includes("Sample Bulwark"), "the class list has the spell");
});

test("a locked card's spell is absent below the character level it is listed from, and a spell slot spell is never on it", () => {
  const holding = (level: number) => makeChar({ classes: [fighter(level)], race: { name: "Sample Late Blood", source: "TST" } });
  assert.deepEqual(evaluateCharacter(holding(2), catalogs).lockedPreparedCards, [], "absent at level 2");
  assert.deepEqual(lockedNames(evaluateCharacter(holding(3), catalogs).lockedPreparedCards), ["Sample Anchor"], "listed at level 3");

  const slotAdept = makeChar({ classes: [fighter(4)], asiSelections: [takenFeat("Sample Slot Adept")] });
  assert.deepEqual(evaluateCharacter(slotAdept, catalogs).lockedPreparedCards, [], "spell slot levels need a spellcasting class");
});

test("a background-claimed feat held in two active books lists the prepared spells of the record the reader offers", () => {
  // The record in TST is the first of the catalog; the background's book, TST2, holds the other one.
  const twinIn = (source: string, spell: string): FeatData => ({
    name: "Sample Twin",
    source,
    prerequisite: null,
    abilityScoreIncrease: null,
    description: "Placeholder description for the feat.",
    additionalSpells: [{ prepared: { _: [spell] } }],
  });
  const twins = inMemoryCompendium(
    {
      classes: grantedSpellClasses(),
      feats: [twinIn("TST", "Sample Pulse"), twinIn("TST2", "Sample Ward")],
      spells: grantedSpellSpells(),
    },
    { integrated: true },
  );
  const character = makeChar({
    classes: [mage(4)],
    background: { name: "Sample Scholar", source: "TST2" },
    originFeats: [{ level: 1, type: "feat", featName: "Sample Twin", featSource: BACKGROUND_FEAT_SOURCE }],
  });
  const granted = grantedPreparedSpells(character, { compendium: twins, activeBooks: ["TST", "TST2"] });
  assert.deepEqual(granted.map((g) => g.spell.name), ["Sample Pulse"], "the record the reader offers gives its spell");
});
