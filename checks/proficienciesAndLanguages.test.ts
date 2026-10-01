import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getRaceLanguageGrant,
  getBackgroundLanguageGrant,
  getRaceToolGrant,
  getBackgroundToolGrant,
  getClassToolGrant,
  resolveCharacterLanguages,
  resolveCharacterTools,
  ARTISAN_TOOLS,
  MUSICAL_INSTRUMENTS,
  GAMING_SETS,
} from "../src/rules/proficienciesAndLanguages.ts";
import { POINT_BUY_COST } from "../src/constants/rules.ts";
import type { Character } from "../src/types/character.ts";

const readCatalog = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8")
  );

const races = readCatalog("races");
const backgrounds = readCatalog("backgrounds");
const classes = readCatalog("classes");

function createTestChar(overrides: Partial<Character> = {}): Character {
  return {
    id: "test_1",
    name: "Hero",
    createdAt: 1,
    updatedAt: 1,
    avatarUri: null,
    abilityMethod: "pointBuy",
    baseAbilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
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
    notes: "",
    customLineage: false,
    lineageReplacement: null,
    ...overrides,
  };
}

test("Point buy cost table matches 2014 D&D rules strictly", () => {
  assert.equal(POINT_BUY_COST[8], 0);
  assert.equal(POINT_BUY_COST[9], 1);
  assert.equal(POINT_BUY_COST[10], 2);
  assert.equal(POINT_BUY_COST[11], 3);
  assert.equal(POINT_BUY_COST[12], 4);
  assert.equal(POINT_BUY_COST[13], 5);
  assert.equal(POINT_BUY_COST[14], 7); // 13->14 costs 2
  assert.equal(POINT_BUY_COST[15], 9); // 14->15 costs 2
});

test("Dwarf language grant gives Common and Dwarvish with 0 choices", () => {
  const grant = getRaceLanguageGrant("Dwarf", undefined, races);
  assert.ok(grant.fixed.includes("Common"));
  assert.ok(grant.fixed.includes("Dwarvish"));
  assert.equal(grant.choiceCount, 0);
});

test("Human language grant gives Common and 1 choice", () => {
  const grant = getRaceLanguageGrant("Human", undefined, races);
  assert.ok(grant.fixed.includes("Common"));
  assert.equal(grant.choiceCount, 1);
});

test("High Elf language grant gives Common, Elvish, and 1 extra choice", () => {
  const grant = getRaceLanguageGrant("Elf", "High", races);
  assert.ok(grant.fixed.includes("Common"));
  assert.ok(grant.fixed.includes("Elvish"));
  assert.equal(grant.choiceCount, 1);
});

test("MPMM race language grant gives Common and 1 choice of language", () => {
  const mpmmRace = races.find((r) => r.name === "Lizardfolk" && r.source === "MPMM");
  assert.ok(mpmmRace, "MPMM Lizardfolk should exist in catalog");
  const grant = getRaceLanguageGrant("Lizardfolk", undefined, [mpmmRace]);
  assert.ok(grant.fixed.includes("Common"));
  assert.equal(grant.choiceCount, 1);
});

test("Half-Elf variant does not crash and grants Common, Elvish, and 1 choice", () => {
  const grant = getRaceLanguageGrant("Half-Elf", "Variant; Aquatic Elf Descent", races);
  assert.ok(grant.fixed.includes("Common"));
  assert.ok(grant.fixed.includes("Elvish"));
  assert.equal(grant.choiceCount, 1);
});

test("resolveCharacterLanguages handles Half-Elf variant cleanly", () => {
  const char = createTestChar({
    race: { name: "Half-Elf", source: "PHB", subraceName: "Variant; Aquatic Elf Descent" },
  });
  const langs = resolveCharacterLanguages(char, { races, backgrounds });
  assert.ok(langs.includes("Common"));
  assert.ok(langs.includes("Elvish"));
});

test("Races with subraces lacking a name property do not throw when querying grants", () => {
  const testCases = [
    { race: "Dragonborn", subrace: "Draconic Ancestry" },
    { race: "Half-Elf", subrace: "Variant; Drow Descent" },
    { race: "Half-Orc", subrace: "Variant" },
    { race: "Human", subrace: "Variant" },
    { race: "Tiefling", subrace: "Variant; Feral" },
  ];
  for (const tc of testCases) {
    assert.doesNotThrow(() => {
      getRaceLanguageGrant(tc.race, tc.subrace, races);
    }, `Failed for ${tc.race} - ${tc.subrace}`);
  }
});

