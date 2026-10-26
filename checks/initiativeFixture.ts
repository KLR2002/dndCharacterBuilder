import type { ClassData, ClassFeatureData, FeatData, RaceData, SubclassData, SubraceData, TraitData } from "../src/types/dnd5e.ts";

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
  classRecord("Sample Warden", "1d10", [feature("Sample Vigil", 3, { kind: "proficiency" })], []),
];

/** An invented feat whose flat Initiative Bonus is +5. Taken through an ability score improvement or as an origin feat. */
export const initiativeFeats = (): FeatData[] => [
  {
    name: "Sample Watchword",
    source: "PHB",
    prerequisite: null,
    abilityScoreIncrease: null,
    description: "Placeholder description for the feat.",
    initiativeBonus: { kind: "flat", value: 5 },
  },
];

const trait = (name: string, initiativeBonus?: TraitData["initiativeBonus"], choice?: TraitData["choice"]): TraitData => ({
  name,
  description: "Placeholder description for the trait.",
  ...(initiativeBonus ? { initiativeBonus } : {}),
  ...(choice ? { choice } : {}),
});

const subrace = (name: string, traits: TraitData[], isVariant = false): SubraceData => ({
  name,
  isVariant,
  source: "PHB",
  raceName: "Sample Kin",
  raceSource: "PHB",
  abilityScoreIncrease: [],
  darkvision: null,
  traits,
  description: "Placeholder description for the subrace.",
});

const race = (name: string, traits: TraitData[], subraces: SubraceData[]): RaceData => ({
  name,
  source: "PHB",
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits,
  languages: [],
  subraces,
  description: "Placeholder description for the race.",
});

/**
 * An invented race whose Sample Hop trait gives the proficiency bonus, with two subraces: Sample Hillward, whose Sample
 * Gift gives a Wisdom-modifier bonus, and a variant, Sample Variant, whose choice replaces Sample Hop. Sample Lineage is an
 * invented lineage whose own trait gives +1.
 */
export const initiativeRaces = (): RaceData[] => [
  race(
    "Sample Kin",
    [trait("Sample Hop", { kind: "proficiency" })],
    [
      subrace("Sample Hillward", [trait("Sample Gift", { kind: "ability", ability: "wis" })]),
      subrace(
        "Sample Variant",
        [
          trait("Variant Feature (Choose 1)", undefined, {
            pick: 1,
            level: 1,
            replaces: "Sample Hop",
            options: [
              { name: "Sample Hop", description: "Placeholder description for the option." },
              { name: "Sample Grit", description: "Placeholder description for the option." },
            ],
          }),
        ],
        true,
      ),
    ],
  ),
  race("Sample Lineage", [trait("Sample Trance", { kind: "flat", value: 1 })], []),
];

/** An invented class whose optional feature gives a flat +2 only while the character has it switched on. */
export const optionalClasses = (): ClassData[] => [
  classRecord("Sample Tinker", "1d8", [{ ...feature("Sample Gadget", 2, { kind: "flat", value: 2 }), isOptional: true }], []),
];

/**
 * An invented class with a base feature (a flat +3) and an optional feature (+1) that replaces it. The two names are
 * passed in, so the test can take them from the engine's replacement table and no feature name is written here.
 */
export const replacementClasses = (replaced: string, replacer: string): ClassData[] => [
  classRecord(
    "Sample Charmer",
    "1d8",
    [feature(replaced, 2, { kind: "flat", value: 3 }), { ...feature(replacer, 2, { kind: "flat", value: 1 }), isOptional: true }],
    [],
  ),
];
