import test from "node:test";
import assert from "node:assert/strict";
import { ARTISAN_TOOLS, GAMING_SETS, MUSICAL_INSTRUMENTS } from "../src/rules/proficienciesAndLanguages.ts";
import { POINT_BUY_COST } from "../src/constants/rules.ts";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import type { Character } from "../src/types/character.ts";
import { inMemoryCompendium, integratedTestCompendium, loadTestCatalog, makeChar, srdBaselineCompendium } from "./testUtils.ts";

const integrated = integratedTestCompendium();
const races = loadTestCatalog("races");
const backgrounds = loadTestCatalog("backgrounds");
const classes = loadTestCatalog("classes");

const sheetLanguages = (char: Character, catalogs: Parameters<typeof proficiencySheet>[1]) =>
  proficiencySheet(char, catalogs).languages.map((l) => l.name);
const sheetNames = (entries: SheetEntry[]) => entries.map((entry) => entry.name);

/** The Proficiency Choices a character is offered from one origin, with their pools as names. */
const offersFrom = (char: Character, origin: AvailableRuleChoice["origin"], compendium = integrated) =>
  proficiencyChoiceOffers(char, { compendium }).filter((choice) => choice.origin === origin);

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

test("Dwarf gives Common and Dwarvish, and one tool choice from smith's, brewer's and mason's tools", () => {
  const dwarf = createTestChar({ race: { name: "Dwarf", source: "PHB" } });
  const sheet = proficiencySheet(dwarf, { compendium: integrated });
  assert.deepEqual(sheetNames(sheet.languages).sort(), ["Common", "Dwarvish"]);
  assert.deepEqual(sheetNames(sheet.tools), []);
  const [choice] = offersFrom(dwarf, "race");
  assert.equal(choice.choose, 1);
  assert.deepEqual(choice.options.map((option) => option.name), ["Smith's Tools", "Brewer's Supplies", "Mason's Tools"]);
});

test("Human gives Common and one language choice of any language", () => {
  const human = createTestChar({ race: { name: "Human", source: "PHB" } });
  assert.deepEqual(sheetLanguages(human, { compendium: integrated }), ["Common"]);
  const offers = offersFrom(human, "race").filter((choice) => choice.choose === 1);
  assert.ok(offers.length >= 1);
  assert.ok(offers.some((choice) => choice.options.some((option) => option.name === "Draconic")));
});

test("High Elf gives Common and Elvish, with one language choice", () => {
  const elf = createTestChar({ race: { name: "Elf", source: "PHB", subraceName: "High", subraceSource: "PHB" } });
  assert.deepEqual(sheetLanguages(elf, { compendium: integrated }).sort(), ["Common", "Elvish"]);
  assert.ok(offersFrom(elf, "race").some((choice) => choice.choose === 1));
});

test("the sheet's languages handle a Half-Elf variant cleanly", () => {
  const char = createTestChar({
    race: { name: "Half-Elf", source: "PHB", subraceName: "Variant; Aquatic Elf Descent" },
  });
  const langs = sheetLanguages(char, { compendium: inMemoryCompendium({ races, backgrounds }) });
  assert.ok(langs.includes("Common"));
  assert.ok(langs.includes("Elvish"));
});

test("races whose subraces lack a name do not throw when their grants are read", () => {
  const testCases = [
    { race: "Dragonborn", subrace: "Draconic Ancestry" },
    { race: "Half-Elf", subrace: "Variant; Drow Descent" },
    { race: "Half-Orc", subrace: "Variant" },
    { race: "Human", subrace: "Variant" },
    { race: "Tiefling", subrace: "Variant; Feral" },
  ];
  for (const tc of testCases) {
    assert.doesNotThrow(() => {
      proficiencySheet(createTestChar({ race: { name: tc.race, source: "PHB", subraceName: tc.subrace } }), { compendium: integrated });
    }, `Failed for ${tc.race} - ${tc.subrace}`);
  }
});

test("Acolyte gives two language choices and no fixed language beyond Common", () => {
  const acolyte = createTestChar({ background: { name: "Acolyte", source: "PHB" } });
  assert.deepEqual(sheetLanguages(acolyte, { compendium: integrated }), ["Common"]);
  const [choice] = offersFrom(acolyte, "background");
  assert.equal(choice.choose, 2);
});

