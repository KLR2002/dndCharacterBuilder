import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, loadTestCatalog } from "./testUtils.ts";
import { findSpell } from "../src/services/dataService.ts";
import {
  getClassSpellProfiles,
  calculateWarlockPactSlots,
  isSpellAvailableForClass,
  getAvailableSpellsForClass,
  type ClassSpellProfile,
} from "../src/rules/spellcasting.ts";
import type { CharacterClass } from "../src/types/character.ts";
import type { SpellData } from "../src/types/dnd5e.ts";

const cl = (className: string, level: number, subclassName?: string, source = "PHB"): CharacterClass => ({
  className,
  source,
  level,
  subclassName,
});

test("getClassSpellProfiles detects casting classes and ignores non-casters", () => {
  // Barbarian, Monk, Champion Fighter, Thief Rogue should NOT be detected
  const martialChar = makeChar({
    classes: [
      cl("Barbarian", 5),
      cl("Monk", 3),
      cl("Fighter", 4, "Champion"),
      cl("Rogue", 3, "Thief"),
    ],
  });
  assert.deepEqual(getClassSpellProfiles(martialChar), []);

  // Eldritch Knight and Arcane Trickster under level 3 should NOT be detected
  const lowLevelThirdCasters = makeChar({
    classes: [
      cl("Fighter", 2, "Eldritch Knight"),
      cl("Rogue", 2, "Arcane Trickster"),
    ],
  });
  assert.deepEqual(getClassSpellProfiles(lowLevelThirdCasters), []);

  // Fighter without subclass at level 3 should NOT be detected
  const noSubFighter = makeChar({
    classes: [cl("Fighter", 3)],
  });
  assert.deepEqual(getClassSpellProfiles(noSubFighter), []);

  // 2014 rules: Paladin and Ranger do NOT gain spellcasting at level 1
  const lvl1HalfCasters = makeChar({
    classes: [cl("Paladin", 1), cl("Ranger", 1)],
  });
  assert.deepEqual(getClassSpellProfiles(lvl1HalfCasters), []);

  // All 8 standard casting classes + 2 third casters (level >= 3)
  const fullCasters = makeChar({
    classes: [
      cl("Bard", 2),
      cl("Cleric", 2),
      cl("Druid", 2),
      cl("Paladin", 2),
      cl("Ranger", 2),
      cl("Sorcerer", 2),
      cl("Warlock", 2),
      cl("Wizard", 2),
      cl("Fighter", 3, "Eldritch Knight"),
      cl("Rogue", 3, "Arcane Trickster"),
    ],
  });
  const profiles = getClassSpellProfiles(fullCasters);
  assert.equal(profiles.length, 10);
  assert.equal(profiles[0].className, "Bard");
  assert.equal(profiles[1].className, "Cleric");
  assert.equal(profiles[2].className, "Druid");
  assert.equal(profiles[3].className, "Paladin");
  assert.equal(profiles[4].className, "Ranger");
  assert.equal(profiles[5].className, "Sorcerer");
  assert.equal(profiles[6].className, "Warlock");
  assert.equal(profiles[7].className, "Wizard");
  assert.equal(profiles[8].className, "Fighter");
  assert.equal(profiles[9].className, "Rogue");
});

test("getClassSpellProfiles assigns correct spellcasting ability to each class", () => {
  const casters = makeChar({
    classes: [
      cl("Wizard", 3),
      cl("Fighter", 3, "Eldritch Knight"),
      cl("Rogue", 3, "Arcane Trickster"),
      cl("Cleric", 3),
      cl("Druid", 3),
      cl("Ranger", 3),
      cl("Bard", 3),
      cl("Paladin", 3),
      cl("Sorcerer", 3),
      cl("Warlock", 3),
    ],
  });
  const profiles = getClassSpellProfiles(casters);
  const abilityByClass = Object.fromEntries(profiles.map(p => [
    p.className === "Fighter" ? "EK" : p.className === "Rogue" ? "AT" : p.className,
    p.ability,
  ]));

  // Wizard, EK, AT: INT
  assert.equal(abilityByClass.Wizard, "int");
  assert.equal(abilityByClass.EK, "int");
  assert.equal(abilityByClass.AT, "int");

  // Cleric, Druid, Ranger: WIS
  assert.equal(abilityByClass.Cleric, "wis");
  assert.equal(abilityByClass.Druid, "wis");
  assert.equal(abilityByClass.Ranger, "wis");

  // Bard, Paladin, Sorcerer, Warlock: CHA
  assert.equal(abilityByClass.Bard, "cha");
  assert.equal(abilityByClass.Paladin, "cha");
  assert.equal(abilityByClass.Sorcerer, "cha");
  assert.equal(abilityByClass.Warlock, "cha");
});

