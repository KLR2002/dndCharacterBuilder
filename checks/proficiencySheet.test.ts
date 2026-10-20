import test from "node:test";
import assert from "node:assert/strict";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { validateFeatPrerequisites } from "../src/rules/feats.ts";
import { inMemoryCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";
import type { ProficiencyGrant, SubclassData } from "../src/types/dnd5e.ts";
import type { Character } from "../src/types/character.ts";
import {
  anyLanguageChoice,
  fixedGrant,
  lamplighterBackground,
  placeholderFeat,
  vellariRace,
  wardenClass,
} from "./proficiencySheetFixture.ts";

const names = (entries: SheetEntry[]) => entries.map((entry) => entry.name);

const fixtureCompendium = () =>
  inMemoryCompendium({ races: [vellariRace()], backgrounds: [lamplighterBackground()] });

test("race fixed languages and picked race languages appear on the sheet as rule-granted", () => {
  const sheet = proficiencySheet(
    makeChar({ race: { name: "Vellari", source: "PHB" }, chosenLanguages: { race: ["Elvish"] } }),
    { compendium: fixtureCompendium() },
  );
  assert.deepEqual(names(sheet.languages), ["Common", "Quoral", "Elvish"]);
  assert.ok(sheet.languages.every((entry) => entry.ruleGranted));
});

test("background tools are normalized, and picked background tools are added after them", () => {
  const sheet = proficiencySheet(
    makeChar({
      background: { name: "Lamplighter", source: "PHB" },
      chosenTools: { background: ["Smith's Tools"] },
    }),
    { compendium: fixtureCompendium() },
  );
  assert.deepEqual(names(sheet.tools), ["Lantern Kit", "Smith's Tools"]);
});

test("a language or tool named by two sources appears once, matched case-insensitively", () => {
  const sheet = proficiencySheet(
    makeChar({
      race: { name: "Vellari", source: "PHB" },
      background: { name: "Lamplighter", source: "PHB" },
      chosenLanguages: { race: ["quoral", "common"] },
      chosenTools: { background: ["LANTERN KIT"] },
    }),
    { compendium: fixtureCompendium() },
  );
  assert.deepEqual(names(sheet.languages), ["Common", "Quoral"]);
  assert.deepEqual(names(sheet.tools), ["Lantern Kit"]);
});

test("background languages are fixed and picked, and join the race languages", () => {
  const compendium = inMemoryCompendium({
    races: [vellariRace()],
    backgrounds: [lamplighterBackground({ languages: ["Lamplighter's Cant"] })],
  });
  const sheet = proficiencySheet(
    makeChar({
      race: { name: "Vellari", source: "PHB" },
      background: { name: "Lamplighter", source: "PHB" },
      chosenLanguages: { background: ["Elvish"] },
    }),
    { compendium },
  );
  assert.deepEqual(names(sheet.languages), ["Common", "Quoral", "Lamplighter's Cant", "Elvish"]);
});

test("class starting tools and multiclass tool proficiencies both appear", () => {
  const sheet = proficiencySheet(
    makeChar({
      classes: [{ className: "Rogue", source: "PHB", level: 1 }],
      multiclassProficiencies: [{ className: "Druid", tools: ["Herbalism Kit"] }],
    }),
    { compendium: inMemoryCompendium() },
  );
  assert.deepEqual(names(sheet.tools), ["Thieves' Tools", "Herbalism Kit"]);
});

test("a character with no source shows Common and no tools", () => {
  const sheet = proficiencySheet(makeChar(), { compendium: inMemoryCompendium() });
  assert.deepEqual(names(sheet.languages), ["Common"]);
  assert.deepEqual(sheet.tools, []);
});

test("without the Integrated Catalog the SRD Baseline supplies race languages", () => {
  const sheet = proficiencySheet(
    makeChar({ race: { name: "Dwarf", source: "PHB", subraceName: "Hill", subraceSource: "PHB" } }),
    { compendium: srdBaselineCompendium() },
  );
  assert.ok(names(sheet.languages).includes("Common"));
  assert.ok(names(sheet.languages).includes("Dwarvish"));
});

// Feature grants: an invented class, subclass and feat, with grant ids in the scraper's shape.

const feature = (name: string, level: number, grants: ProficiencyGrant[] = [], isOptional = false) => ({
  name,
  level,
  description: `Placeholder description for ${name}.`,
  grants,
  ...(isOptional ? { isOptional: true } : {}),
});

const wardenFeatures = [
  feature("Lantern Training", 1, [fixedGrant("FIX/Warden/Lantern Training@1#0", "tools", ["lantern kit"])]),
  feature("Quoral Study", 1, [fixedGrant("FIX/Warden/Quoral Study@1#0", "languages", ["quoral"])]),
  feature("Lantern Lore", 1, [anyLanguageChoice("FIX/Warden/Lantern Lore@1#0", 1)]),
  feature("Shield Drill", 1, [
    fixedGrant("FIX/Warden/Shield Drill@1#0", "armor", ["light armor"]),
    fixedGrant("FIX/Warden/Shield Drill@1#1", "savingThrows", ["Wisdom"]),
  ]),
  feature("Lantern Oath", 1, [fixedGrant("FIX/Warden/Lantern Oath@1#0", "languages", ["oath cant"])], true),
  feature("Vigil Tongue", 3, [fixedGrant("FIX/Warden/Vigil Tongue@3#0", "languages", ["vigil cant"])]),
];

const ironwatch: SubclassData = {
  name: "Ironwatch",
  shortName: "Ironwatch",
  source: "PHB",
  className: "Warden",
  classSource: "PHB",
  description: "Placeholder description for the Ironwatch.",
  features: [
    feature("Ironwatch Signs", 3, [fixedGrant("FIX/Warden/Ironwatch/Ironwatch Signs@3#0", "languages", ["giant"])]),
    feature("Ironwatch Arms", 3, [
      fixedGrant("FIX/Warden/Ironwatch/Ironwatch Arms@3#0", "weapons", ["martial weapons"]),
      fixedGrant("FIX/Warden/Ironwatch/Ironwatch Arms@3#1", "armor", ["medium armor"]),
    ]),
  ],
};

const warden = wardenClass({ features: wardenFeatures, subclasses: [ironwatch] });

const wardenAt = (level: number, extra: Partial<Character> = {}) =>
  makeChar({ classes: [{ className: "Warden", source: "PHB", level }], ...extra });

const wardenCompendium = () =>
  inMemoryCompendium({ races: [vellariRace()], classes: [warden] });

test("a class feature's fixed tool grant applies at its level and a later language waits for its level", () => {
  const levelOne = proficiencySheet(wardenAt(1), { compendium: wardenCompendium() });
  assert.deepEqual(names(levelOne.tools), ["Lantern Kit"]);
  assert.ok(!names(levelOne.languages).includes("Vigil Cant"));

  const levelThree = proficiencySheet(wardenAt(3), { compendium: wardenCompendium() });
  assert.ok(names(levelThree.languages).includes("Vigil Cant"), "the level 3 language applies at 3");
});

test("a subclass feature grants only for the chosen subclass, from its level", () => {
  const compendium = wardenCompendium();
  const withIronwatch = (level: number) =>
    wardenAt(level, { classes: [{ className: "Warden", source: "PHB", level, subclassName: "Ironwatch", subclassSource: "PHB" }] });
  assert.ok(!names(proficiencySheet(withIronwatch(2), { compendium }).languages).includes("Giant"));
  assert.ok(names(proficiencySheet(withIronwatch(3), { compendium }).languages).includes("Giant"));
  assert.ok(!names(proficiencySheet(wardenAt(3), { compendium }).languages).includes("Giant"), "no subclass chosen");
});

test("a grant disappears when its class is no longer on the character", () => {
  const compendium = wardenCompendium();
  assert.ok(names(proficiencySheet(wardenAt(3), { compendium }).languages).includes("Vigil Cant"));
  const withoutWarden = makeChar({ classes: [] });
  assert.ok(!names(proficiencySheet(withoutWarden, { compendium }).languages).includes("Vigil Cant"));
});

test("an optional feature grants only while it is enabled", () => {
  const compendium = wardenCompendium();
  assert.ok(!names(proficiencySheet(wardenAt(1), { compendium }).languages).includes("Oath Cant"));
  const enabled = wardenAt(1, { optionalFeatureReplacements: { "Lantern Oath": true } });
  assert.ok(names(proficiencySheet(enabled, { compendium }).languages).includes("Oath Cant"));
});

test("a duplicate grant appears once, and choice, armor and saving throw grants add nothing to the sheet", () => {
  const sheet = proficiencySheet(
    makeChar({ race: { name: "Vellari", source: "PHB" }, classes: [{ className: "Warden", source: "PHB", level: 1 }] }),
    { compendium: wardenCompendium() },
  );
  assert.deepEqual(names(sheet.languages), ["Common", "Quoral"]);
  assert.deepEqual(names(sheet.tools), ["Lantern Kit"]);
});

test("a feat grants its proficiency when picked, from the ability score list or the origin-feat list", () => {
  const compendium = inMemoryCompendium({
    feats: [placeholderFeat({ name: "Signal Training", grants: [fixedGrant("FIX/Signal Training@0#0", "tools", ["Signal Mirror"])] })],
  });
  const picked = makeChar({ asiSelections: [{ level: 4, type: "feat", featName: "Signal Training", featSource: "PHB" }] });
  assert.deepEqual(names(proficiencySheet(picked, { compendium }).tools), ["Signal Mirror"]);

  const fromOrigin = makeChar({ originFeats: [{ level: 1, type: "feat", featName: "Signal Training", featSource: "PHB" }] });
  assert.deepEqual(names(proficiencySheet(fromOrigin, { compendium }).tools), ["Signal Mirror"]);

  assert.deepEqual(proficiencySheet(makeChar(), { compendium }).tools, [], "no pick, no tool");
});

test("the SRD Baseline's own grants apply without the Integrated Catalog", () => {
  const compendium = srdBaselineCompendium();
  const druid = proficiencySheet(makeChar({ classes: [{ className: "Druid", source: "SRD", level: 1 }] }), { compendium });
  assert.ok(names(druid.languages).includes("Druidic"));
  const sorcerer = proficiencySheet(
    makeChar({ classes: [{ className: "Sorcerer", source: "SRD", level: 1, subclassName: "Draconic Bloodline", subclassSource: "SRD" }] }),
    { compendium },
  );
  assert.ok(names(sorcerer.languages).includes("Draconic"));
});

// Weapons and armor (ticket 09). Names read as the card shows them.

const srdFighter = (level = 1, extra: Partial<Character> = {}) =>
  makeChar({ classes: [{ className: "Fighter", source: "SRD", level }], ...extra });

test("class base armor and weapons come from the class data, with the categories kept whole", () => {
  const sheet = proficiencySheet(srdFighter(), { compendium: srdBaselineCompendium() });
  assert.deepEqual(names(sheet.armor), ["Light armor", "Medium armor", "Heavy armor", "Shields"]);
  assert.deepEqual(names(sheet.weapons), ["Simple weapons", "Martial weapons"]);
});

test("a category supersedes the individual weapons it covers, race training included", () => {
  const sheet = proficiencySheet(
    srdFighter(1, { race: { name: "Elf", source: "SRD", subraceName: "High Elf", subraceSource: "SRD" } }),
    { compendium: srdBaselineCompendium() },
  );
  assert.deepEqual(names(sheet.weapons), ["Simple weapons", "Martial weapons"]);
});

test("without a category, race weapon training is listed by weapon", () => {
  const sheet = proficiencySheet(makeChar({ race: { name: "Elf", source: "SRD" } }), { compendium: srdBaselineCompendium() });
  assert.deepEqual(names(sheet.weapons), ["Longswords", "Shortswords", "Shortbows", "Longbows"]);
});

test("the SRD Life Domain's heavy armor applies from level 1 without the Integrated Catalog", () => {
  const cleric = (level: number) =>
    makeChar({ classes: [{ className: "Cleric", source: "SRD", level, subclassName: "Life Domain", subclassSource: "SRD" }] });
  assert.ok(names(proficiencySheet(cleric(1), { compendium: srdBaselineCompendium() }).armor).includes("Heavy armor"));
});

test("a class feature's armor grant applies at its level", () => {
  const sheet = proficiencySheet(wardenAt(1), { compendium: wardenCompendium() });
  assert.deepEqual(names(sheet.armor), ["Light armor"]);
});

test("a subclass feature's weapon and armor grants apply from the feature's level", () => {
  const compendium = wardenCompendium();
  const ironwatchAt = (level: number) =>
    wardenAt(level, { classes: [{ className: "Warden", source: "PHB", level, subclassName: "Ironwatch", subclassSource: "PHB" }] });
  assert.deepEqual(names(proficiencySheet(ironwatchAt(2), { compendium }).weapons), []);
  const atThree = proficiencySheet(ironwatchAt(3), { compendium });
  assert.deepEqual(names(atThree.weapons), ["Martial weapons"]);
  assert.ok(names(atThree.armor).includes("Medium armor"));
});

test("a feat's armor and weapon grants apply while the feat is held", () => {
  const compendium = inMemoryCompendium({
    feats: [
      placeholderFeat({
        name: "Plate Training",
        grants: [
          fixedGrant("FIX/Plate Training@0#0", "armor", ["heavy armor"]),
          fixedGrant("FIX/Plate Training@0#1", "weapons", ["improvised weapons"]),
        ],
      }),
    ],
  });
  const picked = makeChar({ asiSelections: [{ level: 4, type: "feat", featName: "Plate Training", featSource: "PHB" }] });
  const sheet = proficiencySheet(picked, { compendium });
  assert.deepEqual(names(sheet.armor), ["Heavy armor"]);
  assert.deepEqual(names(sheet.weapons), ["Improvised weapons"]);
  assert.deepEqual(proficiencySheet(makeChar(), { compendium }).armor, [], "no feat, no armor");
});

test("an armor grant that a class already gives is kept once", () => {
  const compendium = inMemoryCompendium({
    classes: [wardenClass({ armorProficiencies: ["light"] })],
    feats: [placeholderFeat({ name: "Light Training", grants: [fixedGrant("FIX/Light Training@0#0", "armor", ["light armor"])] })],
  });
  const sheet = proficiencySheet(
    makeChar({
      classes: [{ className: "Warden", source: "PHB", level: 1 }],
      asiSelections: [{ level: 4, type: "feat", featName: "Light Training", featSource: "PHB" }],
    }),
    { compendium },
  );
  assert.deepEqual(names(sheet.armor), ["Light armor"]);
});

test("multiclass weapon proficiencies recorded on the character appear with the class's own", () => {
  const sheet = proficiencySheet(
    makeChar({
      classes: [{ className: "Fighter", source: "SRD", level: 1 }],
      multiclassProficiencies: [{ className: "Druid", weapons: ["Improvised weapons"] }],
    }),
    { compendium: srdBaselineCompendium() },
  );
  assert.deepEqual(names(sheet.weapons), ["Simple weapons", "Martial weapons", "Improvised weapons"]);
});

test("singular and plural spellings of one weapon appear once, in the category list's plural", () => {
  const compendium = inMemoryCompendium({
    feats: [
      placeholderFeat({ name: "Blade Dance", grants: [fixedGrant("FIX/Blade Dance@0#0", "weapons", ["scimitar"])] }),
      placeholderFeat({ name: "Blade Lore", grants: [fixedGrant("FIX/Blade Lore@0#0", "weapons", ["scimitars"])] }),
    ],
  });
  const sheet = proficiencySheet(
    makeChar({
      asiSelections: [
        { level: 4, type: "feat", featName: "Blade Dance", featSource: "PHB" },
        { level: 8, type: "feat", featName: "Blade Lore", featSource: "PHB" },
      ],
    }),
    { compendium },
  );
  assert.deepEqual(names(sheet.weapons), ["Scimitars"]);
});

test("the Heavily Armored prerequisite reads the armor the sheet grants", () => {
  const prereq = { name: "Heavily Armored", prerequisite: "Proficiency with heavy armor" };
  const lifeCleric = makeChar({
    classes: [{ className: "Cleric", source: "SRD", level: 1, subclassName: "Life Domain", subclassSource: "SRD" }],
  });
  const catalogs = { compendium: srdBaselineCompendium() };
  assert.equal(validateFeatPrerequisites(lifeCleric, prereq, { catalogs }).met, true);
  const wizard = makeChar({ classes: [{ className: "Wizard", source: "SRD", level: 1 }] });
  assert.equal(validateFeatPrerequisites(wizard, prereq, { catalogs }).met, false);
});
