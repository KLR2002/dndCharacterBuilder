import type { Character } from "../types/character.ts";
import type { Compendium } from "../services/compendium.ts";
import { formatCantripOptions, GIANT_POWER_CHOICE_ID, type ChoiceOwner } from "./choices/types.ts";
import { skills } from "./skills.ts";
import { liftSpellChoice } from "../../dnd5eToolsScrap/src/parser/spell-choice.ts";
import type { FeatureChoice, SubclassData } from "../types/dnd5e.ts";

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

export const ELEMENTAL_DISCIPLINES_LVL3 = [
  { name: "Fangs of the Fire Snake", description: "Spend 1 Ki point to extend unarmed reach by 10 ft with fire damage; +1d10 fire per extra Ki spent." },
  { name: "Fist of Four Thunders", description: "Spend 2 Ki points to cast Thunderwave." },
  { name: "Fist of Unbroken Air", description: "Spend 2 Ki points to blast air: target makes Str save or takes 3d10 bludgeoning damage and pushed 20 ft." },
  { name: "Rush of the Gale Spirits", description: "Spend 2 Ki points to cast Gust of Wind." },
  { name: "Shape the Flowing River", description: "Spend 1 Ki point to shape ice and water within 120 ft." },
  { name: "Sweeping Cinder Strike", description: "Spend 2 Ki points to cast Burning Hands." },
  { name: "Water Whip", description: "Spend 2 Ki points to create a water whip: Dex save or 3d10 bludgeoning and knocked prone or pulled 25 ft." },
];

export const ELEMENTAL_DISCIPLINES_LVL6 = [
  { name: "Clench of the North Wind", description: "Spend 3 Ki points to cast Hold Person." },
  { name: "Gong of the Summit", description: "Spend 3 Ki points to cast Shatter." },
];

export const ELEMENTAL_DISCIPLINES_LVL11 = [
  { name: "Flames of the Phoenix", description: "Spend 4 Ki points to cast Fireball." },
  { name: "Mist Stance", description: "Spend 4 Ki points to cast Gaseous Form on yourself." },
  { name: "Ride the Wind", description: "Spend 4 Ki points to cast Fly on yourself." },
];

export const ELEMENTAL_DISCIPLINES_LVL17 = [
  { name: "Breath of Winter", description: "Spend 6 Ki points to cast Cone of Cold." },
  { name: "Eternal Mountain Defense", description: "Spend 5 Ki points to cast Stoneskin on yourself." },
  { name: "River of Hungry Flame", description: "Spend 5 Ki points to cast Wall of Fire." },
  { name: "Wave of Rolling Earth", description: "Spend 6 Ki points to cast Wall of Stone." },
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
 * Where a pointer row's options live in the Integrated Catalog: a feature's `choices`, or the
 * subclass's spell choice (lifted from its additional spells when the catalog holds none).
 */
export type OptionLocator = { feature: { name: string; level: number } } | { spellChoice: true };

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
 * A row whose options and pick count come from the Integrated Catalog: the feature at `locator`
 * carries `choices`. Without that feature (or its `choices`) the row is not offered.
 */
export interface PointerChoiceRow extends SubclassChoiceRowBase {
  locator: OptionLocator;
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

export const SUBCLASS_CHOICE_ROWS: readonly SubclassChoiceRow[] = [
  {
    id: "PHB__Druid__Circle of the Land__Biome",
    source: "PHB",
    owner: LAND,
    traitName: "Circle of the Land: Biome",
    level: 2,
    effectLevel: 3,
    locator: { spellChoice: true },
  },
  {
    id: "XGE__Sorcerer__Divine Soul__Affinity",
    source: "XGE",
    owner: { className: "Sorcerer", subclass: "Divine Soul" },
    traitName: "Divine Soul: Divine Affinity",
    level: 1,
    effectLevel: 1,
    locator: { spellChoice: true },
  },
  {
    id: "TCE__Warlock__The Genie__Kind",
    source: "TCE",
    owner: { className: "Warlock", subclass: "Genie" },
    traitName: "The Genie: Genie Kind",
    level: 1,
    effectLevel: 1,
    locator: { spellChoice: true },
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
    choose: 1,
    options: ELEMENTAL_DISCIPLINES_LVL3,
  },
  {
    id: "PHB__Monk__Way of the Four Elements__Discipline 6",
    source: "PHB",
    owner: { className: "Monk", subclass: "Elements" },
    traitName: "Elemental Discipline (6th Level)",
    level: 6,
    effectLevel: 6,
    choose: 1,
    options: [...ELEMENTAL_DISCIPLINES_LVL3, ...ELEMENTAL_DISCIPLINES_LVL6],
  },
  {
    id: "PHB__Monk__Way of the Four Elements__Discipline 11",
    source: "PHB",
    owner: { className: "Monk", subclass: "Elements" },
    traitName: "Elemental Discipline (11th Level)",
    level: 11,
    effectLevel: 11,
    choose: 1,
    options: [...ELEMENTAL_DISCIPLINES_LVL3, ...ELEMENTAL_DISCIPLINES_LVL6, ...ELEMENTAL_DISCIPLINES_LVL11],
  },
  {
    id: "PHB__Monk__Way of the Four Elements__Discipline 17",
    source: "PHB",
    owner: { className: "Monk", subclass: "Elements" },
    traitName: "Elemental Discipline (17th Level)",
    level: 17,
    effectLevel: 17,
    choose: 1,
    options: [
      ...ELEMENTAL_DISCIPLINES_LVL3,
      ...ELEMENTAL_DISCIPLINES_LVL6,
      ...ELEMENTAL_DISCIPLINES_LVL11,
      ...ELEMENTAL_DISCIPLINES_LVL17,
    ],
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
    locator: { spellChoice: true },
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
 * Reads a pointer row's offer from the Compendium. The feature at the row's locator supplies the
 * pick count and the options. Returns undefined when no feature of the owner's class and subclass,
 * with that name and level, carries `choices`: the row is then not offered and saved picks stay.
 * A feature row is also not offered from a stale catalog.
 *
 * The catalog is read unscoped: the row's own `source` and each option's `source` gate the offer
 * by active book. An option printed in the row's own book is always offered; one printed in another
 * book is offered only while that book is active.
 */
export function readPointerRow(
  row: PointerChoiceRow,
  compendium: Compendium,
  activeBooks?: readonly string[]
): PointerRowOffer | undefined {
  // A stale catalog's feature choices are hidden until re-sync; spell-choice and option-record rows stay, as an older catalog still holds what they derive from.
  if ("feature" in row.locator && compendium.stale) return undefined;
  const active = activeBooks?.map((b) => b.toUpperCase());
  const rowBook = row.source.toUpperCase();

  for (const cls of compendium.for().classes()) {
    if (cls.name.toLowerCase() !== row.owner.className.toLowerCase()) continue;
    for (const sub of cls.subclasses) {
      if (row.owner.subclass && !subclassFragmentMatches(sub.name, row.owner.subclass)) continue;
      const options = choicesAt(row.locator, sub);
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

/**
 * The choice a locator names on a subclass. A spell choice is the one the catalog carries, or is
 * lifted from the subclass's additional spells when the catalog has not lifted it (a catalog synced
 * before the scraper lifted spell choices).
 */
function choicesAt(locator: OptionLocator, sub: SubclassData): FeatureChoice | undefined {
  if ("feature" in locator) {
    return sub.features.find((f) => f.name === locator.feature.name && f.level === locator.feature.level)?.choices;
  }
  return sub.spellChoice ?? liftSpellChoice(sub.additionalSpells);
}
