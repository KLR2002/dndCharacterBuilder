import { REQUIRED_CATALOG_FORMAT, type CompendiumCollections } from "../src/services/compendiumStorage.ts";
import type {
  ClassData,
  ClassFeatureData,
  FeatureChoice,
  OptionFeatureData,
  SpellData,
  SubclassData,
} from "../src/types/dnd5e.ts";

/**
 * An Integrated Catalog bundle for tests, built with invented placeholder text. The structure is
 * the real scraped structure: a class whose subclass features carry `choices` for the option
 * features they name, and subclasses whose `additionalSpells` lift to a `spellChoice`. Later tickets
 * extend this file, so keep additions additive.
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

// Spell-choice subclasses. Option names are the real ones the Rule Choices offer; the spells are
// invented. Each subclass carries its raw `additionalSpells` and the `spellChoice` the scraper lifts
// from them, so a test can check the two agree.

/** Two invented spell names an option grants, named after the option. */
const grantedSpells = (option: string): string[] => [
  `placeholder ${option.toLowerCase()} one`,
  `placeholder ${option.toLowerCase()} two`,
];

const titled = (text: string): string =>
  text.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

const grantDescription = (option: string): string => grantedSpells(option).map(titled).join(", ");

const BIOMES = ["Arctic", "Coast", "Desert", "Forest", "Grassland", "Mountain", "Swamp", "Underdark"];
const AFFINITIES = ["Good", "Evil", "Law", "Chaos", "Neutrality"];
const GENIE_KINDS = ["Dao", "Djinni", "Efreeti", "Marid"];
const GIANT_CANTRIPS = ["Druidcraft", "Thaumaturgy"];

const landSubclass: SubclassData = {
  name: "Circle of the Land",
  shortName: "Land",
  source: "PHB",
  className: "Druid",
  classSource: "PHB",
  features: [],
  additionalSpells: BIOMES.map((name) => ({
    name,
    known: { "1": { _: [{ choose: "level=0|class=Druid" }] } },
    prepared: { "3": grantedSpells(name) },
  })),
  spellChoice: {
    pick: 1,
    options: BIOMES.map((name) => ({ name, description: grantDescription(name) })),
  },
  description: "Placeholder description for the Circle of the Land subclass.",
};

const divineSoulSubclass: SubclassData = {
  name: "Divine Soul",
  shortName: "Divine Soul",
  source: "XGE",
  className: "Sorcerer",
  classSource: "PHB",
  features: [],
  additionalSpells: AFFINITIES.map((name) => ({
    name,
    known: { "1": [grantedSpells(name)[0]] },
    expanded: { "1": [{ all: "level=0|class=Cleric" }] },
  })),
  spellChoice: {
    pick: 1,
    options: AFFINITIES.map((name) => ({ name, description: titled(grantedSpells(name)[0]) })),
  },
  description: "Placeholder description for the Divine Soul subclass.",
};

const genieSubclass: SubclassData = {
  name: "The Genie",
  shortName: "Genie",
  source: "TCE",
  className: "Warlock",
  classSource: "PHB",
  features: [],
  additionalSpells: GENIE_KINDS.map((name) => ({
    name,
    expanded: { "9": ["placeholder wish"], s1: grantedSpells(name) },
  })),
  spellChoice: {
    pick: 1,
    options: GENIE_KINDS.map((name) => ({
      name,
      description: `Placeholder Wish, ${grantDescription(name)}`,
    })),
  },
  description: "Placeholder description for the Genie subclass.",
};

const giantSubclass: SubclassData = {
  name: "Path of the Giant",
  shortName: "Giant",
  source: "BGG",
  className: "Barbarian",
  classSource: "PHB",
  features: [],
  additionalSpells: GIANT_CANTRIPS.map((name) => ({
    innate: { "3": [name.toLowerCase()] },
  })),
  spellChoice: {
    pick: 1,
    options: GIANT_CANTRIPS.map((name) => ({ name, description: "" })),
  },
  description: "Placeholder description for the Giant subclass.",
};

// Cantrip-list subclasses. Each `known` entry is the raw `choose` filter 5e.tools gives, and the
// spell choice is what the scraper lifts from it. The domain spells in `prepared` are invented;
// the Arcana's prepared filters prove that only `known` filters are a cantrip choice.

const natureDomain: SubclassData = {
  name: "Nature Domain",
  shortName: "Nature",
  source: "PHB",
  className: "Cleric",
  classSource: "PHB",
  features: [],
  additionalSpells: [
    {
      known: { "1": { _: [{ choose: "level=0|class=Druid" }] } },
      prepared: { "1": ["placeholder domain spell one"], "3": ["placeholder domain spell two"] },
    },
  ],
  spellChoice: { pick: 1, from: { filter: "level=0|class=Druid" } },
  description: "Placeholder description for the Nature Domain subclass.",
};

