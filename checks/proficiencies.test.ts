import test from "node:test";
import assert from "node:assert/strict";
import { deduplicateWeaponProficiencies } from "../src/rules/proficiencies.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import type { Character } from "../src/types/character.ts";
import { loadTestCatalog, inMemoryCompendium } from "./testUtils.ts";

const races = loadTestCatalog("races");
const classes = loadTestCatalog("classes");

function makeTestChar(overrides: Partial<Character> = {}): Character {
  return {
    id: "test_char",
    name: "Tester",
    createdAt: 1,
    updatedAt: 1,
    avatarUri: null,
    abilityMethod: "pointBuy",
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    racialAbilityBonuses: {},
    race: null,
    background: null,
    startingOption: "equipment",
    classes: [],
    chosenSkills: [],
    chosenExpertise: [],
    asiSelections: [],
    currentHp: 10,
    maxHpOverride: null,
    tempHp: 0,
    conditions: [],
    usedHitDice: {},
    deathSaves: { successes: 0, failures: 0 },
    usedSpellSlots: {},
    sorceryPointsUsed: 0,
    chosenMetamagic: [],
    items: [],
    pouch: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    useWeightLimit: true,
    resourceCounters: {},
    description: "",
    backstory: "",
    personalityTraits: "",
    ideals: "",
    bonds: "",
    flaws: "",
    ...overrides,
  };
}

test("deduplicateWeaponProficiencies: removes individual martial weapons if Martial weapons is present", () => {
  const input = ["Martial weapons", "Longswords", "Shortswords", "Shortbows", "Longbows"];
  const result = deduplicateWeaponProficiencies(input);
  assert.ok(result.includes("Martial weapons"));
  assert.ok(result.includes("Shortbows"), "Shortbows is a simple weapon, so it must be preserved");
  assert.ok(!result.includes("Longswords"), "Longswords is martial, so it must be omitted");
  assert.ok(!result.includes("Shortswords"), "Shortswords is martial, so it must be omitted");
  assert.ok(!result.includes("Longbows"), "Longbows is martial, so it must be omitted");
});

test("deduplicateWeaponProficiencies: removes individual simple weapons if Simple weapons is present", () => {
  const input = ["Simple weapons", "Daggers", "Shortbows", "Longswords"];
  const result = deduplicateWeaponProficiencies(input);
  assert.ok(result.includes("Simple weapons"));
  assert.ok(result.includes("Longswords"), "Longswords is martial, so it must be preserved");
  assert.ok(!result.includes("Daggers"), "Daggers is simple, so it must be omitted");
  assert.ok(!result.includes("Shortbows"), "Shortbows is simple, so it must be omitted");
});

test("deduplicateWeaponProficiencies: collapses to both categories when character has Simple and Martial weapons", () => {
  const input = [
    "Simple weapons",
    "Martial weapons",
    "Longswords",
    "Shortswords",
    "Daggers",
    "Hand crossbows",
    "Shortbows",
    "Laser Pistol",
  ];
  const result = deduplicateWeaponProficiencies(input);
  assert.deepEqual(result.sort(), ["Laser Pistol", "Martial weapons", "Simple weapons"].sort());
});

test("evaluateCharacter: Elf Fighter collapses elf weapons into Simple and Martial weapons", () => {
  const char = makeTestChar({
    race: { name: "Elf", source: "PHB", subraceName: "High Elf", subraceSource: "PHB" },
    classes: [{ className: "Fighter", level: 1, source: "PHB" }],
  });
  const evaluated = evaluateCharacter(char, { compendium: inMemoryCompendium({ races, classes }) });
  const weaponProfs = evaluated.proficiencies.weapons;

  assert.ok(weaponProfs.includes("Simple weapons"));
  assert.ok(weaponProfs.includes("Martial weapons"));
  assert.ok(!weaponProfs.includes("Longswords"));
  assert.ok(!weaponProfs.includes("Shortswords"));
  assert.ok(!weaponProfs.includes("Shortbows"));
  assert.ok(!weaponProfs.includes("Longbows"));
});

test("evaluateCharacter: Elf Wizard preserves elf weapons because Wizard lacks martial proficiency", () => {
  const char = makeTestChar({
    race: { name: "Elf", source: "PHB", subraceName: "High Elf", subraceSource: "PHB" },
    classes: [{ className: "Wizard", level: 1, source: "PHB" }],
  });
  const evaluated = evaluateCharacter(char, { compendium: inMemoryCompendium({ races, classes }) });
  const weaponProfs = evaluated.proficiencies.weapons;

  // Wizard does NOT grant "Simple weapons" or "Martial weapons" as a group
  assert.ok(weaponProfs.includes("Longswords"));
  assert.ok(weaponProfs.includes("Shortswords"));
  assert.ok(weaponProfs.includes("Shortbows"));
  assert.ok(weaponProfs.includes("Longbows"));
  assert.ok(weaponProfs.includes("Daggers"));
});
