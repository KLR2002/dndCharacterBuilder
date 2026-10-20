import type { Character } from "../types/character.ts";
import type { ProficiencyCategory } from "../types/dnd5e.ts";
import { RACE_WEAPON_PROFICIENCIES } from "../constants/rules.ts";
import { catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { grantedFeatures } from "./grantedFeatures.ts";
import {
  deduplicateWeaponProficiencies,
  normalizeArmorProficiency,
  proficiencies as classBaseProficiencies,
} from "./proficiencies.ts";
import type { FeatureInstance } from "./types.ts";
import {
  ALL_LANGUAGE_NAMES,
  ALL_TOOLS,
  normalizeToolName,
  resolveCharacterTools,
  structuredLanguages,
  withLanguageFallbacks,
} from "./proficienciesAndLanguages.ts";
import { normalizeLanguageName, validPicks } from "./proficiencyPools.ts";

/** One entry on the Proficiency Sheet. Added Proficiencies are `ruleGranted: false`. */
export interface SheetEntry {
  name: string;
  ruleGranted: boolean;
}

/**
 * What a character is proficient in, for the categories the sheet covers so far. Derived on every
 * read and never stored (ADR 0015). Skills join this type in the last slice.
 */
export interface ProficiencySheet {
  tools: SheetEntry[];
  languages: SheetEntry[];
  armor: SheetEntry[];
  /** Categorical Weapon Proficiencies supersede the individual weapons they cover. */
  weapons: SheetEntry[];
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
function choicePickNames(features: FeatureInstance[], character: Character, category: ProficiencyCategory): string[] {
  return features.flatMap((feature) =>
    (feature.grants ?? []).flatMap((grant) =>
      grant.kind === "choice" && grant.category === category
        ? validPicks(grant, character.proficiencyPicks?.[grant.id] ?? [])
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

/**
 * The Proficiency Sheet. The catalog bundle is required: a call site must say which Compendium it
 * reads, because a default that means "no catalog" silently empties the lists (quick fix 04).
 */
export function proficiencySheet(character: Character, catalogs: CharacterCatalogs): ProficiencySheet {
  const listings = catalogListings(catalogs);
  const features = grantedFeatures(character, {
    races: listings.races(),
    classes: listings.classes(),
    backgrounds: listings.backgrounds(),
    feats: listings.feats(),
  });

  // Class base proficiencies (the first class's, and the multiclass table for the others), then the
  // multiclass proficiencies recorded on the character, then race training and the features' grants.
  const classBase = classBaseProficiencies(character, listings.classes());
  const recordedMulticlass = character.multiclassProficiencies ?? [];
  const race = raceTraining(character);

  const tools = [
    ...resolveCharacterTools(character, catalogs),
    ...fixedFeatureNames(features, "tools").map(normalizeToolName),
    ...choicePickNames(features, character, "tools"),
  ];
  const languages = withLanguageFallbacks(
    [
      ...structuredLanguages(character, catalogs),
      ...fixedFeatureNames(features, "languages").map(normalizeLanguageName),
      ...choicePickNames(features, character, "languages"),
    ],
    character,
  );
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
    ...choicePickNames(features, character, "weapons"),
  ];

  const toolRules = sheetEntries(tools);
  const languageRules = sheetEntries(languages);
  return {
    tools: [...toolRules, ...addedSheetEntries(character.addedTools, "tools", toolRules)],
    languages: [...languageRules, ...addedSheetEntries(character.addedLanguages, "languages", languageRules)],
    armor: sheetEntries(armorNames),
    weapons: sheetEntries(deduplicateWeaponProficiencies(weaponNames)),
  };
}
