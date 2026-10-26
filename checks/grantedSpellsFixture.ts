import type { ClassData, FeatData, RaceData, SpellData, SubraceData } from "../src/types/dnd5e.ts";

/**
 * Invented classes, feats and spells for the granted spell engine tests. Every name and sentence is made up on purpose:
 * no real 5e prose and no real rule text in fixtures. The feats' spell grants use the scraper's shape (normalised spell
 * names; a `choose` object is a pick the player makes).
 */

const spell = (
  name: string,
  level: number,
  classes: string[] = ["Sample Mage"],
  source = "TST",
  extra: Partial<SpellData> = {},
): SpellData => ({
  name,
  source,
  level,
  school: "Evocation",
  castingTime: "1 action",
  range: "Self",
  components: { verbal: true, somatic: false, material: false },
  componentsString: "V",
  duration: "Instantaneous",
  concentration: false,
  ritual: false,
  classes,
  subclasses: [],
  damageTypes: [],
  savingThrows: [],
  description: "Placeholder description for the spell.",
  higherLevels: null,
  ...extra,
});

/** The spells the sample feats name, a cantrip and a spell of each level the feats use. */
export const grantedSpellSpells = (): SpellData[] => [
  spell("Sample Ember", 0),
  spell("Sample Glimmer", 0),
  spell("Sample Veil", 2),
  spell("Sample Pulse", 1),
  // Two first-level mage spells of two schools (the cleric list stays as the Magic Initiate cases expect), and two mage
  // cantrips that need an attack roll: a ranged one and a melee one.
  spell("Sample Lure", 1, ["Sample Mage"], "TST", { school: "Enchantment" }),
  spell("Sample Augur", 1, ["Sample Mage"], "TST", { school: "Divination" }),
  spell("Sample Shot", 0, ["Sample Mage"], "TST", { spellAttack: ["R"] }),
  spell("Sample Jab", 0, ["Sample Mage"], "TST", { spellAttack: ["M"] }),
  // A second invented class, and a cantrip in a second invented book that a player may switch off.
  spell("Sample Blessing", 0, ["Sample Cleric"]),
  spell("Sample Ward", 1, ["Sample Cleric"]),
  spell("Sample Spark", 0, ["Sample Cleric"], "TST2"),
  // A record of the SRD Baseline, which is always on whatever books are switched on.
  spell("Sample Flicker", 0, ["Sample Mage"], "SRD"),
];

/** An invented spellcasting class whose spells are the sample spells above. */
const sampleClass = (name: string, ability: string): ClassData => ({
  name,
  source: "TST",
  hitDie: "1d6",
  primaryAbility: [],
  savingThrows: [],
  armorProficiencies: [],
  weaponProficiencies: [],
  toolProficiencies: [],
  skillProficiencies: { choose: 0, from: [] },
  spellcasting: { ability, progression: "full" },
  features: [],
  subclasses: [],
  description: "Placeholder description for the class.",
});

