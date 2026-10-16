import type { Character } from "../types/character.ts";
import type { Compendium } from "../services/compendium.ts";
import { formatCantripOptions, GIANT_POWER_CHOICE_ID, type ChoiceOwner } from "./choices/types.ts";
import { skills } from "./skills.ts";

/**
 * Class and subclass Rule Choices as data. Each row is one choice a class or subclass grants.
 *
 * Ids are persisted in saved characters and must never change. Adding a choice means adding a
 * row; the row's `source` gates it by active book, and its `owner` decides which characters are
 * offered it. A pointer row reads its options and pick count from the Integrated Catalog, through
 * its `locator`. A static row lists its options, or names a resolver that derives them from the
 * character or the Compendium.
 */

export const BARBARIAN_CLASS_SKILLS = [
  "Animal Handling",
  "Athletics",
  "Intimidation",
  "Nature",
  "Perception",
  "Survival",
] as const;

export function getUnchosenBarbarianSkills(
  character: Character,
  currentChoiceId: string
): string[] {
  // Build a temporary character without this specific choice's picks so current pick isn't filtered out
  const tempChar: Character = {
    ...character,
    ruleChoices: (character.ruleChoices || []).filter((rc) => rc.id !== currentChoiceId),
  };

  const evalSkills = skills(tempChar);
  const proficientFromOtherSources = new Set(
    evalSkills.filter((s) => s.isProficient).map((s) => s.name.toLowerCase())
  );

  const currentPicked = new Set(
    (character.ruleChoices?.find((rc) => rc.id === currentChoiceId)?.picked || []).map((p) =>
      p.toLowerCase()
    )
  );

  return BARBARIAN_CLASS_SKILLS.filter(
    (skill) =>
      currentPicked.has(skill.toLowerCase()) ||
      !proficientFromOtherSources.has(skill.toLowerCase())
  );
}

export const CIRCLE_OF_THE_LAND_BIOMES = [
  { name: "Arctic", description: "Hold Person, Spike Growth, Sleet Storm, Slow, Freedom of Movement, Ice Storm, Commune with Nature, Cone of Cold" },
  { name: "Coast", description: "Mirror Image, Misty Step, Water Breathing, Water Walk, Control Water, Freedom of Movement, Conjure Elemental, Scrying" },
  { name: "Desert", description: "Blur, Silence, Create Food and Water, Protection from Energy, Blight, Hallucinatory Terrain, Insect Plague, Wall of Stone" },
  { name: "Forest", description: "Barkskin, Spider Climb, Call Lightning, Plant Growth, Divination, Freedom of Movement, Commune with Nature, Tree Stride" },
  { name: "Grassland", description: "Invisibility, Pass without Trace, Daylight, Haste, Divination, Freedom of Movement, Dream, Insect Plague" },
  { name: "Mountain", description: "Spider Climb, Spike Growth, Lightning Bolt, Meld into Stone, Stone Shape, Stoneskin, Passwall, Wall of Stone" },
  { name: "Swamp", description: "Darkness, Melf's Acid Arrow, Water Walk, Stinking Cloud, Freedom of Movement, Locate Creature, Insect Plague, Scrying" },
  { name: "Underdark", description: "Spider Climb, Web, Gaseous Form, Stinking Cloud, Greater Invisibility, Stone Shape, Cloudkill, Insect Plague" },
];

export const DIVINE_SOUL_AFFINITIES = [
  { name: "Good", description: "Cure Wounds (Affinity spell)" },
  { name: "Evil", description: "Inflict Wounds (Affinity spell)" },
  { name: "Law", description: "Bless (Affinity spell)" },
  { name: "Chaos", description: "Bane (Affinity spell)" },
  { name: "Neutrality", description: "Protection from Evil and Good (Affinity spell)" },
];

