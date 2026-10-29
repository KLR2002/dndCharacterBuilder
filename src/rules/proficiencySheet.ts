import type { ActiveBooks } from "../constants/books.ts";
import type { Character } from "../types/character.ts";
import type { ClassData, ItemData, ProficiencyCategory } from "../types/dnd5e.ts";
import { DND_SKILLS } from "../constants/rules.ts";
import { allCatalogClasses, catalogListings, findClassData, type CharacterCatalogs } from "./catalogs.ts";
import { currentCompendium, type CompendiumListings } from "../services/compendium.ts";
import { grantedFeatures } from "./grantedFeatures.ts";
import { deduplicateWeaponProficiencies, normalizeArmorProficiency } from "./proficiencies.ts";
import {
  classBaseProficiencies,
  classBaseSavingThrows,
  MULTICLASS_FEATURE,
  multiclassSkillGrantOf,
} from "./proficiencySources/classBase.ts";
import type { FeatureInstance, ResolvedAncestry } from "./types.ts";
import { ALL_LANGUAGE_NAMES, ALL_TOOLS, normalizeToolName } from "./proficienciesAndLanguages.ts";
import {
  normalizeLanguageName,
  normalizeSavingThrowName,
  pickCategories,
  pickLandsIn,
  STARTING_PROFICIENCIES,
  validPicks,
  weaponHeld,
  type ChoiceProficiencyGrant,
} from "./proficiencyPools.ts";
import { normalizeSkillName } from "./skills.ts";
import { classSkillChoice, getAutoGrantedSkills } from "./proficiencySources/skillGrants.ts";
import { resolveCharacterAncestry } from "./characterAncestry.ts";
import { customBackgroundFeature } from "./customBackground.ts";
import { originCustomizationAvailable } from "./originCustomization.ts";
import { findHeldRace } from "./raceLookup.ts";
import {
  languageSwapSlots,
  withLanguageSwaps,
  type LanguageSwapSlot,
} from "./proficiencySources/languageSwaps.ts";
import {
  proficiencySwapSlots,
  replacedSkillKeys,
  swapNameKey,
  withProficiencySwaps,
  type ProficiencySwapSlot,
} from "./proficiencySources/proficiencySwaps.ts";

export { classSkillChoice } from "./proficiencySources/skillGrants.ts";
export { isSwapId, languageOfSwapId } from "./proficiencySources/languageSwaps.ts";
export { swapLabelOf } from "./proficiencySources/proficiencySwaps.ts";
export {
  multiclassGrantsOf,
  multiclassSkillGrantOf,
  MULTICLASS_FEATURE,
  type MulticlassGrants,
} from "./proficiencySources/classBase.ts";

/**
 * One entry on the Proficiency Sheet, in any of its categories. Only tools and languages can be added
 * by hand; those entries are `ruleGranted: false`. Every other entry comes from a rule.
 */
export interface SheetEntry {
  name: string;
  ruleGranted: boolean;
  /** A skill whose Expertise a Proficiency Grant gives: the grant's fixed skill, or a pick of its choice. */
  expertise?: true;
}

/**
 * What a character is proficient in, across every category the sheet covers. Derived on every read
 * and never stored (ADR 0015).
 */
export interface ProficiencySheet {
  tools: SheetEntry[];
  languages: SheetEntry[];
  armor: SheetEntry[];
  /** Categorical Weapon Proficiencies supersede the individual weapons they cover. */
  weapons: SheetEntry[];
  /** Ability names, for example "Wisdom". Only the first class's saves are a base; the rest come from grants. */
  savingThrows: SheetEntry[];
  /** Skill names in the spelling the rules use. Skills are never added by hand. */
  skills: SheetEntry[];
}

/** One entry per name, the first spelling kept, matched case-insensitively. */
function sheetEntries(names: string[]): SheetEntry[] {
  const seen = new Set<string>();
  const entries: SheetEntry[] = [];
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    entries.push({ name, ruleGranted: true });
  }
  return entries;
}

/** A known tool or language's own spelling, or the name as typed, trimmed (Added Proficiencies keep custom names). */
export function normalizeAddedName(category: "tools" | "languages", raw: string): string {
  const clean = raw.trim();
  const known = (category === "tools" ? ALL_TOOLS : ALL_LANGUAGE_NAMES).find(
    (name) => name.toLowerCase() === clean.toLowerCase(),
  );
  return known ?? clean;
}

