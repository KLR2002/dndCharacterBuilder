import type { Character } from "../types/character.ts";
import type { ItemData, ProficiencyCategory } from "../types/dnd5e.ts";
import { DND_SKILLS, RACE_WEAPON_PROFICIENCIES } from "../constants/rules.ts";
import { catalogListings, findClassData, type CharacterCatalogs } from "./catalogs.ts";
import { currentCompendium, type CompendiumListings } from "../services/compendium.ts";
import { grantedFeatures } from "./grantedFeatures.ts";
import { deduplicateWeaponProficiencies, normalizeArmorProficiency } from "./proficiencies.ts";
import { classBaseProficiencies } from "./proficiencySources/classBase.ts";
import type { FeatureInstance, ResolvedAncestry } from "./types.ts";
import { ALL_LANGUAGE_NAMES, ALL_TOOLS, normalizeToolName } from "./proficienciesAndLanguages.ts";
import {
  getBackgroundLanguageGrant,
  getBackgroundToolGrant,
  getClassToolGrant,
  getRaceLanguageGrant,
  getRaceToolGrant,
  resolveCharacterTools,
  structuredLanguages,
  type LanguageGrant,
  type ToolGrant,
} from "./proficiencySources/toolsAndLanguages.ts";
import { normalizeLanguageName, normalizeSavingThrowName, validPicks } from "./proficiencyPools.ts";
import { ABILITY_NAMES } from "./abilities.ts";
import { CLASS_DATA } from "./classData.ts";
import { isKnowledgeCleric, normalizeSkillName } from "./skills.ts";
import {
  classSkillChoice,
  getAutoGrantedSkills,
  getRacialSkillChoices,
} from "./proficiencySources/skillGrants.ts";
import { resolveCharacterAncestry } from "./characterAncestry.ts";

export type { ToolGrant } from "./proficiencySources/toolsAndLanguages.ts";
export { classSkillChoice } from "./proficiencySources/skillGrants.ts";

/** The Knowledge Domain's four skills. A Knowledge Cleric's Expertise on one of them has always made it proficient. */
const KNOWLEDGE_SKILLS = ["Arcana", "History", "Nature", "Religion"];

/**
 * One entry on the Proficiency Sheet, in any of its categories. Only tools and languages can be added
 * by hand; those entries are `ruleGranted: false`. Every other entry comes from a rule.
 */