test("Hermit gives one language choice", () => {
  const hermit = createTestChar({ background: { name: "Hermit", source: "PHB" } });
  const [choice] = offersFrom(hermit, "background");
  assert.equal(choice.choose, 1);
});

test("Rock Gnome gives Tinker's Tools as a fixed tool", () => {
  const rockGnome = createTestChar({ race: { name: "Gnome", source: "PHB", subraceName: "Rock", subraceSource: "PHB" } });
  assert.ok(sheetNames(proficiencySheet(rockGnome, { compendium: integrated }).tools).includes("Tinker's Tools"));
});

test("Folk Hero gives Vehicles (Land) and one artisan tool choice", () => {
  const folkHero = createTestChar({ background: { name: "Folk Hero", source: "PHB" } });
  assert.ok(sheetNames(proficiencySheet(folkHero, { compendium: integrated }).tools).includes("Vehicles (Land)"));
  const [choice] = offersFrom(folkHero, "background");
  assert.deepEqual(choice.options.map((option) => option.name).sort(), [...ARTISAN_TOOLS].sort());
});

test("Entertainer gives Disguise Kit and one musical instrument choice", () => {
  const entertainer = createTestChar({ background: { name: "Entertainer", source: "PHB" } });
  assert.ok(sheetNames(proficiencySheet(entertainer, { compendium: integrated }).tools).includes("Disguise Kit"));
  const [choice] = offersFrom(entertainer, "background");
  assert.deepEqual(choice.options.map((option) => option.name).sort(), [...MUSICAL_INSTRUMENTS].sort());
});

test("Criminal gives Thieves' Tools and one gaming set choice", () => {
  const criminal = createTestChar({ background: { name: "Criminal", source: "PHB" } });
  assert.ok(sheetNames(proficiencySheet(criminal, { compendium: integrated }).tools).includes("Thieves' Tools"));
  const [choice] = offersFrom(criminal, "background");
  assert.deepEqual(choice.options.map((option) => option.name).sort(), [...GAMING_SETS].sort());
});

test("Bard starting tools are three Musical Instrument picks, offered as a Proficiency Choice", () => {
  const bard = makeChar({ classes: [{ className: "Bard", source: "SRD", level: 1 }] });
  const offers = proficiencyChoiceOffers(bard, { compendium: srdBaselineCompendium() });
  assert.equal(offers.length, 1);
  assert.equal(offers[0].choose, 3);
  assert.deepEqual(offers[0].options.map((option) => option.name).sort(), [...MUSICAL_INSTRUMENTS].sort());
});

test("Rogue starting tools are Thieves' Tools, held from level 1", () => {
  const rogue = makeChar({ classes: [{ className: "Rogue", source: "SRD", level: 1 }] });
  const sheet = proficiencySheet(rogue, { compendium: srdBaselineCompendium() });
  assert.ok(sheet.tools.some((tool) => tool.name === "Thieves' Tools"));
});

test("the sheet's languages combine fixed and chosen languages cleanly", () => {
  const char = createTestChar({
    race: { name: "Human", source: "PHB" },
    background: { name: "Acolyte", source: "PHB" },
    chosenLanguages: {
      race: ["Draconic"],
      background: ["Celestial", "Infernal"],
    },
  });
  const langs = sheetLanguages(char, { compendium: inMemoryCompendium({ races, backgrounds }) });
  assert.ok(langs.includes("Common"));
  assert.ok(langs.includes("Draconic"));
  assert.ok(langs.includes("Celestial"));
  assert.ok(langs.includes("Infernal"));
  assert.equal(langs.length, 4);
});

test("the sheet's tools combine fixed tools and saved picks cleanly without placeholders", () => {
  const char = createTestChar({
    race: { name: "Dwarf", source: "PHB" },
    background: { name: "Folk Hero", source: "PHB" },
    chosenTools: {
      race: ["Smith's Tools"],
      background: ["Cook's Utensils"],
    },
  });
  const tools = sheetNames(proficiencySheet(char, { compendium: inMemoryCompendium({ races, backgrounds, classes }) }).tools);
  assert.ok(tools.includes("Smith's Tools"));
  assert.ok(tools.includes("Cook's Utensils"));
  assert.ok(tools.includes("Vehicles (Land)"));
  assert.ok(!tools.includes("anyArtisansTool"));
});