test("Acolyte background language grant gives 2 choices", () => {
  const grant = getBackgroundLanguageGrant("Acolyte", backgrounds);
  assert.equal(grant.choiceCount, 2);
  assert.equal(grant.fixed.length, 0);
});

test("Hermit background language grant gives 1 choice", () => {
  const grant = getBackgroundLanguageGrant("Hermit", backgrounds);
  assert.equal(grant.choiceCount, 1);
});

test("Dwarf tool grant provides 1 choice between Smith, Brewer, or Mason tools", () => {
  const grant = getRaceToolGrant("Dwarf", undefined, races);
  assert.equal(grant.choices.length, 1);
  assert.equal(grant.choices[0].count, 1);
  assert.deepEqual(grant.choices[0].options, [
    "Smith's Tools",
    "Brewer's Supplies",
    "Mason's Tools",
  ]);
});

test("Rock Gnome tool grant provides Tinker's Tools as fixed grant", () => {
  const grant = getRaceToolGrant("Gnome", "Rock", races);
  assert.ok(grant.fixed.includes("Tinker's Tools"));
});

test("Folk Hero background tool grant gives 1 artisan tool choice and Vehicles (Land)", () => {
  const grant = getBackgroundToolGrant("Folk Hero", backgrounds);
  assert.ok(grant.fixed.includes("Vehicles (Land)"));
  assert.equal(grant.choices.length, 1);
  assert.deepEqual(grant.choices[0].options, ARTISAN_TOOLS);
});

test("Entertainer background tool grant gives Disguise Kit and 1 Musical Instrument choice", () => {
  const grant = getBackgroundToolGrant("Entertainer", backgrounds);
  assert.ok(grant.fixed.includes("Disguise Kit"));
  assert.equal(grant.choices.length, 1);
  assert.deepEqual(grant.choices[0].options, MUSICAL_INSTRUMENTS);
});

test("Criminal background tool grant gives Thieves' Tools and 1 Gaming Set choice", () => {
  const grant = getBackgroundToolGrant("Criminal", backgrounds);
  assert.ok(grant.fixed.includes("Thieves' Tools"));
  assert.equal(grant.choices.length, 1);
  assert.deepEqual(grant.choices[0].options, GAMING_SETS);
});

test("Bard class tool grant provides 3 Musical Instrument choices", () => {
  const grant = getClassToolGrant("Bard", classes);
  assert.equal(grant.choices.length, 1);
  assert.equal(grant.choices[0].count, 3);
  assert.deepEqual(grant.choices[0].options, MUSICAL_INSTRUMENTS);
});

test("Rogue class tool grant provides Thieves' Tools fixed", () => {
  const grant = getClassToolGrant("Rogue", classes);
  assert.ok(grant.fixed.includes("Thieves' Tools"));
  assert.equal(grant.choices.length, 0);
});

test("resolveCharacterLanguages combines fixed and chosen languages cleanly", () => {
  const char = createTestChar({
    race: { name: "Human", source: "PHB" },
    background: { name: "Acolyte", source: "PHB" },
    chosenLanguages: {
      race: ["Draconic"],
      background: ["Celestial", "Infernal"],
    },
  });
  const langs = resolveCharacterLanguages(char, { races, backgrounds });
  assert.ok(langs.includes("Common"));
  assert.ok(langs.includes("Draconic"));
  assert.ok(langs.includes("Celestial"));
  assert.ok(langs.includes("Infernal"));
  assert.equal(langs.length, 4);
});

test("resolveCharacterTools combines fixed and chosen tools cleanly without placeholders", () => {
  const char = createTestChar({
    race: { name: "Dwarf", source: "PHB" },
    background: { name: "Folk Hero", source: "PHB" },
    classes: [{ className: "Bard", source: "PHB", level: 1 }],
    chosenTools: {
      race: ["Smith's Tools"],
      background: ["Cook's Utensils"],
      class: ["Lute", "Flute", "Drum"],
    },
  });
  const tools = resolveCharacterTools(char, { races, backgrounds, classes });
  assert.ok(tools.includes("Smith's Tools"));
  assert.ok(tools.includes("Cook's Utensils"));
  assert.ok(tools.includes("Vehicles (Land)"));
  assert.ok(tools.includes("Lute"));
  assert.ok(tools.includes("Flute"));
  assert.ok(tools.includes("Drum"));
  assert.ok(!tools.includes("anyArtisansTool"));
});
