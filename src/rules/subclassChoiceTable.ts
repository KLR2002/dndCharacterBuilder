import type { Character } from "../types/character.ts";
import type { Compendium } from "../services/compendium.ts";
import { formatCantripOptions, GIANT_POWER_CHOICE_ID } from "./choices/types.ts";
import { skills } from "./skills.ts";

/**
 * Class and subclass Rule Choices as data. Each row is one choice a class or subclass grants.
 *
 * Ids are persisted in saved characters and must never change. Adding a choice means adding a
 * row; the row's `source` gates it by active book, and its `owner` decides which characters are
 * offered it. Options are either a static list or a named resolver that derives them from the
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

/** A printed option. `book` limits it to when that book is active; absent means always offered. */
export interface SubclassChoiceOption {
  name: string;
  description: string;
  book?: string;
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

export interface SubclassChoiceRow {
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
  choose: number;
  options: readonly SubclassChoiceOption[] | { resolver: OptionResolverName };
  /** Offered only while the character has this optional feature. */
  requiresOptionalFeature?: string;
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
    choose: 1,
    options: [
      { name: "Bear", description: "While raging, you have resistance to all damage except psychic damage." },
      { name: "Eagle", description: "While raging and not wearing heavy armor, opportunity attacks against you have disadvantage and you can Dash as a bonus action." },
      { name: "Wolf", description: "While raging, your friends have advantage on melee attack rolls against any hostile creature within 5 ft of you." },
      { name: "Elk", description: "While raging and not wearing heavy armor, your walking speed increases by 15 feet.", book: "SCAG" },
      { name: "Tiger", description: "While raging, you can add 10 feet to your long jump distance and 3 feet to your high jump distance.", book: "SCAG" },
    ],
  },
  {
    id: "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6",
    source: "PHB",
    owner: { className: "Barbarian", subclass: "Totem" },
    traitName: "Aspect of the Beast (6th Level)",
    level: 6,
    effectLevel: 6,
    choose: 1,
    options: [
      { name: "Bear", description: "Your carrying capacity (including maximum load and lift) is doubled, and you have advantage on Strength checks to push, pull, lift, or break objects." },
      { name: "Eagle", description: "You can see up to 1 mile away with no difficulty, and dim light doesn't impose disadvantage on your Wisdom (Perception) checks." },
      { name: "Wolf", description: "You can track other creatures while traveling at a fast pace, and you can move stealthily while traveling at a normal pace." },
      { name: "Elk", description: "Whether mounted or on foot, your travel pace is doubled, as is the travel pace of up to ten companions within 60 ft.", book: "SCAG" },
      { name: "Tiger", description: "You gain proficiency in two skills from: Athletics, Acrobatics, Stealth, and Survival.", book: "SCAG" },
    ],
  },
  {
    id: "PHB__Barbarian__Path of the Totem Warrior__Totemic Attunement 14",
    source: "PHB",
    owner: { className: "Barbarian", subclass: "Totem" },
    traitName: "Totemic Attunement (14th Level)",
    level: 14,
    effectLevel: 14,
    choose: 1,
    options: [
      { name: "Bear", description: "While raging, hostile creatures within 5 feet have disadvantage on attack rolls against targets other than you." },
      { name: "Eagle", description: "While raging, you have a flying speed equal to your current walking speed in short bursts." },
      { name: "Wolf", description: "While raging, you can use a bonus action to knock a Large or smaller creature prone when you hit it with a melee weapon attack." },
      { name: "Elk", description: "While raging, bonus action during move to pass through a Large or smaller creature, dealing 1d12 + Str bludgeoning and knocking prone (Str save).", book: "SCAG" },
      { name: "Tiger", description: "While raging, move 20 ft straight toward Large or smaller target before melee attack to use bonus action for extra melee weapon attack.", book: "SCAG" },
    ],
  },
];

/** Whether a row is owned by this recorded class (and subclass fragment, when the row names one). */
export function rowOwnedBy(row: SubclassChoiceRow, className: string, subclassName: string): boolean {
  if (row.owner.className.toLowerCase() !== className.toLowerCase()) return false;
  if (!row.owner.subclass) return true;
  // Case- and whitespace-insensitive, so "Divine Soul" and "divinesoul" name the same subclass.
  const compact = (s: string) => s.replace(/\s+/g, "");
  return compact(subclassName).includes(compact(row.owner.subclass.toLowerCase()));
}

/** Whether the optional feature is enabled on the character (replacement or legacy flag). */
export function hasOptionalFeature(character: Character, name: string): boolean {
  const legacy = character as Character & { optionalFeatures?: Record<string, boolean> };
  return Boolean(
    character.optionalFeatureReplacements?.[name] ?? legacy.optionalFeatures?.[name]
  );
}

/** The options a row offers for this character, with book-gated options dropped when their book is inactive. */
export function resolveRowOptions(
  row: SubclassChoiceRow,
  ctx: OptionResolverContext
): { name: string; description: string }[] {
  if ("resolver" in row.options) {
    return RESOLVERS[row.options.resolver](ctx).map(({ name, description }) => ({ name, description }));
  }
  const active = ctx.activeBooks;
  return row.options
    .filter((o) => !o.book || !active || active.some((b) => b.toUpperCase() === o.book))
    .map(({ name, description }) => ({ name, description }));
}
