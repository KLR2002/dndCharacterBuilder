import type { ClassData, FeatData, SpellData } from "../src/types/dnd5e.ts";

/**
 * Invented classes, feats and spells for the granted spell engine tests. Every name and sentence is made up on purpose:
 * no real 5e prose and no real rule text in fixtures. The feats' spell grants use the scraper's shape (normalised spell
 * names; a `choose` object is a pick the player makes).
 */

const spell = (name: string, level: number, classes: string[] = ["Sample Mage"], source = "TST"): SpellData => ({
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
});

/** The spells the sample feats name, a cantrip and a spell of each level the feats use. */
export const grantedSpellSpells = (): SpellData[] => [
  spell("Sample Ember", 0),
  spell("Sample Glimmer", 0),
  spell("Sample Veil", 2),
  spell("Sample Pulse", 1),
  // A second invented class, and a cantrip in a second invented book that a player may switch off.
  spell("Sample Blessing", 0, ["Sample Cleric"]),
  spell("Sample Ward", 1, ["Sample Cleric"]),
  spell("Sample Spark", 0, ["Sample Cleric"], "TST2"),
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
];
