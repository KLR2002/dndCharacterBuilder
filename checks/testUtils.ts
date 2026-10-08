import type { Character } from "../src/types/character.ts";
import { DEFAULT_ACTIVE_BOOK_CODES } from "../src/constants/books.ts";

export function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: "char_test", name: "Test Hero", folderId: null, gender: "", alignment: "",
    faction: { name: "", rank: "", renown: "", notes: "" }, avatarUri: null,
    createdAt: 1, updatedAt: 1, abilityMethod: "pointBuy",
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    customLineage: false, lineageReplacement: null, race: null, racialAbilityBonuses: {},
    background: null, startingOption: "equipment", classes: [], chosenSkills: [],
    chosenExpertise: [], asiSelections: [], currentHp: 10, maxHpOverride: null,
    tempHp: 0, conditions: [], usedHitDice: {}, deathSaves: { successes: 0, failures: 0 },
    knownSpells: [], preparedSpells: [], usedSpellSlots: {}, usedPactSlots: 0,
    sorceryPointsUsed: 0, chosenMetamagic: [], items: [],
    pouch: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, useWeightLimit: false,
    resourceCounters: {}, description: "", backstory: "", personalityTraits: "",
    ideals: "", bonds: "", flaws: "", notes: "", ...overrides,
  };
}

import type {
  ClassData,
  RaceData,
  BackgroundData,
  FeatData,
  SpellData,
  ItemData,
  BeastData,
} from "../src/types/dnd5e.ts";
import { readFileSync } from "node:fs";

export function defaultSettings() {
  return {
    schemaVersion: 2,
    hasCompletedFirstRun: false,
    activeResourceBooks: [...DEFAULT_ACTIVE_BOOK_CODES],
    themeAccentId: "crimson",
  };
}

export function loadTestCatalog<T = any>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
}

export function loadTestCatalogs() {
  return {
    classes: loadTestCatalog<ClassData[]>("classes"),
    races: loadTestCatalog<RaceData[]>("races"),
    backgrounds: loadTestCatalog<BackgroundData[]>("backgrounds"),
    feats: loadTestCatalog<FeatData[]>("feats"),
    spells: loadTestCatalog<SpellData[]>("spells"),
    items: loadTestCatalog<ItemData[]>("items"),
    beasts: loadTestCatalog<BeastData[]>("beasts"),
  };
}


