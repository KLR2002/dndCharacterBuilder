import type { FeatData, RaceData, SpellData } from "../src/types/dnd5e.ts";

/**
 * Invented feats, races and spells for the prepared spell grant tests. Every name and sentence is made up on purpose. The
 * grants use the scraper's shape: a `prepared` group keyed by `_` (no level gate), a character level, or `sN` (a spell slot
 * level), with a `choose` object as a pick the player makes.
 */

const spell = (name: string, level: number, classes: string[], school: string): SpellData => ({
  name,
  source: "TST",
  level,
  school,
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

/** Spells the prepared grants name: a first-level and a second-level mage spell, and a first-level cleric spell. */
export const preparedGrantSpells = (): SpellData[] => [
  spell("Sample Bulwark", 1, ["Sample Mage"], "Abjuration"),
  spell("Sample Thread", 2, ["Sample Mage"], "Divination"),
  spell("Sample Fetch", 1, ["Sample Mage"], "Conjuration"),
  spell("Sample Lure", 1, ["Sample Mage"], "Enchantment"),
  spell("Sample Anchor", 1, ["Sample Cleric"], "Abjuration"),
  spell("Sample Vigil", 3, ["Sample Mage"], "Evocation"),
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
 * Invented feats with prepared groups. A plain group names no ability and gives no uses, so its spells are Always-Prepared
 * Spells: Sample Keeper Mark, Sample Slot Adept, Sample Pick Feat and Sample Boon's Sample Mark B. A group that names an ability
 * or gives uses is Innate Magic (ADR 0017 amendment): Sample Ward Mark names a fixed ability, Sample Ember Mark a chosen one,
 * Sample Familiar Mark the one its feat's increase raised, and Sample Cloud Mark gives daily casts with no ability. Sample
 * Boon's Sample Mark A is a chosen-ability list.
 */
export const preparedGrantFeats = (): FeatData[] => [
  feat("Sample Keeper Mark", {
    additionalSpells: [{ prepared: { _: ["sample bulwark"] } }],
  }),
  feat("Sample Ward Mark", {
    additionalSpells: [{ ability: "wis", prepared: { _: ["sample bulwark"], "3": ["sample thread"] } }],
  }),
  feat("Sample Ember Mark", {
    additionalSpells: [{ ability: { choose: ["int", "wis", "cha"] }, prepared: { _: { daily: { "1": ["sample bulwark"] } } } }],
  }),
  feat("Sample Familiar Mark", {
    additionalSpells: [{ ability: "inherit", prepared: { _: { daily: { "1": ["sample fetch"] } } } }],
  }),
  feat("Sample Cloud Mark", {
    additionalSpells: [{ prepared: { _: { daily: { "1": ["sample lure"] } } } }],
  }),
  feat("Sample Slot Adept", {
    additionalSpells: [{ prepared: { s1: ["sample fetch"], s2: ["sample thread"] } }],
  }),
  feat("Sample Third Adept", {
    additionalSpells: [{ prepared: { s3: ["sample vigil"] } }],
  }),
  feat("Sample Pick Feat", {
    additionalSpells: [{ prepared: { _: [{ choose: "level=1|class=Sample Mage" }] } }],
  }),
  feat("Sample Boon", {
    additionalSpells: [
      {
        name: "Sample Mark A",
        ability: { choose: ["int", "wis", "cha"] },
        prepared: { _: { daily: { "1": ["sample bulwark"] } } },
      },
      { name: "Sample Mark B", prepared: { _: ["sample fetch"] } },
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

/**
 * Invented races with prepared groups. Sample Hexed chooses its casting ability and gives its spell once per Long Rest
 * (Innate Magic). Sample Late Blood's plain group gives its spell from character level 3 and names no ability.
 */
export const preparedGrantRaces = (): RaceData[] => [
  race("Sample Hexed", {
    additionalSpells: [{ ability: { choose: ["int", "wis", "cha"] }, prepared: { _: { daily: { "1e": ["sample fetch"] } } } }],
  }),
  race("Sample Late Blood", {
    additionalSpells: [{ prepared: { "3": ["sample anchor"] } }],
  }),
];