/** Added Proficiencies that no rule-granted entry already names. A rule-granted spelling wins, so the entry shows once. */
function addedSheetEntries(
  added: string[] | undefined,
  category: "tools" | "languages",
  ruleEntries: SheetEntry[],
): SheetEntry[] {
  const seen = new Set(ruleEntries.map((entry) => entry.name.toLowerCase()));
  const entries: SheetEntry[] = [];
  for (const raw of added ?? []) {
    const name = normalizeAddedName(category, raw);
    const key = name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    entries.push({ name, ruleGranted: false });
  }
  return entries;
}

/** Every character speaks Common. A character with no race, or whose race and subrace name no fixed language, holds it alone. */
const BASE_LANGUAGE = "Common";

/** The tool and language picks saved in the race and background buckets, before they were Proficiency Choices. */
function legacySourcePicks(character: Character, category: "tools" | "languages"): string[] {
  const buckets = category === "tools" ? character.chosenTools : character.chosenLanguages;
  return [...(buckets?.race ?? []), ...(buckets?.background ?? [])];
}

/** The fixed names of one category across the features the character has now. */
function fixedFeatureNames(features: FeatureInstance[], category: ProficiencyCategory): string[] {
  return features.flatMap((feature) =>
    (feature.grants ?? []).flatMap((grant) => (grant.kind === "fixed" && grant.category === category ? grant.names : [])),
  );
}

/**
 * The class tool picks saved before the starting tool choice was a Proficiency Choice. They sit in the
 * class bucket, and count as picks of that choice until reconciling moves them into its own pick.
 */
function legacyClassToolPicks(feature: FeatureInstance, grant: ChoiceProficiencyGrant, character: Character): string[] {
  const starting = feature.origin === "Class" && feature.name === STARTING_PROFICIENCIES;
  return starting && grant.category === "tools" ? (character.chosenTools?.class ?? []) : [];
}

/**
 * The saved picks of one category, for the choice grants on the features the character has now. A pick lands in
 * the category whose list names it, so a mixed grant's tool is a tool and its language a language.
 */
function choicePickNames(
  features: FeatureInstance[],
  character: Character,
  category: ProficiencyCategory,
  items: readonly ItemData[],
): string[] {
  return features.flatMap((feature) =>
    (feature.grants ?? []).flatMap((grant) => {
      if (grant.kind !== "choice" || !pickCategories(grant).includes(category)) return [];
      const saved = [...(character.proficiencyPicks?.[grant.id] ?? []), ...legacyClassToolPicks(feature, grant, character)];
      return validPicks(grant, saved, items).filter((name) => pickLandsIn(grant, name) === category);
    }),
  );
}

/**
 * Weapon proficiency names saved on the character before the Catalog carried them. No current code writes
 * the field, but a saved character may still hold it, so the sheet keeps reading it.
 */
function legacyWeaponNames(character: Character): string[] {
  const saved = (character as { weaponProficiencies?: unknown }).weaponProficiencies;
  return Array.isArray(saved) ? saved.filter((name): name is string => typeof name === "string") : [];
}

/** The skills a character holds from the rules and the buckets that predate the sheet, not from a saved pick. */
function legacySkillNames(
  character: Character,
  ancestry: ResolvedAncestry,
  listings: CompendiumListings,
  features: FeatureInstance[],
  activeBooks: readonly string[] | undefined,
  replacedSkills: ReadonlySet<string>,
): string[] {
  const traitSkills = getAutoGrantedSkills(character, {
    race: ancestry.race,
    subrace: ancestry.subrace,
    races: listings.races(),
    activeBooks,
  });
  return [
    ...traitSkills.filter((name) => !replacedSkills.has(swapNameKey(name))),
    ...fixedFeatureNames(features, "skills").map(normalizeSkillName),
  ];
}

/**
 * The skills that carry Expertise from a Proficiency Grant marked `expertise`: the fixed names of such a skills grant,
 * and the picks the character holds on such a skill choice. Derived with the grant, so it goes when the grant does.
 */
