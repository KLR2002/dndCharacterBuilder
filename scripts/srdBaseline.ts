import type { ClassData, ClassFeatureData, FeatureChoice, SubclassData } from "../src/types/dnd5e.ts";

/** The SRD archetypes per class. A subclass is kept when its name contains one of them. */
export const SRD_ARCHETYPES: Record<string, string[]> = {
  Barbarian: ["Berserker", "Path of the Berserker"],
  Bard: ["Lore", "College of Lore"],
  Cleric: ["Life", "Life Domain"],
  Druid: ["Land", "Circle of the Land"],
  Fighter: ["Champion"],
  Monk: ["Open Hand", "Way of the Open Hand"],
  Paladin: ["Devotion", "Oath of Devotion"],
  Ranger: ["Hunter"],
  Rogue: ["Thief"],
  Sorcerer: ["Draconic", "Draconic Bloodline"],
  Warlock: ["Fiend", "The Fiend"],
  Wizard: ["Evocation", "School of Evocation"],
};

/** Every option of a pick is an SRD option: the SRD names the book that prints it. */
function sourcedChoice(choice: FeatureChoice): FeatureChoice {
  if (!choice.options) return choice;
  return { ...choice, options: choice.options.map((option) => ({ ...option, source: "SRD" })) };
}

function srdFeature(feature: ClassFeatureData): ClassFeatureData {
  return feature.choices ? { ...feature, choices: sourcedChoice(feature.choices) } : feature;
}

function srdSubclass(subclass: SubclassData): SubclassData {
  const srd: SubclassData = {
    ...subclass,
    source: "SRD",
    features: subclass.features.map(srdFeature),
  };
  if (subclass.spellChoice) srd.spellChoice = sourcedChoice(subclass.spellChoice);
  return srd;
}

/**
 * The SRD Baseline's classes, from the scraper's class records. The archetype filter and the SRD source
 * stay as the scraper gives them. The PHB intro prose of each class is non-SRD (ADR 0014), so each class
 * description is empty. The options a feature or subclass offers keep their names but carry source SRD.
 */
export function pruneClasses(rawClasses: ClassData[]): ClassData[] {
  return rawClasses
    .filter((c) => SRD_ARCHETYPES[c.name])
    .map((c) => {
      const allowed = SRD_ARCHETYPES[c.name];
      const subclasses = (c.subclasses || [])
        .filter((sc) => allowed.some((a) => sc.name.toLowerCase().includes(a.toLowerCase())))
        .map(srdSubclass);
      return {
        ...c,
        source: "SRD",
        description: "",
        features: c.features.map(srdFeature),
        subclasses,
      };
    });
}