export const GENIE_KINDS = [
  { name: "Dao", description: "Earth - Sanctuary, Spike Growth, Meld into Stone, Stone Shape, Wall of Stone" },
  { name: "Djinni", description: "Air - Thunderwave, Gust of Wind, Wind Wall, Greater Invisibility, Seeming" },
  { name: "Efreeti", description: "Fire - Burning Hands, Scorching Ray, Fireball, Fire Shield, Flame Strike" },
  { name: "Marid", description: "Water - Fog Cloud, Blur, Sleet Storm, Control Water, Cone of Cold" },
];

/** A printed option of a hand-written row. */
export interface SubclassChoiceOption {
  name: string;
  description: string;
}

/** Compendium- or state-derived options, named so the table stays data. */
export type OptionResolverName =
  | "druidCantrips"
  | "necromancerCantrips"
  | "wizardCantrips"
  | "unchosenBarbarianSkills";

export interface OptionResolverContext {
  character: Character;
  choiceId: string;
  activeBooks?: string[];
  compendium: Compendium;
}

const RESOLVERS: Record<OptionResolverName, (ctx: OptionResolverContext) => SubclassChoiceOption[]> = {
  druidCantrips: ({ compendium, activeBooks }) =>
    formatCantripOptions(
      compendium.for(activeBooks).spells().filter(
        (s) => s.level === 0 && s.classes?.some((cls) => cls.toLowerCase() === "druid")
      )
    ),
  necromancerCantrips: ({ compendium, activeBooks }) =>
    formatCantripOptions(
      compendium.for(activeBooks).spells().filter(
        (s) => s.level === 0 && s.school?.toLowerCase() === "necromancy"
      )
    ),
  wizardCantrips: ({ compendium, activeBooks }) =>
    formatCantripOptions(
      compendium.for(activeBooks).spells().filter(
        (s) => s.level === 0 && s.classes?.some((cls) => cls.toLowerCase() === "wizard")
      )
    ),
  unchosenBarbarianSkills: ({ character, choiceId }) =>
    getUnchosenBarbarianSkills(character, choiceId).map((s) => ({
      name: s,
      description: `Gain proficiency in ${s}`,
    })),
};

/**
 * Where a pointer row's options live in the Integrated Catalog. `feature` names a subclass feature
 * that carries `choices`, which supply the pick count. `optionRecords` names a featureType whose
 * option records are the options; records carry no pick count, so such a row says its own `choose`.
 */
export type OptionLocator =
  | { feature: { name: string; level: number } }
  | { optionRecords: { featureType: string } };

interface SubclassChoiceRowBase {
  /** Persisted identity. Never change it once shipped. */
  id: string;
  /** The book the choice is printed in. Gates the row against the active books. */
  source: string;
  /**
   * The class, and the subclass fragment when the row belongs to one. Absent subclass means any.
   * The fragment is matched inside the subclass name, ignoring case and spaces, so "Nature"
   * owns "Nature Domain" and "Divine Soul" owns "divinesoul" alike.
   */
  owner: { className: string; subclass?: string };
  traitName: string;
  /** Level at which the choice is offered. */
  level: number;
  /** Level from which the chosen option takes effect. */
  effectLevel: number;
  /** Offered only while the character has this optional feature. */
  requiresOptionalFeature?: string;
  /** Option names this row never offers, whatever the catalog holds. */
  excludeOptions?: string[];
}

/**
 * A row whose options come from the Integrated Catalog, through its `locator`. A feature locator
 * reads the feature's `choices`, and without that feature (or its `choices`) the row is not offered.
 * An option-records locator reads the records and needs `choose` on the row.
 */
export interface PointerChoiceRow extends SubclassChoiceRowBase {
  locator: OptionLocator;
  /** The pick count, for a row whose locator reads option records. */
  choose?: number;
}

/** A row whose options are written in the table. Ticket 08 removes this form. */
export interface StaticChoiceRow extends SubclassChoiceRowBase {
  choose: number;
  options: readonly SubclassChoiceOption[] | { resolver: OptionResolverName };
}

export type SubclassChoiceRow = PointerChoiceRow | StaticChoiceRow;

