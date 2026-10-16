import type { Character } from "../src/types/character.ts";
import { DEFAULT_ACTIVE_BOOK_CODES } from "../src/constants/books.ts";
import { readFileSync, existsSync } from "node:fs";
import { createCompendium, integrate, revertToSrd, type Compendium } from "../src/services/compendium.ts";
import { loadCompendiumData, REQUIRED_CATALOG_FORMAT, type CompendiumCollections } from "../src/services/compendiumStorage.ts";
import { choiceCatalogBundle } from "./choiceCatalogFixture.ts";

/**
 * In-memory Compendium over the given collections. Collections not given are empty. Unless
 * `integrated` is set it is a plain (SRD-style) bundle, so nothing falls back to the SRD Baseline.
 */
export function inMemoryCompendium(
  collections: Partial<Omit<CompendiumCollections, "hasIntegratedCatalog">> = {},
  options: { integrated?: boolean } = {},
): Compendium {
  return createCompendium({
    hasIntegratedCatalog: options.integrated ?? false,
    races: [],
    classes: [],
    feats: [],
    backgrounds: [],
    items: [],
    spells: [],
    beasts: [],
    conditions: [],
    optionsAndFeatures: [],
    books: [],
    ...collections,
  });
}

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
  ConditionData,
  OptionFeatureData,
} from "../src/types/dnd5e.ts";

export function defaultSettings() {
  return {
    schemaVersion: 2,
    hasCompletedFirstRun: false,
    activeResourceBooks: [...DEFAULT_ACTIVE_BOOK_CODES],
    themeAccentId: "crimson",
  };
}

export function loadTestCatalog<T = any>(name: string): T {
  const scrapPath = new URL(`../dnd5eToolsScrap/data/${name}.json`, import.meta.url);
  if (existsSync(scrapPath)) {
    return JSON.parse(readFileSync(scrapPath, "utf8"));
  }
  return JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
}

export function loadSrdCatalog<T = any>(name: string): T {
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

/**
 * The Barbarian's Totem Warrior taken from the fixture catalog, which carries the choices the
 * scraper now emits for it. Swapped into a bundle in place of the scraped Totem Warrior.
 */
export function withTotemFixture(bundle: CompendiumCollections): CompendiumCollections {
  const [totem] = choiceCatalogBundle().classes[0].subclasses;
  return {
    ...bundle,
    classes: bundle.classes.map((c) =>
      c.name === "Barbarian"
        ? { ...c, subclasses: [...c.subclasses.filter((sc) => sc.shortName !== totem.shortName), totem] }
        : c,
    ),
  };
}

/**
 * Adds each fixture subclass the bundle lacks (the Land, Divine Soul, Genie, Giant and Totem
 * Warrior fixtures). A subclass the bundle already holds is kept as it is, so the SRD Land still
 * lifts its biomes from its own additional spells and a scraped Totem stays scraped.
 */
export function withSpellChoiceFixtures(bundle: CompendiumCollections): CompendiumCollections {
  const classes = [...bundle.classes];
  for (const fixtureClass of choiceCatalogBundle().classes) {
    const index = classes.findIndex((c) => c.name === fixtureClass.name);
    if (index === -1) {
      classes.push(fixtureClass);
      continue;
    }
    const held = new Set(classes[index].subclasses.map((sc) => sc.name));
    const missing = fixtureClass.subclasses.filter((sc) => !held.has(sc.name));
    classes[index] = { ...classes[index], subclasses: [...classes[index].subclasses, ...missing] };
  }
  return { ...bundle, classes };
}

/** The full integrated catalog (scrap data, falling back to bundled data) as a collections bundle. */
function integratedTestBundle(): CompendiumCollections {
  return withTotemFixture({
    hasIntegratedCatalog: true,
    catalogFormat: REQUIRED_CATALOG_FORMAT,
    races: loadTestCatalog<RaceData[]>("races"),
    classes: loadTestCatalog<ClassData[]>("classes"),
    feats: loadTestCatalog<FeatData[]>("feats"),
    backgrounds: loadTestCatalog<BackgroundData[]>("backgrounds"),
    items: loadTestCatalog<ItemData[]>("items"),
    spells: loadTestCatalog<SpellData[]>("spells"),
    beasts: loadTestCatalog<BeastData[]>("beasts"),
    conditions: loadTestCatalog<ConditionData[]>("conditions"),
    optionsAndFeatures: loadTestCatalog<OptionFeatureData[]>("options_and_features"),
    books: loadTestCatalog<any[]>("books"),
  });
}

/** An explicit integrated Compendium, without touching the process-wide default. */
export function integratedTestCompendium(): Compendium {
  return createCompendium(integratedTestBundle());
}

/** The SRD Baseline as a collections bundle, built from the bundled SRD data. */
export function srdBaselineBundle(): CompendiumCollections {
  return {
    hasIntegratedCatalog: false,
    races: loadSrdCatalog<RaceData[]>("races"),
    classes: loadSrdCatalog<ClassData[]>("classes"),
    feats: loadSrdCatalog<FeatData[]>("feats"),
    backgrounds: loadSrdCatalog<BackgroundData[]>("backgrounds"),
    items: loadSrdCatalog<ItemData[]>("items"),
    spells: loadSrdCatalog<SpellData[]>("spells"),
    beasts: loadSrdCatalog<BeastData[]>("beasts"),
    conditions: loadSrdCatalog<ConditionData[]>("conditions"),
    optionsAndFeatures: loadSrdCatalog<OptionFeatureData[]>("options_and_features"),
    books: [],
  };
}

/** An explicit SRD Baseline Compendium built from the bundled SRD data, without touching the process-wide default. */
export function srdBaselineCompendium(): Compendium {
  return createCompendium(srdBaselineBundle());
}

// Seed the process-wide default with the full integrated compendium for rule and progression test suites
export function resetTestCompendium() {
  try {
    integrate(integratedTestBundle());
  } catch {
    // Ignore in case scrap data not accessible
  }
}

/**
 * Hydrates the process-wide default from the stored catalog, as the app does on launch: the
 * integrated catalog when one is stored, otherwise the SRD Baseline.
 */
export async function hydrateCompendiumFromStorage(): Promise<void> {
  try {
    const data = await loadCompendiumData();
    if (data && data.hasIntegratedCatalog) integrate(data);
    else revertToSrd();
  } catch {
    revertToSrd();
  }
}

resetTestCompendium();