test("Wizard 3 / Ranger 4 generates two separate spell profiles with correct DCs and bonuses", () => {
  // Total level = 7 -> proficiency bonus = Math.floor((7 - 1) / 4) + 2 = 3
  // Base stats: INT 16 (+3), WIS 14 (+2)
  const char = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 14, cha: 10 },
    classes: [
      cl("Wizard", 3),
      cl("Ranger", 4),
    ],
  });

  const profiles = getClassSpellProfiles(char);
  assert.equal(profiles.length, 2);

  // Wizard profile:
  // INT mod = +3, PB = 3 -> spellSaveDc = 8 + 3 + 3 = 14, attack bonus = 3 + 3 = 6
  // Wizard 3 has 2nd level spell slots -> maxSpellLevel = 2
  // Wizard prepared limit = Math.max(1, classLevel + intMod) = 3 + 3 = 6
  const wizardProfile = profiles.find(p => p.className === "Wizard")!;
  assert.ok(wizardProfile);
  assert.equal(wizardProfile.ability, "int");
  assert.equal(wizardProfile.level, 3);
  assert.equal(wizardProfile.spellSaveDc, 14);
  assert.equal(wizardProfile.spellAttackBonus, 6);
  assert.equal(wizardProfile.maxSpellLevel, 2);
  assert.equal(wizardProfile.preparedLimit, 6);

  // Ranger profile:
  // WIS mod = +2, PB = 3 -> spellSaveDc = 8 + 3 + 2 = 13, attack bonus = 3 + 2 = 5
  // Ranger 4 has 1st level spell slots -> maxSpellLevel = 1
  // Ranger is a known caster -> preparedLimit is undefined
  const rangerProfile = profiles.find(p => p.className === "Ranger")!;
  assert.ok(rangerProfile);
  assert.equal(rangerProfile.ability, "wis");
  assert.equal(rangerProfile.level, 4);
  assert.equal(rangerProfile.spellSaveDc, 13);
  assert.equal(rangerProfile.spellAttackBonus, 5);
  assert.equal(rangerProfile.maxSpellLevel, 1);
  assert.equal(rangerProfile.preparedLimit, undefined);
});

test("maxSpellLevel is computed based on individual class progression", () => {
  // Wizard 3 -> 2
  const wiz3 = makeChar({ classes: [cl("Wizard", 3)] });
  assert.equal(getClassSpellProfiles(wiz3)[0].maxSpellLevel, 2);

  // Ranger 4 -> 1
  const rgr4 = makeChar({ classes: [cl("Ranger", 4)] });
  assert.equal(getClassSpellProfiles(rgr4)[0].maxSpellLevel, 1);

  // Paladin 5 -> 2
  const pal5 = makeChar({ classes: [cl("Paladin", 5)] });
  assert.equal(getClassSpellProfiles(pal5)[0].maxSpellLevel, 2);

  // Paladin 1 -> no spell profile under 2014 rules
  const pal1 = makeChar({ classes: [cl("Paladin", 1)] });
  assert.equal(getClassSpellProfiles(pal1).length, 0);

  // Paladin 2 -> 1
  const pal2 = makeChar({ classes: [cl("Paladin", 2)] });
  assert.equal(getClassSpellProfiles(pal2)[0].maxSpellLevel, 1);

  // Warlock 5 -> 3
  const war5 = makeChar({ classes: [cl("Warlock", 5)] });
  assert.equal(getClassSpellProfiles(war5)[0].maxSpellLevel, 3);

  // Eldritch Knight Fighter 7 -> 2
  const ek7 = makeChar({ classes: [cl("Fighter", 7, "Eldritch Knight")] });
  assert.equal(getClassSpellProfiles(ek7)[0].maxSpellLevel, 2);

  // Arcane Trickster Rogue 13 -> 3
  const at13 = makeChar({ classes: [cl("Rogue", 13, "Arcane Trickster")] });
  assert.equal(getClassSpellProfiles(at13)[0].maxSpellLevel, 3);
});

test("preparedLimit formula is accurate for Cleric, Druid, Wizard, Paladin and respects minimum of 1", () => {
  // Cleric 5 with WIS 16 (+3) -> 5 + 3 = 8
  const cleric = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
    classes: [cl("Cleric", 5)],
  });
  assert.equal(getClassSpellProfiles(cleric)[0].preparedLimit, 8);

  // Druid 3 with WIS 14 (+2) -> 3 + 2 = 5
  const druid = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
    classes: [cl("Druid", 3)],
  });
  assert.equal(getClassSpellProfiles(druid)[0].preparedLimit, 5);

  // Wizard 1 with INT 8 (-1) -> Math.max(1, 1 + (-1)) = 1 (minimum 1)
  const lowIntWizard = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 8, wis: 10, cha: 10 },
    classes: [cl("Wizard", 1)],
  });
  assert.equal(getClassSpellProfiles(lowIntWizard)[0].preparedLimit, 1);

  // Paladin 5 with CHA 16 (+3) -> Math.max(1, Math.floor(5 / 2) + 3) = 2 + 3 = 5
  const paladin = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    classes: [cl("Paladin", 5)],
  });
  assert.equal(getClassSpellProfiles(paladin)[0].preparedLimit, 5);

  // Paladin 2 with CHA 8 (-1) -> Math.max(1, Math.floor(2 / 2) + (-1)) = Math.max(1, 0) = 1
  const lowChaPaladin2 = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 8 },
    classes: [cl("Paladin", 2)],
  });
  assert.equal(getClassSpellProfiles(lowChaPaladin2)[0].preparedLimit, 1);

  // Known casters (Bard, Sorcerer, Warlock) do not have preparedLimit
  const knownCasters = makeChar({
    classes: [cl("Bard", 3), cl("Sorcerer", 3), cl("Warlock", 3)],
  });
  const knownProfiles = getClassSpellProfiles(knownCasters);
  for (const p of knownProfiles) {
    assert.equal(p.preparedLimit, undefined);
  }
});