const deathDomain: SubclassData = {
  name: "Death Domain",
  shortName: "Death",
  source: "DMG",
  className: "Cleric",
  classSource: "PHB",
  features: [],
  additionalSpells: [
    {
      known: { "1": { _: [{ choose: "level=0|school=N", count: 1 }] } },
      prepared: { "1": ["placeholder domain spell three"] },
    },
  ],
  spellChoice: { pick: 1, from: { filter: "level=0|school=N", count: 1 } },
  description: "Placeholder description for the Death Domain subclass.",
};

const arcanaDomain: SubclassData = {
  name: "Arcana Domain",
  shortName: "Arcana",
  source: "SCAG",
  className: "Cleric",
  classSource: "PHB",
  features: [],
  additionalSpells: [
    {
      known: { "1": { _: [{ choose: "level=0|class=Wizard", count: 2 }] } },
      prepared: {
        "1": ["placeholder domain spell four"],
        "17": [{ choose: "level=6|class=Wizard" }, { choose: "level=7|class=Wizard" }],
      },
    },
  ],
  spellChoice: { pick: 2, from: { filter: "level=0|class=Wizard", count: 2 } },
  description: "Placeholder description for the Arcana Domain subclass.",
};

const placeholderSpell = (
  name: string,
  fields: Pick<SpellData, "level" | "school" | "classes" | "source">,
): SpellData => ({
  name,
  description: `Placeholder text for ${name}.`,
  castingTime: "1 action",
  range: "Self",
  components: { verbal: true, somatic: false, material: false },
  componentsString: "V",
  duration: "Instantaneous",
  concentration: false,
  ritual: false,
  subclasses: [],
  damageTypes: [],
  savingThrows: [],
  higherLevels: null,
  ...fields,
});

/**
 * The cantrips the three cantrip-list rows offer in the characterization baseline. The names are the
 * real cantrip names; level, school, class list and book are the structure the filters read. The
 * text is placeholder.
 */