export function isPointerRow(row: SubclassChoiceRow): row is PointerChoiceRow {
  return "locator" in row;
}

const LAND = { className: "Druid", subclass: "Land" };

/** The Way of the Four Elements disciplines: the catalog's ED option records, unlocked by prerequisite. */
const ELEMENTAL_DISCIPLINE_RECORDS: OptionLocator = { optionRecords: { featureType: "ED" } };

/** The discipline a Four Elements Monk is granted rather than chooses. */
const GRANTED_DISCIPLINE = "Elemental Attunement";

export const SUBCLASS_CHOICE_ROWS: readonly SubclassChoiceRow[] = [
  {
    id: "PHB__Druid__Circle of the Land__Biome",
    source: "PHB",
    owner: LAND,
    traitName: "Circle of the Land: Biome",
    level: 2,
    effectLevel: 3,
    choose: 1,
    options: CIRCLE_OF_THE_LAND_BIOMES,
  },
  {
    id: "XGE__Sorcerer__Divine Soul__Affinity",
    source: "XGE",
    owner: { className: "Sorcerer", subclass: "Divine Soul" },
    traitName: "Divine Soul: Divine Affinity",
    level: 1,
    effectLevel: 1,
    choose: 1,
    options: DIVINE_SOUL_AFFINITIES,
  },
  {
    id: "TCE__Warlock__The Genie__Kind",
    source: "TCE",
    owner: { className: "Warlock", subclass: "Genie" },
    traitName: "The Genie: Genie Kind",
    level: 1,
    effectLevel: 1,
    choose: 1,
    options: GENIE_KINDS,
  },
  {
    id: "PHB__Cleric__Nature Domain__Acolyte of Nature",
    source: "PHB",
    owner: { className: "Cleric", subclass: "Nature" },
    traitName: "Acolyte of Nature Cantrip",
    level: 1,
    effectLevel: 1,
    choose: 1,
    options: { resolver: "druidCantrips" },
  },
  {
    id: "DMG__Cleric__Death Domain__Reaper",
    source: "DMG",
    owner: { className: "Cleric", subclass: "Death" },
    traitName: "Reaper Cantrip",
    level: 1,
    effectLevel: 1,
    choose: 1,
    options: { resolver: "necromancerCantrips" },
  },
  {
    id: "SCAG__Cleric__Arcana Domain__Arcane Initiate",
    source: "SCAG",
    owner: { className: "Cleric", subclass: "Arcana" },
    traitName: "Arcane Initiate Cantrips",
    level: 1,
    effectLevel: 1,
    choose: 2,
    options: { resolver: "wizardCantrips" },
  },
  {
    id: "PHB__Monk__Way of the Four Elements__Discipline 3",
    source: "PHB",
    owner: { className: "Monk", subclass: "Elements" },
    traitName: "Elemental Discipline (3rd Level)",
    level: 3,
    effectLevel: 3,
    locator: ELEMENTAL_DISCIPLINE_RECORDS,
    choose: 1,
    excludeOptions: [GRANTED_DISCIPLINE],
  },
  {
    id: "PHB__Monk__Way of the Four Elements__Discipline 6",
    source: "PHB",
    owner: { className: "Monk", subclass: "Elements" },
    traitName: "Elemental Discipline (6th Level)",
    level: 6,
    effectLevel: 6,
    locator: ELEMENTAL_DISCIPLINE_RECORDS,
    choose: 1,
    excludeOptions: [GRANTED_DISCIPLINE],
  },
  {
    id: "PHB__Monk__Way of the Four Elements__Discipline 11",
    source: "PHB",
    owner: { className: "Monk", subclass: "Elements" },
    traitName: "Elemental Discipline (11th Level)",
    level: 11,
    effectLevel: 11,
    locator: ELEMENTAL_DISCIPLINE_RECORDS,
    choose: 1,
    excludeOptions: [GRANTED_DISCIPLINE],
  },
  {
    id: "PHB__Monk__Way of the Four Elements__Discipline 17",
    source: "PHB",
    owner: { className: "Monk", subclass: "Elements" },
    traitName: "Elemental Discipline (17th Level)",
    level: 17,
    effectLevel: 17,
    locator: ELEMENTAL_DISCIPLINE_RECORDS,
    choose: 1,
    excludeOptions: [GRANTED_DISCIPLINE],
  },
  {
    id: "TCE__Barbarian__Primal Knowledge 3",
    source: "TCE",
    owner: { className: "Barbarian" },
    traitName: "Primal Knowledge (3rd Level)",
    level: 3,
    effectLevel: 3,
    choose: 1,
    options: { resolver: "unchosenBarbarianSkills" },
    requiresOptionalFeature: "Primal Knowledge",
  },
  {
    id: "TCE__Barbarian__Primal Knowledge 10",
    source: "TCE",
    owner: { className: "Barbarian" },
    traitName: "Primal Knowledge (10th Level)",
    level: 10,
    effectLevel: 10,
    choose: 1,
    options: { resolver: "unchosenBarbarianSkills" },
    requiresOptionalFeature: "Primal Knowledge",
  },
  {
    id: GIANT_POWER_CHOICE_ID,
    source: "BGG",
    owner: { className: "Barbarian", subclass: "Giant" },
    traitName: "Giant Power Cantrip",
    level: 3,
    effectLevel: 3,
    choose: 1,
    options: [
      {
        name: "Druidcraft",
        description: "Whisper with spirits of nature to create minor botanical effects, sensory phenomena, or predict weather.",
      },
      {
        name: "Thaumaturgy",
        description: "Manifest minor wonders and supernatural phenomena, booming voice, flickering flames, or trembling ground.",
      },
    ],
  },
  {
    id: "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3",
    source: "PHB",
    owner: { className: "Barbarian", subclass: "Totem" },
    traitName: "Totem Spirit (3rd Level)",
    level: 3,
    effectLevel: 3,
    locator: { feature: { name: "Totem Spirit", level: 3 } },
  },
  {
    id: "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6",
    source: "PHB",
    owner: { className: "Barbarian", subclass: "Totem" },
    traitName: "Aspect of the Beast (6th Level)",
    level: 6,
    effectLevel: 6,
    locator: { feature: { name: "Aspect of the Beast", level: 6 } },
  },
  {
    id: "PHB__Barbarian__Path of the Totem Warrior__Totemic Attunement 14",
    source: "PHB",
    owner: { className: "Barbarian", subclass: "Totem" },
    traitName: "Totemic Attunement (14th Level)",
    level: 14,
    effectLevel: 14,
    locator: { feature: { name: "Totemic Attunement", level: 14 } },
  },
];