test("getClassSpellProfiles uses effective ability scores (with racial bonuses and ASIs)", () => {
  // Wizard 4 with base INT 14, +1 racial, and +2 ASI -> INT 17 (+3)
  // Total level 4 -> PB = 2
  // DC = 8 + 2 + 3 = 13, Attack = 2 + 3 = 5
  const char = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
    racialAbilityBonuses: { int: 1 },
    asiSelections: [
      { className: "Wizard", classLevel: 4, level: 4, type: "asi", asi: { int: 2 } },
    ],
    classes: [cl("Wizard", 4)],
  });
  const profiles = getClassSpellProfiles(char);
  assert.equal(profiles[0].spellSaveDc, 13);
  assert.equal(profiles[0].spellAttackBonus, 5);
  assert.equal(profiles[0].preparedLimit, 7); // 4 + 3
});

test("getClassSpellProfiles filters knownSpells and preparedSpells by ownerKey in multiclass", () => {
  const multiChar = makeChar({
    classes: [cl("Wizard", 3), cl("Cleric", 3)],
    knownSpells: [
      { name: "Shield", source: "PHB", ownerKey: "Wizard__PHB" },
      { name: "Fireball", source: "PHB", ownerKey: "Wizard__PHB" },
      { name: "Bless", source: "PHB", ownerKey: "Cleric__PHB" },
      { name: "Cure Wounds", source: "PHB", ownerKey: "Cleric__PHB" },
    ],
    preparedSpells: [
      "Shield__PHB__Wizard__PHB",
      "Bless__PHB__Cleric__PHB",
    ],
  });

  const profiles = getClassSpellProfiles(multiChar);
  const wizard = profiles.find(p => p.className === "Wizard")!;
  const cleric = profiles.find(p => p.className === "Cleric")!;

  assert.deepEqual(wizard.knownSpells.map(s => s.name), ["Shield", "Fireball"]);
  assert.deepEqual(wizard.preparedSpells, ["Shield__PHB__Wizard__PHB"]);

  assert.deepEqual(cleric.knownSpells.map(s => s.name), ["Bless", "Cure Wounds"]);
  assert.deepEqual(cleric.preparedSpells, ["Bless__PHB__Cleric__PHB"]);
});

test("getClassSpellProfiles uses single-class fallback for knownSpells and preparedSpells", () => {
  // When character has only 1 casting class, spells without ownerKey or with unknown ownerKey
  // fall back to that single casting class
  const singleChar = makeChar({
    classes: [cl("Wizard", 5)],
    knownSpells: [
      { name: "Mage Armor", source: "PHB", ownerKey: "unknown__unknown" },
      { name: "Magic Missile", source: "PHB", ownerKey: "" },
    ],
    preparedSpells: [
      "Mage Armor__PHB",
      "Magic Missile__PHB__unknown__unknown",
    ],
  });

  const profiles = getClassSpellProfiles(singleChar);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].knownSpells.length, 2);
  assert.deepEqual(profiles[0].knownSpells.map(s => s.name), ["Mage Armor", "Magic Missile"]);
  assert.equal(profiles[0].preparedSpells.length, 2);
});

