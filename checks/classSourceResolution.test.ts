import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { findClassData } from "../src/rules/catalogs.ts";
import { classBaseProficiencies } from "../src/rules/proficiencySources/classBase.ts";
import { grantedFeatures } from "../src/rules/grantedFeatures.ts";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { pruneInvalidProficiencyPicks } from "../src/rules/proficiencyPicks.ts";
import { getSubclassSpells } from "../src/rules/subclassSpells.ts";
import { addMulticlassLevel } from "../src/rules/builderTransitions.ts";
import { hitDiceByType, maxHp } from "../src/rules/hp.ts";
import { getSpellcastingAbility, isCastingClass } from "../src/rules/spellcasting.ts";
import { multiclassSlots } from "../src/rules/slots.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { inMemoryCompendium, integratedTestCompendium, makeChar } from "./testUtils.ts";
import { anyLanguageChoice, wardenClass } from "./proficiencySheetFixture.ts";
import type { CharacterClass } from "../src/types/character.ts";
import type { ClassData, SubclassData } from "../src/types/dnd5e.ts";

// Two invented classes share the name "Wardcaller" but come from different sources, with different
// hit dice, saving throws, armor, features and subclasses. Nothing here is real 5e text.

const ALPHA = "ALPHA";
const BETA = "BETA";

const alphaSubclass: SubclassData = {
  name: "Circle of Stone",
  shortName: "Stone",
  source: ALPHA,
  className: "Wardcaller",
  classSource: ALPHA,
  features: [{ name: "Stone Skin", level: 3, description: "Invented ALPHA subclass feature." }],
  description: "Placeholder description for the Circle of Stone.",
};

const betaSubclass: SubclassData = {
  name: "Circle of Ash",
  shortName: "Ash",
  source: BETA,
  className: "Wardcaller",
  classSource: BETA,
  features: [{ name: "Ashen Step", level: 3, description: "Invented BETA subclass feature." }],
  additionalSpells: [{ expanded: { "1": ["Ember Dart"] } }],
  description: "Placeholder description for the Circle of Ash.",
};

const alphaWardcaller = (overrides: Partial<ClassData> = {}): ClassData =>
  wardenClass({
    name: "Wardcaller",
    source: ALPHA,
    hitDie: "1d10",
    savingThrows: ["Strength", "Constitution"],
    armorProficiencies: ["light armor"],
    features: [{ name: "Ward Sight", level: 1, description: "Invented ALPHA class feature." }],
    subclasses: [alphaSubclass],
    ...overrides,
  });

const betaWardcaller = (overrides: Partial<ClassData> = {}): ClassData =>
  wardenClass({
    name: "Wardcaller",
    source: BETA,
    hitDie: "1d6",
    savingThrows: ["Wisdom", "Charisma"],
    spellcasting: { ability: "Intelligence", progression: "full" },
    armorProficiencies: ["heavy armor"],
    features: [
      {
        name: "Ember Veil",
        level: 1,
        description: "Invented BETA class feature.",
        grants: [anyLanguageChoice("wardcaller_beta_tongue", 1)],
      },
    ],
    subclasses: [betaSubclass],
    ...overrides,
  });

const bothSources = () => inMemoryCompendium({ classes: [alphaWardcaller(), betaWardcaller()] });

const entry = (source: string, level = 3, subclassName?: string, subclassSource?: string): CharacterClass => ({
  className: "Wardcaller",
  source,
  level,
  ...(subclassName ? { subclassName, subclassSource: subclassSource ?? source } : {}),
});

const names = (entries: SheetEntry[]) => entries.map((e) => e.name);

test("findClassData matches name and source exactly, comparing the source case-insensitively", () => {
  const classes = [alphaWardcaller(), betaWardcaller()];
  assert.equal(findClassData(classes, { className: "Wardcaller", source: BETA })?.source, BETA);
  assert.equal(findClassData(classes, { className: "Wardcaller", source: "beta" })?.source, BETA);
  assert.equal(findClassData(classes, { className: "Wardcaller", source: ALPHA })?.source, ALPHA);
});

test("findClassData falls back to the first class with the name when the source is empty or matches nothing", () => {
  const classes = [alphaWardcaller(), betaWardcaller()];
  assert.equal(findClassData(classes, { className: "Wardcaller", source: "" })?.source, ALPHA);
  assert.equal(findClassData(classes, { className: "Wardcaller" })?.source, ALPHA);
  assert.equal(findClassData(classes, { className: "Wardcaller", source: "GAMMA" })?.source, ALPHA);
  assert.equal(findClassData(classes, { className: "Gallowsmith", source: BETA }), undefined);
});