const ROW_OWNERS = new Map(SUBCLASS_CHOICE_ROWS.map((row) => [row.id, row.owner] as const));

/** The owner of a table row, looked up by its frozen id. Undefined for ids the table does not hold. */
export function tableOwnerOf(id: string): ChoiceOwner | undefined {
  return ROW_OWNERS.get(id);
}

/** Whether a subclass name carries the row's subclass fragment. Case- and whitespace-insensitive. */
function subclassFragmentMatches(subclassName: string, fragment: string): boolean {
  const compact = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  return compact(subclassName).includes(compact(fragment));
}

/** Whether a row is owned by this recorded class (and subclass fragment, when the row names one). */
export function rowOwnedBy(row: SubclassChoiceRow, className: string, subclassName: string): boolean {
  if (row.owner.className.toLowerCase() !== className.toLowerCase()) return false;
  if (!row.owner.subclass) return true;
  return subclassFragmentMatches(subclassName, row.owner.subclass);
}

/** Whether the optional feature is enabled on the character (replacement or legacy flag). */
export function hasOptionalFeature(character: Character, name: string): boolean {
  const legacy = character as Character & { optionalFeatures?: Record<string, boolean> };
  return Boolean(
    character.optionalFeatureReplacements?.[name] ?? legacy.optionalFeatures?.[name]
  );
}

