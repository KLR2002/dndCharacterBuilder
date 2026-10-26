import type { ClassData, FeatData, RaceData, SpellData, SubraceData } from "../src/types/dnd5e.ts";

/**
 * Invented classes, feats and spells for the granted spell engine tests. Every name and sentence is made up on purpose:
 * no real 5e prose and no real rule text in fixtures. The feats' spell grants use the scraper's shape (normalised spell
 * names; a `choose` object is a pick the player makes).
 */

const spell = (name: string, level: number): SpellData => ({
  name,
  source: "TST",
  level,
  school: "Evocation",
  castingTime: "1 action",
  range: "Self",
  components: { verbal: true, somatic: false, material: false },
  componentsString: "V",
  duration: "Instantaneous",
  concentration: false,
  ritual: false,
  classes: ["Sample Mage"],
  subclasses: [],
  damageTypes: [],
  savingThrows: [],
  description: "Placeholder description for the spell.",
  higherLevels: null,
});

/** The spells the sample feats name, a cantrip and a spell of each level the feats use. */
export const grantedSpellSpells = (): SpellData[] => [
  spell("Sample Ember", 0),
  spell("Sample Glimmer", 0),
  spell("Sample Veil", 2),
  spell("Sample Pulse", 1),
];

/** An invented spellcasting class whose spells are the sample spells above. */
export const grantedSpellClasses = (): ClassData[] => [
  {
    name: "Sample Mage",
    source: "TST",
    hitDie: "1d6",
    primaryAbility: [],
    savingThrows: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    toolProficiencies: [],
    skillProficiencies: { choose: 0, from: [] },
    spellcasting: { ability: "int", progression: "full" },
    features: [],
    subclasses: [],
    description: "Placeholder description for the class.",
  },
];

const feat = (name: string, extra: Partial<FeatData>): FeatData => ({
  name,
  source: "TST",
  prerequisite: null,
  abilityScoreIncrease: null,
  description: "Placeholder description for the feat.",
  ...extra,
});

/**
 * Invented feats. Sample Cinder grants a cantrip at will and a daily spell, with the ability its increase raised (inherit).
 * Sample Warding grants a cantrip at will and a daily spell with a fixed Wisdom ability. Sample Chooser's ability is a pick
 * and Sample Picker's only spell is a pick: neither gives a card yet.
 */
export const grantedSpellFeats = (): FeatData[] => [
  feat("Sample Cinder", {
    additionalSpells: [
      {
        ability: "inherit",
        known: { _: ["sample ember"] },
        innate: { _: { daily: { "1": ["sample veil"] } } },
      },
    ],
  }),
  feat("Sample Warding", {
    additionalSpells: [
      {
        ability: "wis",
        known: { _: ["sample glimmer"] },
        innate: { _: { daily: { "1e": ["sample pulse"] } } },
      },
    ],
  }),
  feat("Sample Sight", {
    additionalSpells: [
      {
        ability: "int",
        innate: { _: { will: ["sample veil"] } },
      },
    ],
  }),
  feat("Sample Chooser", {
    additionalSpells: [
      {
        ability: { choose: ["int", "wis", "cha"] },
        known: { _: ["sample ember"] },
      },
    ],
  }),
  feat("Sample Picker", {
    additionalSpells: [
      {
        ability: "int",
        innate: { _: { daily: { "1": [{ choose: "level=1|class=Sample Mage" }] } } },
      },
    ],
  }),
];

const race = (name: string, extra: Partial<RaceData>): RaceData => ({
  name,
  source: "TST",
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [],
  description: "Placeholder description for the race.",
  ...extra,
});

const subrace = (name: string, raceName: string, extra: Partial<SubraceData>): SubraceData => ({
  name,
  source: "TST",
  raceName,
  raceSource: "TST",
  isVariant: false,
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  description: "Placeholder description for the subrace.",
  ...extra,
});

/**
 * Invented races. Sample Kin grants a cantrip at will from level 1 and a daily spell from level 3, with a fixed Charisma
 * ability. Its subrace Sample Line has grants of its own (Intelligence, a per-rest spell), so they replace the race's.
 * Sample Plain has none, so the race's grants stay. Sample Chooser's ability is a pick, so it gives no card yet.
 */
export const grantedSpellRaces = (): RaceData[] => [
  race("Sample Kin", {
    subraces: [
      subrace("Sample Line", "Sample Kin", {
        additionalSpells: [{ ability: "int", known: { "1": { rest: { "1": ["sample glimmer"] } } } }],
      }),
      subrace("Sample Plain", "Sample Kin", {}),
    ],
    additionalSpells: [
      {
        ability: "cha",
        known: { "1": ["sample ember"] },
        innate: { "3": { daily: { "1": ["sample pulse"] } } },
      },
    ],
  }),
  race("Sample Chooser", {
    additionalSpells: [{ ability: { choose: ["int", "wis", "cha"] }, known: { "1": ["sample ember"] } }],
  }),
];