function grantExpertiseNames(features: FeatureInstance[], character: Character, items: readonly ItemData[]): string[] {
  return features.flatMap((feature) =>
    (feature.grants ?? []).flatMap((grant) => {
      if (grant.category !== "skills" || grant.expertise !== true) return [];
      if (grant.kind === "fixed") return grant.names;
      return validPicks(grant, character.proficiencyPicks?.[grant.id] ?? [], items);
    }),
  );
}

/**
 * The starting proficiencies of the character's first class, as a feature: its level-1 Proficiency Grants
 * from the Catalog class it resolves to. Only the first class starts with them. Undefined when it has none.
 */
function startingFeatureOf(character: Character, classes: readonly ClassData[]): FeatureInstance | undefined {
  const first = character.classes[0];
  const cls = first ? findClassData(classes, first) : undefined;
  if (!cls?.grants?.length) return undefined;
  return {
    id: JSON.stringify(["Class", cls.source, cls.name, STARTING_PROFICIENCIES, 1]),
    name: STARTING_PROFICIENCIES,
    source: cls.source,
    description: "",
    origin: "Class",
    className: cls.name,
    level: 1,
    grants: cls.grants,
  };
}

/**
 * The multiclass skill choice of each later class entry whose Catalog record gives one, as a feature carrying that
 * one Proficiency Choice. The first class has none: its skill is the starting skill choice.
 */
function multiclassFeaturesOf(character: Character, classes: readonly ClassData[]): FeatureInstance[] {
  return character.classes.slice(1).flatMap((entry) => {
    const cls = findClassData(classes, entry);
    const grant = cls && multiclassSkillGrantOf(cls);
    if (!cls || !grant || entry.level < 1) return [];
    return [
      {
        id: JSON.stringify(["Class", cls.source, cls.name, MULTICLASS_FEATURE, 1]),
        name: MULTICLASS_FEATURE,
        source: cls.source,
        description: "",
        origin: "Class",
        className: cls.name,
        level: 1,
        grants: [grant],
      },
    ];
  });
}

/**
 * The features the character holds, each with the grants its rule gives, read from the listings. The
 * first class's starting proficiencies, the later classes' multiclass skill choices, and a custom background's
 * picks, are included as more features; they are not granted features.
 */
export function featuresOf(character: Character, listings: CompendiumListings, activeBooks: ActiveBooks): FeatureInstance[] {
  const features = grantedFeatures(character, {
    races: listings.races(),
    classes: listings.classes(),
    backgrounds: listings.backgrounds(),
    feats: listings.feats(),
    activeBooks,
  });
  const starting = startingFeatureOf(character, listings.classes());
  const multiclass = multiclassFeaturesOf(character, listings.classes());
  const custom = customBackgroundFeature(character);
  return [...features, ...(starting ? [starting] : []), ...multiclass, ...(custom ? [custom] : [])];
}

/**
 * The skills a character holds from the rules alone, not from the starting skill picker: the fixed skill grants of
 * the features the character has now, the race, subrace and background skill picks, and the skill picks of every
 * feature (class, subclass and feat included, such as a subclass's pick or a later class's multiclass pick). The
 * starting skill picker lists these as already held, so a skill picked elsewhere cannot duplicate them.
 */
export function ruleGrantedSkills(character: Character, catalogs?: CharacterCatalogs): string[] {
  const listings = catalogListings(catalogs);
  const ancestry = resolveCharacterAncestry(character, listings.races(), catalogs?.activeBooks);
  const raw = featuresOf(character, listings, catalogs?.activeBooks);
  const { features, replacedSkills } = resolveSwaps(raw, character, catalogs ?? { activeBooks: undefined });
  return [
    ...legacySkillNames(character, ancestry, listings, features, catalogs?.activeBooks, replacedSkills),
    ...choicePickNames(features, character, "skills", listings.items()),
  ];
}

/**
 * The language names the features and the saved buckets grant. `fallback` is the base language, decided by the caller
 * from the features before any swap, so a swap that removes a race's only language brings no Common back.
 */
function grantedLanguageNames(
  features: FeatureInstance[],
  character: Character,
  items: readonly ItemData[],
  fallback: string[],
): string[] {
  return [
    ...fallback,
    ...fixedFeatureNames(features, "languages").map(normalizeLanguageName),
    ...legacySourcePicks(character, "languages"),
    ...choicePickNames(features, character, "languages", items),
  ];
}