test("calculateWarlockPactSlots returns correct slots and level or null", () => {
  // No Warlock levels -> null
  const noWarlock = makeChar({ classes: [cl("Wizard", 5)] });
  assert.equal(calculateWarlockPactSlots(noWarlock), null);

  const emptyChar = makeChar({ classes: [] });
  assert.equal(calculateWarlockPactSlots(emptyChar), null);

  // Warlock 1: 1 slot of 1st level
  assert.deepEqual(calculateWarlockPactSlots(makeChar({ classes: [cl("Warlock", 1)] })), {
    count: 1,
    level: 1,
  });

  // Warlock 2: 2 slots of 1st level
  assert.deepEqual(calculateWarlockPactSlots(makeChar({ classes: [cl("Warlock", 2)] })), {
    count: 2,
    level: 1,
  });

  // Warlock 3: 2 slots of 2nd level
  assert.deepEqual(calculateWarlockPactSlots(makeChar({ classes: [cl("Warlock", 3)] })), {
    count: 2,
    level: 2,
  });

  // Warlock 5: 2 slots of 3rd level
  assert.deepEqual(calculateWarlockPactSlots(makeChar({ classes: [cl("Warlock", 5)] })), {
    count: 2,
    level: 3,
  });

  // Warlock 7: 2 slots of 4th level
  assert.deepEqual(calculateWarlockPactSlots(makeChar({ classes: [cl("Warlock", 7)] })), {
    count: 2,
    level: 4,
  });

  // Warlock 9: 2 slots of 5th level
  assert.deepEqual(calculateWarlockPactSlots(makeChar({ classes: [cl("Warlock", 9)] })), {
    count: 2,
    level: 5,
  });

  // Warlock 11: 3 slots of 5th level
  assert.deepEqual(calculateWarlockPactSlots(makeChar({ classes: [cl("Warlock", 11)] })), {
    count: 3,
    level: 5,
  });

  // Warlock 17: 4 slots of 5th level
  assert.deepEqual(calculateWarlockPactSlots(makeChar({ classes: [cl("Warlock", 17)] })), {
    count: 4,
    level: 5,
  });

  // Multiclass Warlock 3 / Paladin 2 -> returns Warlock pact slots
  const multi = makeChar({ classes: [cl("Warlock", 3), cl("Paladin", 2)] });
  assert.deepEqual(calculateWarlockPactSlots(multi), {
    count: 2,
    level: 2,
  });
});

test("Metamagic option limits scale with Sorcerer level (2 at lvl 3, 3 at lvl 10, 4 at lvl 17)", () => {
  const getMetamagicLimit = (level: number) => {
    if (level < 3) return 0;
    if (level >= 17) return 4;
    if (level >= 10) return 3;
    return 2;
  };

  assert.equal(getMetamagicLimit(1), 0);
  assert.equal(getMetamagicLimit(2), 0);
  assert.equal(getMetamagicLimit(3), 2);
  assert.equal(getMetamagicLimit(9), 2);
  assert.equal(getMetamagicLimit(10), 3);
  assert.equal(getMetamagicLimit(16), 3);
  assert.equal(getMetamagicLimit(17), 4);
  assert.equal(getMetamagicLimit(20), 4);
});

test("Character metamagicOptions and chosenMetamagic field compatibility", () => {
  const char = makeChar({
    classes: [cl("Sorcerer", 5)],
    metamagicOptions: ["Quickened Spell", "Twinned Spell"],
    chosenMetamagic: ["Quickened Spell", "Twinned Spell"],
  });

  assert.equal(char.metamagicOptions?.length, 2);
  assert.deepEqual(char.metamagicOptions, ["Quickened Spell", "Twinned Spell"]);
  assert.deepEqual(char.chosenMetamagic, ["Quickened Spell", "Twinned Spell"]);
});

// Spell mock data matching 5e rules & scraped format
const controlFlamesMock: SpellData = {
  name: "Control Flames",
  source: "XGE",
  level: 0,
  school: "Transmutation",
  castingTime: "1 action",
  range: "60 feet",
  components: { verbal: false, somatic: true, material: false },
  componentsString: "S",
  duration: "Instantaneous",
  concentration: false,
  ritual: false,
  classes: ["Druid", "Sorcerer", "Wizard"],
  subclasses: [],
  damageTypes: [],
  savingThrows: [],
  description: "You choose nonmagical flame...",
  higherLevels: null,
};

const aidMock: SpellData = {
  name: "Aid",
  source: "PHB",
  level: 2,
  school: "Abjuration",
  castingTime: "1 action",
  range: "30 feet",
  components: { verbal: true, somatic: true, material: "a tiny strip of white cloth" },
  componentsString: "V, S, M",
  duration: "8 hours",
  concentration: false,
  ritual: false,
  classes: ["Cleric", "Paladin"],
  classVariants: [
    { name: "Artificer", source: "PHB", definedInSource: "TCE" },
    { name: "Bard", source: "PHB", definedInSource: "TCE" },
    { name: "Ranger", source: "PHB", definedInSource: "TCE" },
  ],
  subclasses: [],
  damageTypes: [],
  savingThrows: [],
  description: "Your spell bolsters your allies...",
  higherLevels: null,
};

const draconicTransformationMock: SpellData = {
  name: "Draconic Transformation",
  source: "FTD",
  level: 7,
  school: "Transmutation",
  castingTime: "1 bonus",
  range: "Self",
  components: { verbal: true, somatic: true, material: "a statuette" },
  componentsString: "V, S, M",
  duration: "Concentration, up to 1 minute",
  concentration: true,
  ritual: false,
  classes: ["Druid", "Sorcerer", "Wizard"],
  subclasses: [],
  damageTypes: ["force"],
  savingThrows: ["dexterity"],
  description: "With a roar, you draw on the magic...",
  higherLevels: null,
};

