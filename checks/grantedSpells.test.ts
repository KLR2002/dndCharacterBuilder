import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { validateFeatPrerequisites } from "../src/rules/feats.ts";
import { toggleInnateSpellUse } from "../src/rules/characterSpells.ts";
import { applyLongRest } from "../src/rules/rest.ts";
import type { AbilityKey, AbilityScores, AsiSelection, CharacterClass } from "../src/types/character.ts";
import type { ClassData } from "../src/types/dnd5e.ts";
import type { InnateSpellProfile } from "../src/rules/innateMagic.ts";
import { inMemoryCompendium, loadSrdCatalog, makeChar } from "./testUtils.ts";
import { grantedSpellClasses, grantedSpellFeats, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// Granted spells are Innate Magic from a feat the character holds (ADR 0017). Every name here is invented
// (checks/grantedSpellsFixture.ts). The sample mage is level 4, so its proficiency bonus is +2.

const catalogs = {
  compendium: inMemoryCompendium({
    classes: grantedSpellClasses(),
    feats: grantedSpellFeats(),
    spells: grantedSpellSpells(),
  }),
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

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });

/** A feat taken through an ability score improvement; `featAbility` is the ability the increase raised. */
const takenFeat = (featName: string, featAbility?: AbilityKey): AsiSelection => ({
  level: 4,
  type: "feat",
  featName,
  featSource: "TST",
  ...(featAbility ? { featAbility } : {}),
});

const sourceTitled = (sources: InnateSpellProfile[], title: string) => sources.find((source) => source.title === title);

test("a character with no feat that grants spells has no Innate Magic sources", () => {
  const evaluated = evaluateCharacter(makeChar({ classes: [mage(4)] }), catalogs);
  assert.deepEqual(evaluated.grantedSpellSources, []);
});

test("a feat's fixed cantrip is at will, on a card titled for the feat", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Cinder", "int")] }),
    catalogs,
  );
  const cinder = sourceTitled(evaluated.grantedSpellSources, "Sample Cinder");
  assert.ok(cinder, "the feat has a source titled by its name");
  const ember = cinder.spells.find((spell) => spell.name === "Sample Ember");
  assert.ok(ember, "the cantrip is listed");
  assert.equal(ember.isCantrip, true);
  assert.equal(ember.resourceCounterId, undefined, "a cantrip has no counter: it is at will");
});

test("a feat's fixed daily spell has a Long Rest counter, and a long rest restores it", () => {
  const character = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Cinder", "int")] });
  const evaluated = evaluateCharacter(character, catalogs);
  const veil = sourceTitled(evaluated.grantedSpellSources, "Sample Cinder")?.spells.find((spell) => spell.name === "Sample Veil");
  assert.ok(veil?.resourceCounterId, "the daily spell has a counter");
  assert.equal(veil.maxUses, 1);

  const used = toggleInnateSpellUse(character, veil);
  assert.equal(used.resourceCounters[veil.resourceCounterId!]?.current, 0, "casting it uses the counter");
  const rested = applyLongRest(used);
  assert.equal(rested.resourceCounters[veil.resourceCounterId!]?.current, 1, "a long rest restores the counter");
});

test("an innate spell that is at will carries no counter, even when it is not a cantrip", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Sight", "int")] }),
    catalogs,
  );
  const sight = sourceTitled(evaluated.grantedSpellSources, "Sample Sight");
  const veil = sight?.spells.find((spell) => spell.name === "Sample Veil");
  assert.ok(veil, "the at-will spell is listed");
  assert.equal(veil.isCantrip, false);
  assert.equal(veil.resourceCounterId, undefined, "no counter: it is cast at will");
});

test("a fixed ability gives the feat's own save DC and attack bonus from that ability", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Warding")], baseAbilityScores: scores({ wis: 16 }) }),
    catalogs,
  );
  const warding = sourceTitled(evaluated.grantedSpellSources, "Sample Warding");
  assert.ok(warding);
  assert.equal(warding.ability, "wis");
  assert.equal(warding.spellSaveDc, 8 + 2 + 3, "8 + proficiency bonus + Wisdom modifier");
  assert.equal(warding.spellAttackBonus, 2 + 3, "proficiency bonus + Wisdom modifier");
});