const BASELINE_CANTRIPS: [name: string, school: string, classes: string[], source: string][] = [
  ["Druidcraft", "Transmutation", ["Druid"], "PHB"],
  ["Guidance", "Divination", ["Cleric", "Druid"], "PHB"],
  ["Mending", "Transmutation", ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"], "PHB"],
  ["Poison Spray", "Conjuration", ["Druid", "Sorcerer", "Warlock", "Wizard"], "PHB"],
  ["Produce Flame", "Conjuration", ["Druid"], "PHB"],
  ["Resistance", "Abjuration", ["Cleric", "Druid"], "PHB"],
  ["Shillelagh", "Transmutation", ["Druid"], "PHB"],
  ["Thorn Whip", "Transmutation", ["Druid"], "PHB"],
  ["Chill Touch", "Necromancy", ["Sorcerer", "Warlock", "Wizard"], "PHB"],
  ["Spare the Dying", "Necromancy", ["Cleric"], "PHB"],
  ["Acid Splash", "Conjuration", ["Sorcerer", "Wizard"], "PHB"],
  ["Blade Ward", "Abjuration", ["Bard", "Sorcerer", "Warlock", "Wizard"], "PHB"],
  ["Dancing Lights", "Evocation", ["Bard", "Sorcerer", "Wizard"], "PHB"],
  ["Fire Bolt", "Evocation", ["Sorcerer", "Wizard"], "PHB"],
  ["Friends", "Enchantment", ["Bard", "Sorcerer", "Warlock", "Wizard"], "PHB"],
  ["Light", "Evocation", ["Bard", "Cleric", "Sorcerer", "Wizard"], "PHB"],
  ["Mage Hand", "Conjuration", ["Bard", "Sorcerer", "Warlock", "Wizard"], "PHB"],
  ["Message", "Transmutation", ["Bard", "Sorcerer", "Wizard"], "PHB"],
  ["Minor Illusion", "Illusion", ["Bard", "Sorcerer", "Warlock", "Wizard"], "PHB"],
  ["Prestidigitation", "Transmutation", ["Bard", "Sorcerer", "Warlock", "Wizard"], "PHB"],
  ["Ray of Frost", "Evocation", ["Sorcerer", "Wizard"], "PHB"],
  ["Shocking Grasp", "Evocation", ["Sorcerer", "Wizard"], "PHB"],
  ["True Strike", "Divination", ["Bard", "Sorcerer", "Warlock", "Wizard"], "PHB"],
  ["Booming Blade", "Evocation", ["Artificer", "Sorcerer", "Warlock", "Wizard"], "TCE"],
  ["Green-Flame Blade", "Evocation", ["Artificer", "Sorcerer", "Warlock", "Wizard"], "TCE"],
  ["Lightning Lure", "Evocation", ["Artificer", "Sorcerer", "Warlock", "Wizard"], "TCE"],
  ["Mind Sliver", "Enchantment", ["Sorcerer", "Warlock", "Wizard"], "TCE"],
  ["Sword Burst", "Conjuration", ["Artificer", "Sorcerer", "Warlock", "Wizard"], "TCE"],
  ["Control Flames", "Transmutation", ["Druid", "Sorcerer", "Wizard"], "XGE"],
  ["Create Bonfire", "Conjuration", ["Artificer", "Druid", "Sorcerer", "Warlock", "Wizard"], "XGE"],
  ["Frostbite", "Evocation", ["Artificer", "Druid", "Sorcerer", "Warlock", "Wizard"], "XGE"],
  ["Gust", "Transmutation", ["Druid", "Sorcerer", "Wizard"], "XGE"],
  ["Infestation", "Conjuration", ["Druid", "Sorcerer", "Warlock", "Wizard"], "XGE"],
  ["Magic Stone", "Transmutation", ["Artificer", "Druid", "Warlock"], "XGE"],
  ["Mold Earth", "Transmutation", ["Druid", "Sorcerer", "Wizard"], "XGE"],
  ["Primal Savagery", "Transmutation", ["Druid"], "XGE"],
  ["Shape Water", "Transmutation", ["Druid", "Sorcerer", "Wizard"], "XGE"],
  ["Thunderclap", "Evocation", ["Artificer", "Bard", "Druid", "Sorcerer", "Warlock", "Wizard"], "XGE"],
  ["Toll the Dead", "Necromancy", ["Cleric", "Warlock", "Wizard"], "XGE"],
  ["Sapping Sting", "Necromancy", [], "EGW"],
];

/** The baseline's cantrip-list options as catalog spell records. */
export const baselineCantripSpells = (): SpellData[] =>
  BASELINE_CANTRIPS.map(([name, school, classes, source]) =>
    placeholderSpell(name, { level: 0, school, classes, source }),
  );

/**
 * Placeholder spells the cantrip-list rows filter. Level, classes, school and book are the
 * structure the filters read; the names and text are invented.
 */
export const cantripCatalogSpells = (): SpellData[] => {
  return [
    placeholderSpell("Placeholder Druid Cantrip", { level: 0, school: "Conjuration", classes: ["Druid"], source: "PHB" }),
    placeholderSpell("Placeholder Druid Cantrip Expanded", { level: 0, school: "Conjuration", classes: ["Druid"], source: "XGE" }),
    placeholderSpell("Placeholder Druid Spell", { level: 1, school: "Conjuration", classes: ["Druid"], source: "PHB" }),
    placeholderSpell("Placeholder Wizard Cantrip", { level: 0, school: "Evocation", classes: ["Wizard"], source: "PHB" }),
    placeholderSpell("Placeholder Wizard Cantrip Expanded", { level: 0, school: "Evocation", classes: ["Wizard"], source: "XGE" }),
    placeholderSpell("Placeholder Necromancy Cantrip", { level: 0, school: "Necromancy", classes: ["Wizard"], source: "PHB" }),
    placeholderSpell("Placeholder Necromancy Cantrip Cleric", { level: 0, school: "Necromancy", classes: ["Cleric"], source: "PHB" }),
    placeholderSpell("Placeholder Necromancy Spell", { level: 1, school: "Necromancy", classes: ["Wizard"], source: "PHB" }),
  ];
};

const classWith =(name: string, subclasses: SubclassData[], overrides: Partial<ClassData> = {}): ClassData => ({
  name,
  source: "PHB",
  hitDie: "1d8",
  primaryAbility: [],
  savingThrows: [],
  armorProficiencies: [],
  weaponProficiencies: [],
  toolProficiencies: [],
  skillProficiencies: { choose: 2, from: [] },
  features: [],
  subclasses,
  description: `Placeholder description for the ${name} class.`,
  ...overrides,
});

/** The fixture's classes. Barbarian comes first, with the Totem Warrior first among its subclasses. */
export const choiceCatalogClasses = (): ClassData[] => [
  classWith(
    "Barbarian",
    [totemWarrior, giantSubclass],
    {
      hitDie: "1d12",
      primaryAbility: ["Strength"],
      savingThrows: ["Strength", "Constitution"],
      skillProficiencies: {
        choose: 2,
        from: ["animal handling", "athletics", "intimidation", "nature", "perception", "survival"],
      },
    },
  ),
  classWith("Druid", [landSubclass]),
  classWith("Sorcerer", [divineSoulSubclass]),
  classWith("Warlock", [genieSubclass]),
  classWith("Cleric", [natureDomain, deathDomain, arcanaDomain]),
];

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

/** A current-format Compendium bundle over the fixture catalog. Overrides replace whole collections. */
export function choiceCatalogBundle(overrides: Partial<CompendiumCollections> = {}): CompendiumCollections {
  return {
    hasIntegratedCatalog: true,
    catalogFormat: REQUIRED_CATALOG_FORMAT,
    races: [],
    classes: choiceCatalogClasses(),
    feats: [],
    backgrounds: [],
    items: [],
    spells: baselineCantripSpells(),
    beasts: [],
    conditions: [],
    optionsAndFeatures: [...DISCIPLINE_FIXTURE_RECORDS],
    books: [],
    ...overrides,
  };
}