const silveryBarbsMock: SpellData = {
  name: "Silvery Barbs",
  source: "SCC",
  level: 1,
  school: "Enchantment",
  castingTime: "1 reaction",
  range: "60 feet",
  components: { verbal: true, somatic: false, material: false },
  componentsString: "V",
  duration: "Instantaneous",
  concentration: false,
  ritual: false,
  classes: ["Bard", "Sorcerer", "Wizard"],
  subclasses: [],
  damageTypes: [],
  savingThrows: [],
  description: "You magically distract...",
  higherLevels: null,
};

test("isSpellAvailableForClass: native supplement spells (XGE) are gated by activeBooks", () => {
  // Available when XGE is active
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Druid", ["PHB", "XGE"]), true);
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Sorcerer", ["PHB", "XGE"]), true);
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Wizard", ["PHB", "XGE"]), true);

  // Unavailable when XGE is not active
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Druid", ["PHB"]), false);
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Wizard", ["PHB"]), false);

  // Class not in spell list is never available, even if book is active
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Cleric", ["PHB", "XGE"]), false);
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Bard", ["PHB", "XGE"]), false);
});

test("isSpellAvailableForClass: alternative class spell lists (TCE) are gated strictly by granting book", () => {
  // Native classes (Cleric, Paladin) have Aid when PHB is active
  assert.equal(isSpellAvailableForClass(aidMock, "Cleric", ["PHB"]), true);
  assert.equal(isSpellAvailableForClass(aidMock, "Paladin", ["PHB"]), true);

  // Expanded classes (Bard, Ranger) do NOT have Aid when only PHB is active
  assert.equal(isSpellAvailableForClass(aidMock, "Bard", ["PHB"]), false);
  assert.equal(isSpellAvailableForClass(aidMock, "Ranger", ["PHB"]), false);
  assert.equal(isSpellAvailableForClass(aidMock, "Artificer", ["PHB"]), false);

  // Alternative spell list classes DO have Aid when TCE is also active
  assert.equal(isSpellAvailableForClass(aidMock, "Bard", ["PHB", "TCE"]), true);
  assert.equal(isSpellAvailableForClass(aidMock, "Ranger", ["PHB", "TCE"]), true);
  assert.equal(isSpellAvailableForClass(aidMock, "Artificer", ["PHB", "TCE"]), true);

  // If spell's own sourcebook is inactive, spell is unavailable regardless of variant
  assert.equal(isSpellAvailableForClass(aidMock, "Bard", ["TCE"]), false);
  assert.equal(isSpellAvailableForClass(aidMock, "Cleric", ["TCE"]), false);
  assert.equal(isSpellAvailableForClass(aidMock, "Artificer", ["TCE"]), false);
});

test("isSpellAvailableForClass: maps third-caster archetypes to Wizard spell list", () => {
  // Eldritch Knight and Arcane Trickster use Wizard spell list
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Eldritch Knight", ["PHB", "XGE"]), true);
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Arcane Trickster", ["PHB", "XGE"]), true);

  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Eldritch Knight", ["PHB"]), false);
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Arcane Trickster", ["PHB"]), false);

  // Aid is not on Wizard list, so third-casters cannot access it
  assert.equal(isSpellAvailableForClass(aidMock, "Eldritch Knight", ["PHB", "TCE"]), false);
  assert.equal(isSpellAvailableForClass(aidMock, "Arcane Trickster", ["PHB", "TCE"]), false);
});

test("isSpellAvailableForClass: flexible across diverse books (FTD, SCC) using definedInSource without hardcoding", () => {
  // Silvery Barbs from Strixhaven (SCC)
  assert.equal(isSpellAvailableForClass(silveryBarbsMock, "Bard", ["PHB", "SCC"]), true);
  assert.equal(isSpellAvailableForClass(silveryBarbsMock, "Wizard", ["PHB", "SCC"]), true);
  assert.equal(isSpellAvailableForClass(silveryBarbsMock, "Cleric", ["PHB", "SCC"]), false);
  assert.equal(isSpellAvailableForClass(silveryBarbsMock, "Bard", ["PHB"]), false);

  // Draconic Transformation from Fizban (FTD)
  assert.equal(isSpellAvailableForClass(draconicTransformationMock, "Druid", ["PHB", "FTD"]), true);
  assert.equal(isSpellAvailableForClass(draconicTransformationMock, "Sorcerer", ["PHB", "FTD"]), true);
  assert.equal(isSpellAvailableForClass(draconicTransformationMock, "Druid", ["PHB"]), false);
});

test("isSpellAvailableForClass: defaults to all books when activeBooks is undefined, handles case-insensitivity", () => {
  // Undefined activeBooks allows any book & variant
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "druid"), true);
  assert.equal(isSpellAvailableForClass(aidMock, "BARD"), true);
  assert.equal(isSpellAvailableForClass(silveryBarbsMock, "wizard"), true);

  // Case-insensitive activeBooks matching
  assert.equal(isSpellAvailableForClass(controlFlamesMock, "Druid", ["phb", "xge"]), true);
  assert.equal(isSpellAvailableForClass(aidMock, "Bard", ["phb", "tce"]), true);
});

