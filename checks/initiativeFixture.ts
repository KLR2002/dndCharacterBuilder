import type { ClassData, ClassFeatureData, SubclassData } from "../src/types/dnd5e.ts";

/**
 * Invented classes for the Initiative Bonus engine tests. Names and text are made up on purpose: no real 5e prose
 * and no real rule text in fixtures.
 */

const feature = (name: string, level: number, initiativeBonus?: ClassFeatureData["initiativeBonus"]): ClassFeatureData => ({
  name,
  level,
  description: "Placeholder description for the feature.",
  ...(initiativeBonus ? { initiativeBonus } : {}),
});

const subclass = (name: string, className: string, features: ClassFeatureData[]): SubclassData => ({
  name,
  shortName: name,
  source: "PHB",
  className,
  classSource: "PHB",
  features,
  description: "Placeholder description for the subclass.",
});

const classRecord = (name: string, hitDie: string, features: ClassFeatureData[], subclasses: SubclassData[]): ClassData => ({
  name,
  source: "PHB",
  hitDie,
  primaryAbility: [],
  savingThrows: [],
  armorProficiencies: [],
  weaponProficiencies: [],
  toolProficiencies: [],
  skillProficiencies: { choose: 0, from: [] },
  features,
  subclasses,
  description: "Placeholder description for the class.",
});

/**
 * A scout whose Blade subclass gives a Charisma-modifier Initiative Bonus at 3rd level and whose Watch subclass gives a
 * Wisdom-modifier one, and a mage whose Insight gives an Intelligence-modifier one at 2nd level.
 */
export const initiativeClasses = (): ClassData[] => [
  classRecord(
    "Sample Scout",
    "1d8",
    [feature("Sample Footwork", 1)],
    [
      subclass("Sample Blade", "Sample Scout", [feature("Sample Gambit", 3, { kind: "ability", ability: "cha" })]),
      subclass("Sample Watch", "Sample Scout", [feature("Sample Lookout", 3, { kind: "ability", ability: "wis" })]),
    ],
  ),
  classRecord("Sample Mage", "1d6", [feature("Sample Insight", 2, { kind: "ability", ability: "int" })], []),
];
