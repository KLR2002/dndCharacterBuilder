import type { CompendiumCollections } from "../src/services/compendiumStorage.ts";
import type { ClassData, ClassFeatureData, FeatureChoice, OptionFeatureData, SubclassData } from "../src/types/dnd5e.ts";

/**
 * An Integrated Catalog bundle for tests, built with invented placeholder text. The structure is
 * the real scraped structure: a class whose subclass features carry `choices` for the option
 * features they name. Later tickets extend this file, so keep additions additive.
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

const barbarian: ClassData = {
  name: "Barbarian",
  source: "PHB",
  hitDie: "1d12",
  primaryAbility: ["Strength"],
  savingThrows: ["Strength", "Constitution"],
  armorProficiencies: [],
  weaponProficiencies: [],
  toolProficiencies: [],
  skillProficiencies: { choose: 2, from: [] },
  features: [],
  subclasses: [totemWarrior],
  description: "Placeholder description for the Barbarian class.",
};

// The Elemental Discipline option records, as the scraper emits them: the real names and unlock
// prerequisites, invented text. Elemental Attunement is a record too; the Monk rows exclude it.
const disciplineRecord = (name: string, prerequisite: string | null): OptionFeatureData => ({
  name,
  source: "PHB",
  category: "Elemental Discipline",
  featureType: ["ED"],
  prerequisite,
  description: `Placeholder text for ${name}.`,
});

export const DISCIPLINE_FIXTURE_RECORDS: OptionFeatureData[] = [
  disciplineRecord("Elemental Attunement", null),
  disciplineRecord("Fangs of the Fire Snake", null),
  disciplineRecord("Fist of Four Thunders", null),
  disciplineRecord("Rush of the Gale Spirits", null),
  disciplineRecord("Shape the Flowing River", null),
  disciplineRecord("Sweeping Cinder Strike", null),
  disciplineRecord("Unbroken Air", null),
  disciplineRecord("Water Whip", null),
  disciplineRecord("Clench of the North Wind", "6th-level Monk"),
  disciplineRecord("Gong of the Summit", "6th-level Monk"),
  disciplineRecord("Flames of the Phoenix", "11th-level Monk"),
  disciplineRecord("Mist Stance", "11th-level Monk"),
  disciplineRecord("Ride the Wind", "11th-level Monk"),
  disciplineRecord("Breath of Winter", "17th-level Monk"),
  disciplineRecord("Eternal Mountain Defense", "17th-level Monk"),
  disciplineRecord("River of Hungry Flame", "17th-level Monk"),
  disciplineRecord("Wave of Rolling Earth", "17th-level Monk"),
];

/** A Compendium bundle over the fixture catalog. Overrides replace whole collections. */
export function choiceCatalogBundle(overrides: Partial<CompendiumCollections> = {}): CompendiumCollections {
  return {
    hasIntegratedCatalog: true,
    races: [],
    classes: [barbarian],
    feats: [],
    backgrounds: [],
    items: [],
    spells: [],
    beasts: [],
    conditions: [],
    optionsAndFeatures: [...DISCIPLINE_FIXTURE_RECORDS],
    books: [],
    ...overrides,
  };
}