test("getAvailableSpellsForClass filters spell collections by class and activeBooks", () => {
  const catalog = [controlFlamesMock, aidMock, draconicTransformationMock, silveryBarbsMock];

  // Wizard with PHB + XGE: only Control Flames
  const wizPhbXge = getAvailableSpellsForClass(catalog, "Wizard", ["PHB", "XGE"]);
  assert.deepEqual(wizPhbXge.map((s) => s.name), ["Control Flames"]);

  // Wizard with PHB + XGE + FTD + SCC: Control Flames, Draconic Transformation, Silvery Barbs
  const wizAll = getAvailableSpellsForClass(catalog, "Wizard", ["PHB", "XGE", "FTD", "SCC"]);
  assert.deepEqual(wizAll.map((s) => s.name), ["Control Flames", "Draconic Transformation", "Silvery Barbs"]);

  // Bard with PHB only: none of these 4
  const bardPhb = getAvailableSpellsForClass(catalog, "Bard", ["PHB"]);
  assert.deepEqual(bardPhb.map((s) => s.name), []);

  // Bard with PHB + TCE: Aid
  const bardTce = getAvailableSpellsForClass(catalog, "Bard", ["PHB", "TCE"]);
  assert.deepEqual(bardTce.map((s) => s.name), ["Aid"]);

  // Bard with PHB + TCE + SCC: Aid, Silvery Barbs
  const bardTceScc = getAvailableSpellsForClass(catalog, "Bard", ["PHB", "TCE", "SCC"]);
  assert.deepEqual(bardTceScc.map((s) => s.name), ["Aid", "Silvery Barbs"]);
});

test("dataset integration: real spells from dataService reflect active book toggles", () => {
  const allSpells = loadTestCatalog<SpellData[]>("spells");

  // 1. With PHB only:
  const phbSpells = allSpells.filter((s) => s.source === "PHB");
  const phbBardSpells = getAvailableSpellsForClass(phbSpells, "Bard", ["PHB"]);
  const phbArtificerSpells = getAvailableSpellsForClass(phbSpells, "Artificer", ["PHB"]);
  const phbWizardSpells = getAvailableSpellsForClass(phbSpells, "Wizard", ["PHB"]);
  const phbClericSpells = getAvailableSpellsForClass(phbSpells, "Cleric", ["PHB"]);

  // Aid is in PHB: available to Cleric, but NOT to Bard or Artificer (Artificer granted via TCE)
  assert.equal(phbClericSpells.some((s) => s.name === "Aid"), true);
  assert.equal(phbBardSpells.some((s) => s.name === "Aid"), false);
  assert.equal(phbArtificerSpells.some((s) => s.name === "Aid"), false);

  // Control Flames is in XGE: NOT available under PHB
  assert.equal(phbWizardSpells.some((s) => s.name === "Control Flames"), false);

  // 2. With PHB + TCE:
  const phbTceSpells = allSpells.filter((s) => s.source === "PHB" || s.source === "TCE");
  const phbTceBardSpells = getAvailableSpellsForClass(phbTceSpells, "Bard", ["PHB", "TCE"]);
  const phbTceArtificerSpells = getAvailableSpellsForClass(phbTceSpells, "Artificer", ["PHB", "TCE"]);

  // Aid is granted to Bard and Artificer via TCE
  assert.equal(phbTceBardSpells.some((s) => s.name === "Aid"), true);
  assert.equal(phbTceArtificerSpells.some((s) => s.name === "Aid"), true);

  // 3. With PHB + XGE:
  const phbXgeSpells = allSpells.filter((s) => s.source === "PHB" || s.source === "XGE");
  const phbXgeWizardSpells = getAvailableSpellsForClass(phbXgeSpells, "Wizard", ["PHB", "XGE"]);

  // Control Flames and Toll the Dead are in XGE: available to Wizard
  assert.equal(phbXgeWizardSpells.some((s) => s.name === "Control Flames"), true);
  assert.equal(phbXgeWizardSpells.some((s) => s.name === "Toll the Dead"), true);
});

test("getClassSpellProfiles populates alwaysPreparedSpells and leaves preparedLimit separate", () => {
  // Level 1 Cleric with Life Domain (+3 WIS modifier)
  const lifeCleric = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
    classes: [cl("Cleric", 1, "Life Domain")],
    preparedSpells: ["Command__PHB__Cleric__PHB"],
  });

  const profiles = getClassSpellProfiles(lifeCleric);
  assert.equal(profiles.length, 1);
  const profile = profiles[0];

  // Base preparedLimit = Wis mod (+3) + cleric level (1) = 4
  assert.equal(profile.preparedLimit, 4);

  // alwaysPreparedSpells contains Bless and Cure Wounds
  assert.ok(profile.alwaysPreparedSpells);
  const alwaysPrepNames = profile.alwaysPreparedSpells.map((s) => s.name).sort();
  assert.deepEqual(alwaysPrepNames, ["Bless", "Cure Wounds"]);

  // The player's manually prepared list remains strictly separate
  assert.deepEqual(profile.preparedSpells, ["Command__PHB__Cleric__PHB"]);
});