test("an inherited ability is the ability the feat's increase raised, scores included", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Cinder", "cha")], baseAbilityScores: scores({ cha: 13, int: 10 }) }),
    catalogs,
  );
  const cinder = sourceTitled(evaluated.grantedSpellSources, "Sample Cinder");
  assert.ok(cinder);
  assert.equal(cinder.ability, "cha");
  assert.equal(cinder.spellSaveDc, 8 + 2 + 2, "CHA 13 raised to 14 is +2");
  assert.equal(cinder.spellAttackBonus, 2 + 2);
});

test("two feats with different abilities each give their own save DC and attack bonus", () => {
  const evaluated = evaluateCharacter(
    makeChar({
      classes: [mage(4)],
      asiSelections: [takenFeat("Sample Cinder", "int"), takenFeat("Sample Warding")],
      baseAbilityScores: scores({ int: 13, wis: 16 }),
    }),
    catalogs,
  );
  const cinder = sourceTitled(evaluated.grantedSpellSources, "Sample Cinder");
  const warding = sourceTitled(evaluated.grantedSpellSources, "Sample Warding");
  assert.equal(evaluated.grantedSpellSources.length, 2);
  assert.equal(cinder?.ability, "int");
  assert.equal(cinder?.spellSaveDc, 8 + 2 + 2, "INT 13 raised to 14 is +2");
  assert.equal(warding?.ability, "wis");
  assert.equal(warding?.spellSaveDc, 8 + 2 + 3);
});

test("a feat held as an origin feat gives its source, and a feat held both ways gives one", () => {
  const originOnly = evaluateCharacter(
    makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Warding")], baseAbilityScores: scores({ wis: 14 }) }),
    catalogs,
  );
  assert.equal(originOnly.grantedSpellSources.filter((source) => source.title === "Sample Warding").length, 1);

  const bothWays = evaluateCharacter(
    makeChar({
      classes: [mage(4)],
      asiSelections: [takenFeat("Sample Warding")],
      originFeats: [takenFeat("Sample Warding")],
      baseAbilityScores: scores({ wis: 14 }),
    }),
    catalogs,
  );
  assert.equal(bothWays.grantedSpellSources.filter((source) => source.title === "Sample Warding").length, 1);
});

test("a feat whose ability is a pick gives a card with a needs-review notice and no ability until the pick is made", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Chooser", "int")] }),
    catalogs,
  );
  const chooser = sourceTitled(evaluated.grantedSpellSources, "Sample Chooser");
  assert.ok(chooser, "the fixed cantrip is shown, so the player sees what the feat gives");
  assert.deepEqual(chooser.spells.map((s) => s.name), ["Sample Ember"]);
  assert.equal(chooser.ability, undefined, "no ability is invented");
  assert.ok(chooser.notices?.some((notice) => /casting ability/i.test(notice)));
});

test("a feat whose only spell is a pick that has not been made gives a card with a needs-review notice and no spell", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Picker")] }),
    catalogs,
  );
  const picker = sourceTitled(evaluated.grantedSpellSources, "Sample Picker");
  assert.ok(picker, "the card is kept, so the player can see what is missing");
  assert.deepEqual(picker.spells, [], "the unpicked spell is not invented");
  assert.ok(picker.notices?.length, "the unpicked part raises a needs-review notice");
});

test("a named spell list the player has not chosen gives a card with a needs-review notice and no spells", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Initiate")] }),
    catalogs,
  );
  const initiate = sourceTitled(evaluated.grantedSpellSources, "Sample Initiate");
  assert.ok(initiate, "the feat keeps its card until a list is chosen");
  assert.equal(initiate.ability, undefined, "no list chosen, so no casting ability yet");
  assert.equal(initiate.spellSaveDc, undefined);
  assert.deepEqual(initiate.spells, []);
  assert.ok(initiate.notices?.some((notice) => /spell list/i.test(notice)), "the notice asks for the list");
});

test("an inherited ability with no recorded increase keeps its card and raises a needs-review notice", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Cinder")] }),
    catalogs,
  );
  const cinder = sourceTitled(evaluated.grantedSpellSources, "Sample Cinder");
  assert.ok(cinder, "the card is not silently lost");
  assert.equal(cinder.ability, undefined, "the ability is unknown until the increase is recorded");
  assert.ok(cinder.spells.some((spell) => spell.name === "Sample Ember"), "the fixed cantrip is still listed");
  assert.ok(cinder.notices?.length, "a notice says what is missing");
});

