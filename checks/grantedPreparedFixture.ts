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
 * Invented feats with prepared groups. Sample Keeper Mark is prepared-only and still names an ability, which a prepared
 * group ignores. Sample Ward Mark gives one spell at once and one from character level 3. Sample Slot Adept gives spells by
 * spell slot level. Sample Pick Feat's prepared spell is a pick from the mage list. Sample Boon offers two named lists.
 */
export const preparedGrantFeats = (): FeatData[] => [
  feat("Sample Keeper Mark", {
    additionalSpells: [{ ability: { choose: ["int", "wis", "cha"] }, prepared: { _: ["sample bulwark"] } }],
  }),
  feat("Sample Ward Mark", {
    additionalSpells: [{ ability: "wis", prepared: { _: ["sample bulwark"], "3": ["sample thread"] } }],
  }),
  feat("Sample Slot Adept", {
    additionalSpells: [{ prepared: { s1: ["sample fetch"], s2: ["sample thread"] } }],
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
 * Invented races with prepared groups. Sample Hexed chooses its casting ability, which a prepared group ignores. Sample Late
 * Blood gives its spell from character level 3.
 */
export const preparedGrantRaces = (): RaceData[] => [
  race("Sample Hexed", {
    additionalSpells: [{ ability: { choose: ["int", "wis", "cha"] }, prepared: { _: { daily: { "1e": ["sample fetch"] } } } }],
  }),
  race("Sample Late Blood", {
    additionalSpells: [{ ability: "cha", prepared: { "3": ["sample anchor"] } }],
  }),
];