test("isSpellAvailableForClass: Warlock Otherworldly Patron expanded spell lists", () => {
  const fireball = findSpell("Fireball")!;
  const burningHands = findSpell("Burning Hands")!;
  const command = findSpell("Command")!;

  assert.ok(fireball, "Fireball must exist in catalog");
  assert.ok(burningHands, "Burning Hands must exist in catalog");
  assert.ok(command, "Command must exist in catalog");

  // Fiend Warlock has access to Fireball, Burning Hands, Command under activeBooks
  assert.equal(isSpellAvailableForClass(fireball, "Warlock", ["PHB"], "The Fiend"), true);
  assert.equal(isSpellAvailableForClass(burningHands, "Warlock", ["PHB"], "The Fiend"), true);
  assert.equal(isSpellAvailableForClass(command, "Warlock", ["PHB"], "The Fiend"), true);

  // Non-Fiend Warlock (or Archfey) does NOT have access to Fireball
  assert.equal(isSpellAvailableForClass(fireball, "Warlock", ["PHB"], "The Archfey"), false);
  assert.equal(isSpellAvailableForClass(fireball, "Warlock", ["PHB"]), false);
  assert.equal(isSpellAvailableForClass(fireball, "Warlock", ["PHB"], "The Great Old One"), false);

  // Level gating via SpellAvailabilityContext
  assert.equal(
    isSpellAvailableForClass(fireball, "Warlock", ["PHB"], { subclassName: "The Fiend", classLevel: 3 }),
    false
  );
  assert.equal(
    isSpellAvailableForClass(fireball, "Warlock", ["PHB"], { subclassName: "The Fiend", classLevel: 5 }),
    true
  );
  assert.equal(
    isSpellAvailableForClass(burningHands, "Warlock", ["PHB"], { subclassName: "The Fiend", classLevel: 1 }),
    true
  );
});

test("isSpellAvailableForClass: Genie Warlock kind-specific and shared spells", () => {
  const detectEvilAndGood = findSpell("Detect Evil and Good")!;
  const sanctuary = findSpell("Sanctuary")!;
  const fireball = findSpell("Fireball")!;

  assert.ok(detectEvilAndGood);
  assert.ok(sanctuary);
  assert.ok(fireball);

  // Dao Genie Warlock: Detect Evil and Good (shared) and Sanctuary (Dao) are available
  assert.equal(
    isSpellAvailableForClass(detectEvilAndGood, "Warlock", ["PHB", "TCE"], {
      subclassName: "The Genie",
      kind: "Dao",
      classLevel: 1,
    }),
    true
  );
  assert.equal(
    isSpellAvailableForClass(sanctuary, "Warlock", ["PHB", "TCE"], {
      subclassName: "The Genie",
      kind: "Dao",
      classLevel: 1,
    }),
    true
  );
  // Dao does NOT get Fireball
  assert.equal(
    isSpellAvailableForClass(fireball, "Warlock", ["PHB", "TCE"], {
      subclassName: "The Genie",
      kind: "Dao",
      classLevel: 9,
    }),
    false
  );

  // Efreeti Genie Warlock: Fireball IS available at level 5+
  assert.equal(
    isSpellAvailableForClass(fireball, "Warlock", ["PHB", "TCE"], {
      subclassName: "The Genie",
      kind: "Efreeti",
      classLevel: 5,
    }),
    true
  );
  // Efreeti does NOT get Sanctuary
  assert.equal(
    isSpellAvailableForClass(sanctuary, "Warlock", ["PHB", "TCE"], {
      subclassName: "The Genie",
      kind: "Efreeti",
      classLevel: 5,
    }),
    false
  );
});

test("isSpellAvailableForClass: Divine Soul Sorcerer Cleric spell access", () => {
  const cureWounds = findSpell("Cure Wounds")!;
  const spiritualWeapon = findSpell("Spiritual Weapon")!;
  const revivify = findSpell("Revivify")!;
  const fireball = findSpell("Fireball")!;

  assert.ok(cureWounds, "Cure Wounds must exist in catalog");
  assert.ok(spiritualWeapon, "Spiritual Weapon must exist in catalog");
  assert.ok(revivify, "Revivify must exist in catalog");

  // Divine Soul Sorcerer has access to Cleric spells
  assert.equal(isSpellAvailableForClass(cureWounds, "Sorcerer", ["PHB"], "Divine Soul"), true);
  assert.equal(isSpellAvailableForClass(spiritualWeapon, "Sorcerer", ["PHB"], "Divine Soul"), true);
  assert.equal(isSpellAvailableForClass(revivify, "Sorcerer", ["PHB"], "Divine Soul"), true);

  // Non-Divine Soul Sorcerer does NOT have access to Cure Wounds or Spiritual Weapon
  assert.equal(isSpellAvailableForClass(cureWounds, "Sorcerer", ["PHB"], "Draconic Bloodline"), false);
  assert.equal(isSpellAvailableForClass(cureWounds, "Sorcerer", ["PHB"], "Wild Magic"), false);
  assert.equal(isSpellAvailableForClass(cureWounds, "Sorcerer", ["PHB"]), false);
  assert.equal(isSpellAvailableForClass(spiritualWeapon, "Sorcerer", ["PHB"], "Draconic Bloodline"), false);

  // Native Sorcerer spells remain available to Divine Soul Sorcerer
  assert.equal(isSpellAvailableForClass(fireball, "Sorcerer", ["PHB"], "Divine Soul"), true);
});