/** Every character speaks Common. A character whose race names no fixed language holds it alone (the fallback). */
function baseLanguagesOf(character: Character, raw: FeatureInstance[]): string[] {
  const raceNamesLanguage =
    character.race && fixedFeatureNames(raw.filter((f) => f.origin === "Race" || f.origin === "Subrace"), "languages").length > 0;
  return raceNamesLanguage ? [] : [BASE_LANGUAGE];
}

/**
 * The swaps of a character's held race and subrace, resolved against the catalogs: every slot, the features the swaps in
 * effect leave, and the skills whose trait text no longer grants them. A swap's pool is read from the features before any
 * swap, so a replacement one swap takes is not offered by another.
 */
interface SwapResolution {
  available: boolean;
  languageSlots: LanguageSwapSlot[];
  proficiencySlots: ProficiencySwapSlot[];
  /** Whether the held race resolves in the Catalog. An absent slot is a race that no longer grants the original only then. */
  raceKnown: boolean;
  features: FeatureInstance[];
  replacedSkills: Set<string>;
}

function resolveSwaps(raw: FeatureInstance[], character: Character, catalogs: CharacterCatalogs): SwapResolution {
  const listings = catalogListings(catalogs);
  const held = [
    ...grantedLanguageNames(raw, character, listings.items(), baseLanguagesOf(character, raw)),
    ...(character.addedLanguages ?? []).map((name) => normalizeAddedName("languages", name)),
  ];
  const available = originCustomizationAvailable(character, catalogs);
  const languageSlots = languageSwapSlots(raw, held, character.proficiencyPicks, available);
  const raceKnown = !character.race || findHeldRace(listings.races(), character.race, catalogs?.activeBooks).race !== undefined;

  const heldSheet = sheetOver(character, catalogs, raw, raw, new Set());
  const heldNow = (category: "skills" | "tools" | "weapons", name: string): boolean =>
    category === "weapons"
      ? weaponHeld(name, heldSheet.weapons.map((entry) => entry.name))
      : heldSheet[category].some((entry) => entry.name.trim().toLowerCase() === name.trim().toLowerCase());
  const proficiencySlots = proficiencySwapSlots({
    features: raw,
    items: listings.items(),
    rows: listings.originRules().flatMap((rule) => rule.proficiencySwaps),
    held: heldNow,
    picks: character.proficiencyPicks,
    available,
  });
  const languageFeatures = withLanguageSwaps(raw, available ? languageSlots : []);
  return {
    available,
    languageSlots,
    proficiencySlots,
    raceKnown,
    features: withProficiencySwaps(languageFeatures, proficiencySlots),
    replacedSkills: replacedSkillKeys(proficiencySlots),
  };
}

/**
 * Each fixed language of the held race or subrace that a swap may replace, with its pool and the replacement picked for it
 * when that pick is valid. `available` says whether the swaps are in effect; slots are listed whether or not they are.
 */
export interface LanguageSwapState {
  available: boolean;
  slots: LanguageSwapSlot[];
  raceKnown: boolean;
}

export function languageSwapStateOf(character: Character, catalogs: CharacterCatalogs): LanguageSwapState {
  const raw = featuresOf(character, catalogListings(catalogs), catalogs.activeBooks);
  const { available, languageSlots, raceKnown } = resolveSwaps(raw, character, catalogs);
  return { available, slots: languageSlots, raceKnown };
}

/** Each proficiency swap slot of the held race or subrace (skill, tool, weapon, armor, or a narrower choice's pick), with its pool. */
export interface ProficiencySwapState {
  available: boolean;
  slots: ProficiencySwapSlot[];
  raceKnown: boolean;
}

export function proficiencySwapStateOf(character: Character, catalogs: CharacterCatalogs): ProficiencySwapState {
  const raw = featuresOf(character, catalogListings(catalogs), catalogs.activeBooks);
  const { available, proficiencySlots, raceKnown } = resolveSwaps(raw, character, catalogs);
  return { available, slots: proficiencySlots, raceKnown };
}

/** Every swap slot the prune reads, language and proficiency alike, with the replacement in effect by name. */
export interface OriginSwapState {
  available: boolean;
  raceKnown: boolean;
  slots: { id: string; original: string; replacement?: string }[];
}