/** The options a hand-written row offers for this character. */
export function resolveRowOptions(
  row: StaticChoiceRow,
  ctx: OptionResolverContext
): { name: string; description: string }[] {
  if ("resolver" in row.options) {
    return RESOLVERS[row.options.resolver](ctx).map(({ name, description }) => ({ name, description }));
  }
  return row.options.map(({ name, description }) => ({ name, description }));
}

/** The pick count and offered options a pointer row reads from the Compendium. */
export interface PointerRowOffer {
  choose: number;
  options: { name: string; description: string }[];
}

/**
 * Reads a pointer row's offer from the Compendium. A feature locator takes the pick count and the
 * options from the feature's `choices`; it returns undefined when no feature of the owner's class
 * and subclass, with that name and level, carries `choices`. An option-records locator reads the
 * records instead (see `readOptionRecordsRow`). Either way an undefined offer means the row is not
 * offered and saved picks stay.
 *
 * The catalog is read unscoped: the row's own `source` and each option's `source` gate the offer
 * by active book. An option printed in the row's own book is always offered; one printed in another
 * book is offered only while that book is active.
 */
/** The level a discipline-style option record unlocks at when it names no prerequisite. */
const UNPREREQUISITED_RECORD_LEVEL = 3;

/**
 * The level an option record unlocks at, read from its structured prerequisite ("17th-level Monk"
 * gives 17). A record with no prerequisite unlocks at 3rd level. Undefined when the prerequisite
 * names no level, so the record is never offered.
 */
export function recordUnlockLevel(record: { prerequisite: string | null }): number | undefined {
  if (!record.prerequisite) return UNPREREQUISITED_RECORD_LEVEL;
  const match = /^(\d+)(?:st|nd|rd|th)-level\b/i.exec(record.prerequisite.trim());
  return match ? Number(match[1]) : undefined;
}

/**
 * Reads an option-records row: every catalog record of the featureType that the row's level has
 * unlocked, cumulatively. The row's options are not gated by book: the records are the Monk's own
 * text whatever books are active. Undefined when the catalog holds no such record.
 */
function readOptionRecordsRow(
  row: PointerChoiceRow,
  featureType: string,
  compendium: Compendium
): PointerRowOffer | undefined {
  if (row.choose === undefined) return undefined;
  const records = compendium
    .for()
    .optionsAndFeatures()
    .filter((r) => r.featureType?.includes(featureType));
  if (records.length === 0) return undefined;
  return {
    choose: row.choose,
    options: records
      .filter((r) => !row.excludeOptions?.includes(r.name))
      .filter((r) => {
        const unlock = recordUnlockLevel(r);
        return unlock !== undefined && unlock <= row.level;
      })
      .map(({ name, description }) => ({ name, description })),
  };
}

export function readPointerRow(
  row: PointerChoiceRow,
  compendium: Compendium,
  activeBooks?: readonly string[]
): PointerRowOffer | undefined {
  if ("optionRecords" in row.locator) {
    return readOptionRecordsRow(row, row.locator.optionRecords.featureType, compendium);
  }
  const { name, level } = row.locator.feature;
  const active = activeBooks?.map((b) => b.toUpperCase());
  const rowBook = row.source.toUpperCase();

  for (const cls of compendium.for().classes()) {
    if (cls.name.toLowerCase() !== row.owner.className.toLowerCase()) continue;
    for (const sub of cls.subclasses) {
      if (row.owner.subclass && !subclassFragmentMatches(sub.name, row.owner.subclass)) continue;
      const options = sub.features.find((f) => f.name === name && f.level === level)?.choices;
      if (!options?.options) continue;
      return {
        choose: options.pick,
        options: options.options
          .filter((o) => !row.excludeOptions?.includes(o.name))
          .filter((o) => {
            const book = o.source?.toUpperCase();
            return !book || book === rowBook || !active || active.includes(book);
          })
          .map(({ name, description }) => ({ name, description })),
      };
    }
  }
  return undefined;
}