export interface SheetEntry {
  name: string;
  ruleGranted: boolean;
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

/** The fixed names of one category across the features the character has now. */
function fixedFeatureNames(features: FeatureInstance[], category: ProficiencyCategory): string[] {
  return features.flatMap((feature) =>
    (feature.grants ?? []).flatMap((grant) => (grant.kind === "fixed" && grant.category === category ? grant.names : [])),
  );
}

/** The saved picks of one choice category, for the choice grants on the features the character has now. */
function choicePickNames(
  features: FeatureInstance[],
  character: Character,
  category: ProficiencyCategory,
  items: readonly ItemData[],
): string[] {
  return features.flatMap((feature) =>
    (feature.grants ?? []).flatMap((grant) =>
      grant.kind === "choice" && grant.category === category
        ? validPicks(grant, character.proficiencyPicks?.[grant.id] ?? [], items)
        : [],
    ),
  );
}

/**
 * The armor and weapon training a character's race gives: the weapons its race or subrace lists, and
 * the Mountain Dwarf's and Githyanki's light and medium armor.
 */
function raceTraining(character: Character): { armor: string[]; weapons: string[] } {
  const raceName = character.race?.name;
  const subraceName = character.race?.subraceName;
  const candidateKeys = [
    raceName,
    subraceName,
    subraceName && raceName ? `${subraceName} ${raceName}` : undefined,
  ].filter((k): k is string => Boolean(k));
  const weapons = candidateKeys.flatMap((key) => RACE_WEAPON_PROFICIENCIES[key] ?? []);
  const armor =
    subraceName === "Mountain Dwarf" || raceName === "Mountain Dwarf" || raceName === "Githyanki"
      ? ["Light armor", "Medium armor"]
      : [];
  return { armor, weapons };
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
): string[] {
  return [
    ...getAutoGrantedSkills(character, {
      race: ancestry.race,
      subrace: ancestry.subrace,
      races: listings.races(),
      backgrounds: listings.backgrounds(),
    }),
    ...fixedFeatureNames(features, "skills").map(normalizeSkillName),
  ];
}

/** Knowledge Cleric Expertise on a Knowledge skill, which makes that skill proficient. */
function knowledgeExpertiseSkills(character: Character): string[] {
  if (!isKnowledgeCleric(character)) return [];
  return (character.chosenExpertise ?? []).map(normalizeSkillName).filter((name) => KNOWLEDGE_SKILLS.includes(name));
}

/** The features the character holds, each with the grants its rule gives, read from the listings. */
export function featuresOf(character: Character, listings: CompendiumListings): FeatureInstance[] {
  return grantedFeatures(character, {
    races: listings.races(),
    classes: listings.classes(),
    backgrounds: listings.backgrounds(),
    feats: listings.feats(),
  });
}

/**
 * The skills a character holds from the rules alone: background, race and Rule Choice grants, and the
 * fixed skill grants of the features the character has now. The builder lists these as already held,
 * so a skill picked elsewhere cannot duplicate them.
 */
export function ruleGrantedSkills(character: Character, catalogs?: CharacterCatalogs): string[] {
  const listings = catalogListings(catalogs);
  const ancestry = resolveCharacterAncestry(character, listings.races());
  return legacySkillNames(character, ancestry, listings, featuresOf(character, listings));
}

/**
 * What the Builder's race, background and class cards offer: the fixed grants and the pick counts of
 * each source. The Builder reads these through the sheet, as it reads every proficiency.
 */
export interface SourceGrants {
  raceLanguages: LanguageGrant;
  raceTools: ToolGrant;
  backgroundLanguages: LanguageGrant;
  backgroundTools: ToolGrant;
  classTools: ToolGrant;
}

export function sourceGrants(character: Character, catalogs: CharacterCatalogs): SourceGrants {
  const listings = catalogListings(catalogs);
  const races = listings.races();
  const backgrounds = listings.backgrounds();
  return {
    raceLanguages: getRaceLanguageGrant(
      character.race?.name,
      character.race?.subraceName,
      races,
      character.race?.source,
      character.race?.subraceSource
    ),
    raceTools: getRaceToolGrant(character.race?.name, character.race?.subraceName, races),
    backgroundLanguages: getBackgroundLanguageGrant(character.background?.name, backgrounds),
    backgroundTools: getBackgroundToolGrant(character.background?.name, backgrounds),
    classTools: getClassToolGrant(character.classes[0]?.className, listings.classes()),
  };
}

/** A skill choice a race or class offers the Builder: its source label, pick count and the skills to pick from. */
export interface SkillChoiceOffer {
  source: string;
  choose: number;
  from: string[];
}

/**
 * The skill choices a race and the first class offer. The race's choices take the subrace and the
 * ancestry option the character picked; the class's take its starting list, or every skill when the
 * list is empty. The Builder reads its offers here, so no builder file reads a race or class skill field.
 */
export function skillChoiceOffers(
  character: Character,
  catalogs: CharacterCatalogs,
  raceChosenOption?: string
): SkillChoiceOffer[] {
  const listings = catalogListings(catalogs);
  const offers: SkillChoiceOffer[] = [];

  if (character.race) {
    const racial = getRacialSkillChoices(
      character.race.name,
      character.race.subraceName,
      listings.races(),
      character.race.source,
      raceChosenOption
    );
    for (const choice of racial) {
      offers.push({ source: choice.source, choose: choice.choose, from: choice.from.map(normalizeSkillName) });
    }
  }

  const first = character.classes[0];
  if (first) {
    const classData = findClassData((catalogs.compendium ?? currentCompendium()).for().classes(), first);
    const starting = classSkillChoice(classData);
    if (starting && starting.choose > 0) {
      offers.push({
        source: `Class: ${first.className}`,
        choose: starting.choose,
        from:
          starting.from && starting.from.length > 0
            ? starting.from.map(normalizeSkillName)
            : DND_SKILLS.map((s) => normalizeSkillName(s.name)),
      });
    }
  }

  return offers;
}

/**
 * The Proficiency Sheet. The catalog bundle is required: a call site must say which Compendium it
 * reads, because a default that means "no catalog" silently empties the lists.
 */
export function proficiencySheet(character: Character, catalogs: CharacterCatalogs): ProficiencySheet {
  const listings = catalogListings(catalogs);
  const features = featuresOf(character, listings);
  const ancestry = resolveCharacterAncestry(character, listings.races());

  // Class base proficiencies (the first class's, and the multiclass table for the others), then the
  // multiclass proficiencies recorded on the character, then race training and the features' grants.
  const classBase = classBaseProficiencies(character, listings.classes());
  const recordedMulticlass = character.multiclassProficiencies ?? [];
  const race = raceTraining(character);

  const items = listings.items();
  const tools = [
    ...resolveCharacterTools(character, catalogs),
    ...fixedFeatureNames(features, "tools").map(normalizeToolName),
    ...choicePickNames(features, character, "tools", items),
  ];
  const languages = [
    ...structuredLanguages(character, catalogs),
    ...fixedFeatureNames(features, "languages").map(normalizeLanguageName),
    ...choicePickNames(features, character, "languages", items),
  ];
  // The first class's saves are the base, as they have always been. A later class adds none of its own.
  const firstClass = character.classes[0];
  const baseSaves = firstClass ? (catalogs.classRules ?? CLASS_DATA)[firstClass.className]?.savingThrows ?? [] : [];
  const savingThrows = sheetEntries([
    ...baseSaves.map((key) => ABILITY_NAMES[key]),
    ...fixedFeatureNames(features, "savingThrows").map(normalizeSavingThrowName),
    ...choicePickNames(features, character, "savingThrows", items),
  ]);
  const armorNames = [
    ...classBase.armor,
    ...recordedMulticlass.flatMap((mp) => mp.armor ?? []),
    ...race.armor,
    ...fixedFeatureNames(features, "armor"),
  ].map(normalizeArmorProficiency);
  const weaponNames = [
    ...classBase.weapons,
    ...recordedMulticlass.flatMap((mp) => mp.weapons ?? []),
    ...legacyWeaponNames(character),
    ...race.weapons,
    ...fixedFeatureNames(features, "weapons"),
    ...choicePickNames(features, character, "weapons", items),
  ];

  const skillNames = [
    ...legacySkillNames(character, ancestry, listings, features),
    ...(character.chosenSkills ?? []).map(normalizeSkillName),
    ...choicePickNames(features, character, "skills", items),
    ...knowledgeExpertiseSkills(character),
  ];

  const toolRules = sheetEntries(tools);
  const languageRules = sheetEntries(languages);
  return {
    tools: [...toolRules, ...addedSheetEntries(character.addedTools, "tools", toolRules)],
    languages: [...languageRules, ...addedSheetEntries(character.addedLanguages, "languages", languageRules)],
    armor: sheetEntries(armorNames),
    weapons: sheetEntries(deduplicateWeaponProficiencies(weaponNames)),
    savingThrows,
    skills: sheetEntries(skillNames),
  };
}