export function originSwapStateOf(character: Character, catalogs: CharacterCatalogs): OriginSwapState {
  const raw = featuresOf(character, catalogListings(catalogs), catalogs.activeBooks);
  const { available, languageSlots, proficiencySlots, raceKnown } = resolveSwaps(raw, character, catalogs);
  return {
    available,
    raceKnown,
    slots: [
      ...languageSlots.map((slot) => ({ id: slot.id, original: slot.original, replacement: slot.replacement })),
      ...proficiencySlots.map((slot) => ({ id: slot.id, original: slot.original, replacement: slot.replacement?.name })),
    ],
  };
}

/** One row of the Origin Customization card's language section: the original, the pool, and the pick in effect. */
export interface LanguageSwapView {
  id: string;
  original: string;
  options: string[];
  replacement?: string;
}

/** The language swap rows the card shows: one per fixed language of the held race or subrace. Empty while the rule is unavailable. */
export function languageSwapViews(character: Character, catalogs: CharacterCatalogs): LanguageSwapView[] {
  const { available, slots } = languageSwapStateOf(character, catalogs);
  if (!available) return [];
  return slots.map((slot) => ({ id: slot.id, original: slot.original, options: slot.pool, replacement: slot.replacement }));
}

/** One row of the Origin Customization card's proficiency section: the original, the names it may be replaced with, and the pick in effect. */
export interface ProficiencySwapView {
  id: string;
  original: string;
  options: string[];
  replacement?: string;
}

/** The proficiency swap rows the card shows: one per swappable proficiency with a non-empty pool. Empty while the rule is unavailable. */
export function proficiencySwapViews(character: Character, catalogs: CharacterCatalogs): ProficiencySwapView[] {
  const { available, slots } = proficiencySwapStateOf(character, catalogs);
  if (!available) return [];
  return slots
    .filter((slot) => slot.pool.length > 0)
    .map((slot) => ({
      id: slot.id,
      original: slot.original,
      options: slot.pool.map((entry) => entry.name),
      replacement: slot.replacement?.name,
    }));
}

/** The fixed languages and tools a race, its subrace or a background grants, as the Builder lists them. */
export interface SourceFixedGrants {
  languages: string[];
  tools: string[];
}

/**
 * What the Builder's race, background and class cards show as granted: the fixed names of each source. Their
 * Proficiency Choices are offered through `proficiencyChoiceOffers`.
 */
export interface SourceGrants {
  race: SourceFixedGrants;
  background: SourceFixedGrants;
  /** The fixed tools the first class starts with. Its tool choice is a Proficiency Choice, offered on its own. */
  classTools: string[];
}

export function sourceGrants(character: Character, catalogs: CharacterCatalogs): SourceGrants {
  const listings = catalogListings(catalogs);
  const raw = featuresOf(character, listings, catalogs?.activeBooks);
  const { features, languageSlots } = resolveSwaps(raw, character, catalogs);
  const fixedOf = (origins: FeatureInstance["origin"][], replacements: string[] = []): SourceFixedGrants => {
    const sourced = features.filter((feature) => origins.includes(feature.origin));
    // A race and its subrace may both grant the same language or tool; each is listed once.
    return {
      languages: [...new Set([...fixedFeatureNames(sourced, "languages").map(normalizeLanguageName), ...replacements])],
      tools: [...new Set(fixedFeatureNames(sourced, "tools").map(normalizeToolName))],
    };
  };
  const starting = startingFeatureOf(character, listings.classes());
  const replacements = languageSlots.flatMap((slot) => (slot.replacement !== undefined ? [slot.replacement] : []));
  return {
    race: fixedOf(["Race", "Subrace"], replacements),
    background: fixedOf(["Background"]),
    classTools: starting ? fixedFeatureNames([starting], "tools").map(normalizeToolName) : [],
  };
}

/** A skill choice the Builder offers: its source label, pick count and the skills to pick from. */
export interface SkillChoiceOffer {
  source: string;
  choose: number;
  from: string[];
}

/**
 * The skill choice the first class offers the Builder: its starting list, or every skill when the list is empty.
 * A race's, subrace's and background's skill picks are Proficiency Choices, offered through
 * `proficiencyChoiceOffers`, so no builder file reads a race or background skill field.
 */
