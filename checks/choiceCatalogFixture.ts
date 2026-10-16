import type { CompendiumCollections } from "../src/services/compendiumStorage.ts";
import type { ClassData, ClassFeatureData, FeatureChoice, SubclassData } from "../src/types/dnd5e.ts";

/**
 * An Integrated Catalog bundle for tests, built with invented placeholder text. The structure is
 * the real scraped structure: a class whose subclass features carry `choices` for the option
 * features they name, and subclasses whose `additionalSpells` lift to a `spellChoice`. Later tickets
 * extend this file, so keep additions additive.
 */

const placeholderChoices = (level: number): FeatureChoice => ({
  pick: 1,
  options: [
    { name: "Bear", description: `Placeholder text for Bear at level ${level}.`, source: "PHB" },
    { name: "Eagle", description: `Placeholder text for Eagle at level ${level}.`, source: "PHB" },
    { name: "Wolf", description: `Placeholder text for Wolf at level ${level}.`, source: "PHB" },
    { name: "Elk", description: `Placeholder text for Elk at level ${level}.`, source: "SCAG" },
    { name: "Tiger", description: `Placeholder text for Tiger at level ${level}.`, source: "SCAG" },
  ],
});

const totemFeature = (name: string, level: number): ClassFeatureData => ({
  name,
  level,
  description: `Placeholder prose for ${name}.`,
  choices: placeholderChoices(level),
});

const totemWarrior: SubclassData = {
  name: "Path of the Totem Warrior",
  shortName: "Totem Warrior",
  source: "PHB",
  className: "Barbarian",
  classSource: "PHB",
  features: [
    totemFeature("Totem Spirit", 3),
    totemFeature("Aspect of the Beast", 6),
    totemFeature("Totemic Attunement", 14),
  ],
  description: "Placeholder description for the Totem Warrior subclass.",
};

// Spell-choice subclasses. Option names are the real ones the Rule Choices offer; the spells are
// invented. Each subclass carries its raw `additionalSpells` and the `spellChoice` the scraper lifts
// from them, so a test can check the two agree.

/** Two invented spell names an option grants, named after the option. */
const grantedSpells = (option: string): string[] => [
  `placeholder ${option.toLowerCase()} one`,
  `placeholder ${option.toLowerCase()} two`,
];

const titled = (text: string): string =>
  text.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

const grantDescription = (option: string): string => grantedSpells(option).map(titled).join(", ");

const BIOMES = ["Arctic", "Coast", "Desert", "Forest", "Grassland", "Mountain", "Swamp", "Underdark"];
const AFFINITIES = ["Good", "Evil", "Law", "Chaos", "Neutrality"];
const GENIE_KINDS = ["Dao", "Djinni", "Efreeti", "Marid"];
const GIANT_CANTRIPS = ["Druidcraft", "Thaumaturgy"];

const landSubclass: SubclassData = {
  name: "Circle of the Land",
  shortName: "Land",
  source: "PHB",
  className: "Druid",
  classSource: "PHB",
  features: [],
  additionalSpells: BIOMES.map((name) => ({
    name,
    known: { "1": { _: [{ choose: "level=0|class=Druid" }] } },
    prepared: { "3": grantedSpells(name) },
  })),
  spellChoice: {
    pick: 1,
    options: BIOMES.map((name) => ({ name, description: grantDescription(name) })),
  },
  description: "Placeholder description for the Circle of the Land subclass.",
};

const divineSoulSubclass: SubclassData = {
  name: "Divine Soul",
  shortName: "Divine Soul",
  source: "XGE",
  className: "Sorcerer",
  classSource: "PHB",
  features: [],
  additionalSpells: AFFINITIES.map((name) => ({
    name,
    known: { "1": [grantedSpells(name)[0]] },
    expanded: { "1": [{ all: "level=0|class=Cleric" }] },
  })),
  spellChoice: {
    pick: 1,
    options: AFFINITIES.map((name) => ({ name, description: titled(grantedSpells(name)[0]) })),
  },
  description: "Placeholder description for the Divine Soul subclass.",
};

const genieSubclass: SubclassData = {
  name: "The Genie",
  shortName: "Genie",
  source: "TCE",
  className: "Warlock",
  classSource: "PHB",
  features: [],
  additionalSpells: GENIE_KINDS.map((name) => ({
    name,
    expanded: { "9": ["placeholder wish"], s1: grantedSpells(name) },
  })),
  spellChoice: {
    pick: 1,
    options: GENIE_KINDS.map((name) => ({
      name,
      description: `Placeholder Wish, ${grantDescription(name)}`,
    })),
  },
  description: "Placeholder description for the Genie subclass.",
};

const giantSubclass: SubclassData = {
  name: "Path of the Giant",
  shortName: "Giant",
  source: "BGG",
  className: "Barbarian",
  classSource: "PHB",
  features: [],
  additionalSpells: GIANT_CANTRIPS.map((name) => ({
    innate: { "3": [name.toLowerCase()] },
  })),
  spellChoice: {
    pick: 1,
    options: GIANT_CANTRIPS.map((name) => ({ name, description: "" })),
  },
  description: "Placeholder description for the Giant subclass.",
};

const classWith = (name: string, subclasses: SubclassData[], overrides: Partial<ClassData> = {}): ClassData => ({
  name,
  source: "PHB",
  hitDie: "1d8",
  primaryAbility: [],
  savingThrows: [],
  armorProficiencies: [],
  weaponProficiencies: [],
  toolProficiencies: [],
  skillProficiencies: { choose: 2, from: [] },
  features: [],
  subclasses,
  description: `Placeholder description for the ${name} class.`,
  ...overrides,
});

/** The fixture's classes. Barbarian comes first, with the Totem Warrior first among its subclasses. */
export const choiceCatalogClasses = (): ClassData[] => [
  classWith(
    "Barbarian",
    [totemWarrior, giantSubclass],
    { hitDie: "1d12", primaryAbility: ["Strength"], savingThrows: ["Strength", "Constitution"] },
  ),
  classWith("Druid", [landSubclass]),
  classWith("Sorcerer", [divineSoulSubclass]),
  classWith("Warlock", [genieSubclass]),
];

/** A Compendium bundle over the fixture catalog. Overrides replace whole collections. */
export function choiceCatalogBundle(overrides: Partial<CompendiumCollections> = {}): CompendiumCollections {
  return {
    hasIntegratedCatalog: true,
    races: [],
    classes: choiceCatalogClasses(),
    feats: [],
    backgrounds: [],
    items: [],
    spells: [],
    beasts: [],
    conditions: [],
    optionsAndFeatures: [],
    books: [],
    ...overrides,
  };
}
