import type { BackgroundData, ClassData, SpellData } from "../src/types/dnd5e.ts";

/**
 * Invented classes, spells and backgrounds for the background spell list tests. Every name and sentence is made up on
 * purpose: no real 5e prose and no real rule text in fixtures. A background's expanded lists use the scraper's shape:
 * keyed by spell level (s0 is cantrips), with normalised spell names.
 */

const spell = (name: string, level: number, classes: string[]): SpellData => ({
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
  classes,
  subclasses: [],
  damageTypes: [],
  savingThrows: [],
  description: "Placeholder description for the spell.",
  higherLevels: null,
});

/** A cantrip and a 1st and a 3rd level spell that only the background adds to a list, one spell on no list, and a native spell. */
export const backgroundSpellSpells = (): SpellData[] => [
  spell("Sample Chime", 0, []),
  spell("Sample Ward", 1, []),
  spell("Sample Spirit", 3, []),
  spell("Sample Warding", 1, []),
  spell("Sample Ember", 0, ["Sample Mage"]),
];

/** An invented full caster, an invented pact caster and an invented class with no spellcasting. */
export const backgroundSpellClasses = (): ClassData[] => [
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
  {
    name: "Sample Pact",
    source: "TST",
    hitDie: "1d8",
    primaryAbility: [],
    savingThrows: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    toolProficiencies: [],
    skillProficiencies: { choose: 0, from: [] },
    spellcasting: { ability: "cha", progression: "pact" },
    features: [],
    subclasses: [],
    description: "Placeholder description for the class.",
  },
  {
    name: "Sample Warrior",
    source: "TST",
    hitDie: "1d10",
    primaryAbility: [],
    savingThrows: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    toolProficiencies: [],
    skillProficiencies: { choose: 0, from: [] },
    features: [],
    subclasses: [],
    description: "Placeholder description for the class.",
  },
];

const background = (name: string, extra: Partial<BackgroundData>): BackgroundData => ({
  name,
  source: "TST",
  skillProficiencies: [],
  toolProficiencies: [],
  languages: [],
  startingEquipment: [],
  feature: null,
  characteristics: {},
  description: "Placeholder description for the background.",
  ...extra,
});

/**
 * Sample Scholar adds a cantrip, a 1st level and a 3rd level spell to the lists of its spellcasting classes. Sample Scribe adds
 * a cantrip that the mage's own list gives too. Sample Idler adds none.
 */
export const backgroundSpellBackgrounds = (): BackgroundData[] => [
  background("Sample Scholar", {
    additionalSpells: [{ expanded: { s0: ["sample chime"], s1: ["sample ward"], s3: ["sample spirit"] } }],
  }),
  background("Sample Scribe", {
    additionalSpells: [{ expanded: { s0: ["sample ember"] } }],
  }),
  background("Sample Idler", {}),
];