test("class base armor comes from the class the entry names, not the first class of the same name", () => {
  const classes = [alphaWardcaller(), betaWardcaller()];
  assert.deepEqual(classBaseProficiencies(makeChar({ classes: [entry(BETA, 1)] }), classes).armor, ["Heavy armor"]);
  assert.deepEqual(classBaseProficiencies(makeChar({ classes: [entry(ALPHA, 1)] }), classes).armor, ["Light armor"]);
});

test("the proficiency sheet's class armor comes from the second source when the entry names it", () => {
  const compendium = bothSources();
  const beta = proficiencySheet(makeChar({ classes: [entry(BETA, 1)] }), { compendium, activeBooks: ALL_BOOKS });
  assert.deepEqual(names(beta.armor), ["Heavy armor"]);
  const alpha = proficiencySheet(makeChar({ classes: [entry(ALPHA, 1)] }), { compendium, activeBooks: ALL_BOOKS });
  assert.deepEqual(names(alpha.armor), ["Light armor"]);
});

test("granted class features come from the entry's own source", () => {
  const catalog = { races: [], backgrounds: [], feats: [], classes: [alphaWardcaller(), betaWardcaller()], activeBooks: ALL_BOOKS };
  const features = grantedFeatures(makeChar({ classes: [entry(BETA, 1)] }), catalog);
  assert.deepEqual(features.map((f) => f.name), ["Ember Veil"]);
  assert.equal(features[0].source, BETA);
  const alpha = grantedFeatures(makeChar({ classes: [entry(ALPHA, 1)] }), catalog);
  assert.deepEqual(alpha.map((f) => f.name), ["Ward Sight"]);
});

test("a class entry with an empty or unknown source takes the first class of its name for granted features", () => {
  const catalog = { races: [], backgrounds: [], feats: [], classes: [alphaWardcaller(), betaWardcaller()], activeBooks: ALL_BOOKS };
  for (const source of ["", "GAMMA"]) {
    const features = grantedFeatures(makeChar({ classes: [entry(source, 1)] }), catalog);
    assert.deepEqual(features.map((f) => f.name), ["Ward Sight"], `source "${source}"`);
  }
});

test("granted subclass features come from the subclass of the resolved class, and only that class holds it", () => {
  const catalog = { races: [], backgrounds: [], feats: [], classes: [alphaWardcaller(), betaWardcaller()], activeBooks: ALL_BOOKS };
  const beta = grantedFeatures(makeChar({ classes: [entry(BETA, 3, "Circle of Ash", BETA)] }), catalog);
  assert.deepEqual(beta.map((f) => f.name).sort(), ["Ashen Step", "Ember Veil"]);
  // ALPHA's subclass is not a subclass of the BETA class, so naming it on a BETA entry grants nothing.
  const mixed = grantedFeatures(makeChar({ classes: [entry(BETA, 3, "Circle of Stone", ALPHA)] }), catalog);
  assert.deepEqual(mixed.map((f) => f.name), ["Ember Veil"]);
});

test("a saved pick granted by the second source is released when the character holds only the first", () => {
  const compendium = bothSources();
  const picked = makeChar({
    classes: [entry(ALPHA, 1)],
    proficiencyPicks: { wardcaller_beta_tongue: ["Elvish"] },
  });
  const pruned = pruneInvalidProficiencyPicks(picked, compendium, ALL_BOOKS);
  assert.equal(pruned.proficiencyPicks, undefined);
  assert.match(pruned.needsReview?.[0] ?? "", /Ember Veil/);

  const held = makeChar({
    classes: [entry(BETA, 1)],
    proficiencyPicks: { wardcaller_beta_tongue: ["Elvish"] },
  });
  assert.deepEqual(pruneInvalidProficiencyPicks(held, compendium, ALL_BOOKS).proficiencyPicks, {
    wardcaller_beta_tongue: ["Elvish"],
  });
});

test("the subclass spells of a class are read from the source the caller names", () => {
  const compendium = bothSources();
  const beta = getSubclassSpells("Wardcaller", "Circle of Ash", 3, { compendium, classSource: BETA, activeBooks: ALL_BOOKS });
  assert.ok(beta.expanded.includes("Ember Dart"));
  const alpha = getSubclassSpells("Wardcaller", "Circle of Ash", 3, { compendium, classSource: ALPHA, activeBooks: ALL_BOOKS });
  assert.deepEqual(alpha.expanded, []);
});