export const grantedSpellClasses = (): ClassData[] => [sampleClass("Sample Mage", "int"), sampleClass("Sample Cleric", "wis")];

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
  // Sample Initiate offers a spell list to choose from: a Mage list or a Cleric list, each with two cantrips and a spell.
  feat("Sample Initiate", {
    additionalSpells: [
      {
        name: "Sample Mage Spells",
        ability: "int",
        known: { _: [{ choose: "level=0|class=Sample Mage", count: 2 }] },
        innate: { _: { daily: { "1": [{ choose: "level=1|class=Sample Mage" }] } } },
      },
      {
        name: "Sample Cleric Spells",
        ability: "wis",
        known: { _: [{ choose: "level=0|class=Sample Cleric", count: 2 }] },
        innate: { _: { daily: { "1": [{ choose: "level=1|class=Sample Cleric" }] } } },
      },
    ],
  }),
  // The same shape as Sample Initiate under another name, so two sources can hold picks at once.
  feat("Sample Initiate Alt", {
    additionalSpells: [
      {
        name: "Sample Mage Spells",
        ability: "int",
        known: { _: [{ choose: "level=0|class=Sample Mage", count: 2 }] },
        innate: { _: { daily: { "1": [{ choose: "level=1|class=Sample Mage" }] } } },
      },
    ],
  }),
  // A pick whose filter uses a key this ticket does not support: it matches nothing.
  feat("Sample Odd Initiate", {
    additionalSpells: [
      {
        name: "Sample Odd Spells",
        ability: "cha",
        innate: { _: { daily: { "1": [{ choose: "level=1|colour=red" }] } } },
      },
    ],
  }),
  // A fixed grant of a spell from the SRD Baseline, which stays on when the player switches books off.
  feat("Sample Flicker Grant", {
    additionalSpells: [
      {
        ability: "int",
        known: { _: ["sample flicker"] },
      },
    ],
  }),
  // A fixed grant of a spell that lives only in the second invented book.
  feat("Sample Sparkle", {
    additionalSpells: [
      {
        ability: "int",
        known: { _: ["sample spark"] },
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
  // Named alternatives, each with its own fixed cantrips and one casting ability the player chooses for the feat. The
  // class list is written in lower case, as the source writes it.
  feat("Sample Lorekeeper", {
    additionalSpells: [
      {
        name: "Sample Hall 1",
        ability: { choose: ["int", "wis", "cha"] },
        known: { _: ["sample ember", "sample glimmer"] },
        innate: { _: { daily: { "1": [{ choose: "level=1|class=sample cleric;sample mage" }] } } },
      },
      {
        name: "Sample Hall 2",
        ability: { choose: ["int", "wis", "cha"] },
        known: { _: ["sample ember", "sample jab"] },
        innate: { _: { daily: { "1": [{ choose: "level=1|class=sample cleric;sample mage" }] } } },
      },
    ],
  }),
  // A cantrip the player picks from the mage's cantrips that need an attack roll.
  feat("Sample Duelist", {
    additionalSpells: [
      {
        ability: "int",
        known: { _: [{ choose: "level=0|class=Sample Mage|spell attack=m;r;o", count: 1 }] },
      },
    ],
  }),
  // A daily spell fixed by the feat, and a pick of a first-level spell of two schools, with the ability its increase raised.
  feat("Sample Charmer", {
    additionalSpells: [
      {
        ability: "inherit",
        innate: { _: { daily: { "1e": ["sample pulse", { choose: "level=1|school=E;D" }] } } },
      },
    ],
  }),
  // A first-level pick from the spells of two classes at once.
  feat("Sample Multi", {
    additionalSpells: [
      {
        ability: "int",
        innate: { _: { daily: { "1": [{ choose: "level=1|class=Sample Mage;Sample Cleric" }] } } },
      },
    ],
  }),
  // Two picks from a named list of spells.
  feat("Sample Scholar", {
    additionalSpells: [
      {
        ability: "cha",
        innate: { _: { daily: { "1": [{ choose: { from: ["sample pulse", "sample ward"], count: 2 } }] } } },
      },
    ],
  }),
  // A pick that the ritual book gives, which the reader does not model.
  feat("Sample Ritualist", {
    additionalSpells: [
      {
        ability: "int",
        innate: {
          _: {
            daily: { "1": [{ choose: "level=1|class=Sample Mage|components & miscellaneous=ritual", count: 2 }] },
            ritual: ["sample pulse"],
          },
        },
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
  race("Sample Caster", {
    additionalSpells: [
      {
        ability: "cha",
        innate: { "3": { daily: { "1": ["sample pulse", "sample veil"] } } },
        // The source casts Sample Pulse at level 2, as a `#2` suffix says; Sample Veil has no suffix and keeps its own level.
        castLevels: { "sample pulse": 2 },
      },
    ],
  }),
  race("Sample Chooser", {
    additionalSpells: [{ ability: { choose: ["int", "wis", "cha"] }, known: { "1": ["sample ember"] } }],
  }),
];