export function skillChoiceOffers(character: Character, catalogs: CharacterCatalogs): SkillChoiceOffer[] {
  const first = character.classes[0];
  if (!first) return [];
  const classData = findClassData((catalogs.compendium ?? currentCompendium()).for().classes(), first);
  const starting = classSkillChoice(classData);
  if (!starting || starting.choose <= 0) return [];
  return [
    {
      source: `Class: ${first.className}`,
      choose: starting.choose,
      from:
        starting.from && starting.from.length > 0
          ? starting.from.map(normalizeSkillName)
          : DND_SKILLS.map((s) => normalizeSkillName(s.name)),
    },
  ];
}

/**
 * The Proficiency Sheet. The catalog bundle is required: a call site must say which Compendium it
 * reads, because a default that means "no catalog" silently empties the lists.
 */
export function proficiencySheet(character: Character, catalogs: CharacterCatalogs): ProficiencySheet {
  const listings = catalogListings(catalogs);
  const raw = featuresOf(character, listings, catalogs?.activeBooks);
  const { features, replacedSkills } = resolveSwaps(raw, character, catalogs);
  return sheetOver(character, catalogs, raw, features, replacedSkills);
}

/**
 * The sheet over `features`, the features the swaps in effect leave. `raw` is the held features before any swap: the
 * languages a swap removes still decide the fallback Common, and the swaps' pools read it.
 */
function sheetOver(
  character: Character,
  catalogs: CharacterCatalogs,
  raw: FeatureInstance[],
  features: FeatureInstance[],
  replacedSkills: ReadonlySet<string>,
): ProficiencySheet {
  const listings = catalogListings(catalogs);
  const ancestry = resolveCharacterAncestry(character, listings.races(), catalogs.activeBooks);

  // Class base proficiencies (the first class's, and each later class's multiclass grants from the Catalog), then the
  // multiclass proficiencies recorded on the character, then the features' grants.
  const classBase = classBaseProficiencies(character, listings.classes(), allCatalogClasses(catalogs));
  const recordedMulticlass = character.multiclassProficiencies ?? [];

  const items = listings.items();
  const tools = [
    ...fixedFeatureNames(features, "tools").map(normalizeToolName),
    ...legacySourcePicks(character, "tools").map(normalizeToolName),
    ...recordedMulticlass.flatMap((mp) => mp.tools ?? []).map(normalizeToolName),
    ...choicePickNames(features, character, "tools", items),
  ];
  const languages = grantedLanguageNames(features, character, items, baseLanguagesOf(character, raw));
  // The first class's saves are the base, from the Catalog class it holds. A later class adds none of its own.
  const baseSaves = classBaseSavingThrows(character.classes[0], allCatalogClasses(catalogs));
  const savingThrows = sheetEntries([
    ...baseSaves,
    ...fixedFeatureNames(features, "savingThrows").map(normalizeSavingThrowName),
    ...choicePickNames(features, character, "savingThrows", items),
  ]);
  const armorNames = [
    ...classBase.armor,
    ...recordedMulticlass.flatMap((mp) => mp.armor ?? []),
    ...fixedFeatureNames(features, "armor"),
  ].map(normalizeArmorProficiency);
  const weaponNames = [
    ...classBase.weapons,
    ...recordedMulticlass.flatMap((mp) => mp.weapons ?? []),
    ...legacyWeaponNames(character),
    ...fixedFeatureNames(features, "weapons"),
    ...choicePickNames(features, character, "weapons", items),
  ];

  const skillNames = [
    ...legacySkillNames(character, ancestry, listings, features, catalogs.activeBooks, replacedSkills),
    ...(character.chosenSkills ?? []).map(normalizeSkillName),
    ...choicePickNames(features, character, "skills", items),
  ];
  const expertiseKeys = new Set(grantExpertiseNames(features, character, items).map((name) => name.trim().toLowerCase()));

  const toolRules = sheetEntries(tools);
  const languageRules = sheetEntries(languages);
  return {
    tools: [...toolRules, ...addedSheetEntries(character.addedTools, "tools", toolRules)],
    languages: [...languageRules, ...addedSheetEntries(character.addedLanguages, "languages", languageRules)],
    armor: sheetEntries(armorNames),
    weapons: sheetEntries(deduplicateWeaponProficiencies(weaponNames)),
    savingThrows,
    skills: sheetEntries(skillNames).map((entry) => (expertiseKeys.has(entry.name.toLowerCase()) ? { ...entry, expertise: true } : entry)),
  };
}