test("adding a class stores the chosen source on the new class entry", () => {
  const added = addMulticlassLevel(makeChar({ classes: [] }), "Wardcaller", BETA);
  assert.deepEqual(added.classes, [{ className: "Wardcaller", source: BETA, level: 1 }]);
});

test("hit dice and hit points come from the class the entry names", () => {
  const classes = [alphaWardcaller(), betaWardcaller()];
  const alpha = makeChar({ classes: [entry(ALPHA, 3)] });
  const beta = makeChar({ classes: [entry(BETA, 3)] });
  assert.deepEqual(Object.keys(hitDiceByType(alpha, classes)), ["d10"]);
  assert.deepEqual(Object.keys(hitDiceByType(beta, classes)), ["d6"]);
  // The first level takes the full die, each later level the average rounded up, with Constitution at 0.
  assert.equal(maxHp(alpha, {}, classes), 10 + 2 * 6);
  assert.equal(maxHp(beta, {}, classes), 6 + 2 * 4);
});

test("a class the catalog lacks takes the SRD Baseline's hit die, and an empty source takes the first class of its name", () => {
  const fighter = { className: "Fighter", source: "PHB", level: 2 };
  assert.deepEqual(Object.keys(hitDiceByType(makeChar({ classes: [fighter] }), [])), ["d10"]);
  const classes = [alphaWardcaller(), betaWardcaller()];
  assert.deepEqual(Object.keys(hitDiceByType(makeChar({ classes: [entry("", 2)] }), classes)), ["d10"]);
});

test("the proficiency sheet's base saving throws come from the class the entry names", () => {
  const compendium = bothSources();
  assert.deepEqual(names(proficiencySheet(makeChar({ classes: [entry(BETA, 1)] }), { compendium, activeBooks: ALL_BOOKS }).savingThrows), ["Wisdom", "Charisma"]);
  assert.deepEqual(names(proficiencySheet(makeChar({ classes: [entry(ALPHA, 1)] }), { compendium, activeBooks: ALL_BOOKS }).savingThrows), ["Strength", "Constitution"]);
});

test("a class the catalog lacks takes its SRD Baseline saving throws", () => {
  const fighter = { className: "Fighter", source: "PHB", level: 2 };
  assert.deepEqual(
    names(proficiencySheet(makeChar({ classes: [fighter] }), { compendium: inMemoryCompendium(), activeBooks: ALL_BOOKS }).savingThrows),
    ["Strength", "Constitution"],
  );
});

test("the integrated Artificer's saving throws come from its catalog class", () => {
  const sheet = proficiencySheet(makeChar({ classes: [{ className: "Artificer", source: "TCE", level: 1 }] }), {
    compendium: integratedTestCompendium(), activeBooks: ALL_BOOKS,
  });
  assert.deepEqual(names(sheet.savingThrows), ["Constitution", "Intelligence"]);
});

test("caster kind and spell ability come from the class the entry names", () => {
  const classes = [alphaWardcaller(), betaWardcaller()];
  assert.equal(isCastingClass(entry(BETA, 3), classes), true);
  assert.equal(isCastingClass(entry(ALPHA, 3), classes), false);
  assert.equal(getSpellcastingAbility(entry(BETA, 3), classes), "int");
  assert.equal(getSpellcastingAbility(entry(ALPHA, 3), classes), undefined);
  assert.equal(multiclassSlots(makeChar({ classes: [entry(BETA, 3)] }), classes).isSpellcaster, true);
  assert.equal(multiclassSlots(makeChar({ classes: [entry(ALPHA, 3)] }), classes).isSpellcaster, false);
});

test("a caster the catalog lacks takes the SRD Baseline's caster kind and spell ability", () => {
  const wizard = { className: "Wizard", source: "PHB", level: 3 };
  assert.equal(isCastingClass(wizard, []), true);
  assert.equal(getSpellcastingAbility(wizard, []), "int");
  assert.equal(multiclassSlots(makeChar({ classes: [wizard] }), []).isSpellcaster, true);
});

test("a legacy spell list is owned by the first class whose catalog entry casts, read from that class", () => {
  const classes = [alphaWardcaller(), betaWardcaller()];
  const legacy = { ...makeChar({ classes: [entry(ALPHA, 1), entry(BETA, 1)] }), knownSpells: [{ name: "Ember Dart", source: BETA }] };
  assert.deepEqual(migrateCharacter(legacy, undefined, classes, ALL_BOOKS).knownSpells?.map((spell) => spell.ownerKey), [`Wardcaller__${BETA}`]);
});