test("a granted SRD Baseline spell stays on whatever books are switched on, as it does for class lists", () => {
  const flicker = evaluateCharacter(
    makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Flicker Grant", "int")] }),
    { compendium: catalogs.compendium, activeBooks: ["TST"] },
  );
  assert.ok(sourceTitled(flicker.grantedSpellSources, "Sample Flicker Grant")?.spells.some((spell) => spell.name === "Sample Flicker"));
});

test("a granted spell from a book that is switched off resolves to nothing", () => {
  const sparkle = (activeBooks?: string[]) =>
    evaluateCharacter(
      makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Sparkle", "int")] }),
      { compendium: catalogs.compendium, activeBooks },
    );
  assert.equal(sourceTitled(sparkle(["TST"]).grantedSpellSources, "Sample Sparkle"), undefined, "its only spell is in TST2, which is off");
  const onBook = sourceTitled(sparkle(["TST", "TST2"]).grantedSpellSources, "Sample Sparkle");
  assert.ok(onBook?.spells.some((spell) => spell.name === "Sample Spark"), "with the book on, the spell is listed");
});

test("granted spells are in no class's known or prepared list and leave its limits as they were", () => {
  // The class profiles read the SRD class list, so this one test holds the SRD Wizard, not the sample mage.
  const wizardCatalogs = {
    compendium: inMemoryCompendium({ classes: loadSrdCatalog<ClassData[]>("classes").filter((c) => c.name === "Wizard"), feats: grantedSpellFeats(), spells: grantedSpellSpells() }),
  };
  const wizard = (level: number): CharacterClass => ({ className: "Wizard", source: "PHB", level });
  const base = evaluateCharacter(makeChar({ classes: [wizard(4)] }), wizardCatalogs);
  const granted = evaluateCharacter(
    makeChar({ classes: [wizard(4)], asiSelections: [takenFeat("Sample Cinder", "int"), takenFeat("Sample Warding")] }),
    wizardCatalogs,
  );
  assert.equal(granted.spellProfiles.length, 1, "the class still has its one spell profile");
  const [before] = base.spellProfiles;
  const [after] = granted.spellProfiles;
  assert.deepEqual(after.knownSpells, before.knownSpells, "the known list is unchanged");
  assert.deepEqual(after.preparedSpells, before.preparedSpells, "the prepared list is unchanged");
  assert.equal(after.preparedLimit, before.preparedLimit, "the preparation limit is unchanged");
  assert.ok(
    !granted.spellProfiles.some((profile) => profile.knownSpells.some((spell) => spell.name === "Sample Ember")),
    "a granted cantrip is not a known spell of the class",
  );
});

test("a granted spell satisfies a feat prerequisite of being able to cast a spell, and nothing else does", () => {
  const prerequisite = { name: "Sample Requirement", prerequisite: "The ability to cast at least one spell" };
  const withGrant = makeChar({ asiSelections: [takenFeat("Sample Cinder", "int")] });
  const withoutGrant = makeChar({});
  assert.equal(validateFeatPrerequisites(withGrant, prerequisite, { catalogs }).met, true);
  assert.equal(validateFeatPrerequisites(withoutGrant, prerequisite, { catalogs }).met, false);
});

test("a leveled spell in a feat's known group is cast once per Long Rest, and a cantrip beside it stays at will", () => {
  const character = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Study", "int")] });
  const card = sourceTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Study");
  assert.equal(card?.spells.find((spell) => spell.name === "Sample Ember")?.resourceCounterId, undefined, "the cantrip is at will");
  const veil = card?.spells.find((spell) => spell.name === "Sample Veil");
  assert.ok(veil?.resourceCounterId, "the leveled spell has a Long Rest counter");
  assert.equal(veil.maxUses, 1);
  const used = toggleInnateSpellUse(character, veil);
  assert.equal(applyLongRest(used).resourceCounters[veil.resourceCounterId!]?.current, 1, "a long rest restores it");
});

test("a source with a pick still owed and no spell does not satisfy the prerequisite of being able to cast a spell", () => {
  const prerequisite = { name: "Sample Requirement", prerequisite: "The ability to cast at least one spell" };
  const pickOnly = makeChar({ asiSelections: [takenFeat("Sample Picker", "int")] });
  assert.equal(validateFeatPrerequisites(pickOnly, prerequisite, { catalogs }).met, false);
});