test("Warlock Expanded Spell List integration: do not auto-prepare, added to knownSpells, uses Charisma DC/attack", () => {
  const char = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    classes: [cl("Warlock", 5, "The Fiend")],
    knownSpells: [{ name: "Fireball", source: "PHB", ownerKey: "Warlock__PHB" }],
  });

  const profiles = getClassSpellProfiles(char, { activeBooks: ["PHB"] });
  assert.equal(profiles.length, 1);
  const profile = profiles[0];

  assert.equal(profile.className, "Warlock");
  assert.equal(profile.subclass, "The Fiend");
  assert.equal(profile.ability, "cha");
  // Total level 5 -> PB = 3. CHA mod = 3 (+3 from 16).
  // DC = 8 + 3 + 3 = 14, attack bonus = 3 + 3 = 6
  assert.equal(profile.spellSaveDc, 14);
  assert.equal(profile.spellAttackBonus, 6);

  // Warlock has no daily prepared limit
  assert.equal(profile.preparedLimit, undefined);

  // Expanded Spell List spells do NOT auto-prepare (alwaysPreparedSpells is empty)
  assert.deepEqual(profile.alwaysPreparedSpells, []);

  // Learned Expanded Spell List spell is stored in knownSpells
  assert.equal(profile.knownSpells.length, 1);
  assert.equal(profile.knownSpells[0].name, "Fireball");
  assert.equal(profile.knownSpells[0].ownerKey, "Warlock__PHB");
});

test("Divine Soul Sorcerer spell profile integration: learned Cleric spells use Charisma DC/attack", () => {
  const char = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    classes: [cl("Sorcerer", 5, "Divine Soul")],
    knownSpells: [{ name: "Cure Wounds", source: "PHB", ownerKey: "Sorcerer__PHB" }],
  });

  const profiles = getClassSpellProfiles(char, { activeBooks: ["PHB"] });
  assert.equal(profiles.length, 1);
  const profile = profiles[0];

  assert.equal(profile.className, "Sorcerer");
  assert.equal(profile.subclass, "Divine Soul");
  assert.equal(profile.ability, "cha");
  assert.equal(profile.spellSaveDc, 14);
  assert.equal(profile.spellAttackBonus, 6);
  assert.equal(profile.knownSpells.length, 1);
  assert.equal(profile.knownSpells[0].name, "Cure Wounds");
  assert.equal(profile.knownSpells[0].ownerKey, "Sorcerer__PHB");
});

test("getClassSpellProfiles: Ranger and Sorcerer profiles include subclassKnownSpells and do not increment prepared count", () => {
  // Clockwork Soul Sorcerer at level 1
  const sorcerer = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    classes: [cl("Sorcerer", 1, "Clockwork Soul")],
    knownSpells: [{ name: "Magic Missile", source: "PHB", ownerKey: "Sorcerer__PHB" }],
  });

  const sorcProfiles = getClassSpellProfiles(sorcerer);
  assert.equal(sorcProfiles.length, 1);
  const sorcProfile = sorcProfiles[0];
  assert.equal(sorcProfile.className, "Sorcerer");
  assert.ok(sorcProfile.subclassKnownSpells);
  const sorcSubNames = sorcProfile.subclassKnownSpells.map((s) => s.name).sort();
  assert.deepEqual(sorcSubNames, ["Alarm", "Protection from Evil and Good"]);
  // Known casters have undefined preparedLimit and empty preparedSpells
  assert.equal(sorcProfile.preparedLimit, undefined);
  assert.deepEqual(sorcProfile.preparedSpells, []);

  // Gloom Stalker Ranger at level 3
  const ranger = makeChar({
    baseAbilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 14, cha: 10 },
    classes: [cl("Ranger", 3, "Gloom Stalker")],
    knownSpells: [{ name: "Hunter's Mark", source: "PHB", ownerKey: "Ranger__PHB" }],
  });

  const rangerProfiles = getClassSpellProfiles(ranger);
  assert.equal(rangerProfiles.length, 1);
  const rangerProfile = rangerProfiles[0];
  assert.equal(rangerProfile.className, "Ranger");
  assert.ok(rangerProfile.subclassKnownSpells);
  const rangerSubNames = rangerProfile.subclassKnownSpells.map((s) => s.name);
  assert.deepEqual(rangerSubNames, ["Disguise Self"]);
  assert.equal(rangerProfile.preparedLimit, undefined);
  assert.deepEqual(rangerProfile.preparedSpells, []);
});


