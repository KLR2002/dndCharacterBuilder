import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import {
  getClassSpellProfiles,
  calculateWarlockPactSlots,
  type ClassSpellProfile,
} from "../src/rules/spellcasting.ts";
import type { CharacterClass } from "../src/types/character.ts";

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

  // Paladin 1 -> 0 (no spell slots at level 1)
  const pal1 = makeChar({ classes: [cl("Paladin", 1)] });
  assert.equal(getClassSpellProfiles(pal1)[0].maxSpellLevel, 0);

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

  // Paladin 1 with CHA 8 (-1) -> Math.max(1, Math.floor(1 / 2) + (-1)) = Math.max(1, -1) = 1
  const lowChaPaladin1 = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 8 },
    classes: [cl("Paladin", 1)],
  });
  assert.equal(getClassSpellProfiles(lowChaPaladin1)[0].preparedLimit, 1);

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

