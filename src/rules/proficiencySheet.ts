import type { Character } from "../types/character.ts";
import type { ProficiencyCategory } from "../types/dnd5e.ts";
import { catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { grantedFeatures } from "./grantedFeatures.ts";
import type { FeatureInstance } from "./types.ts";
import {
  ALL_LANGUAGE_NAMES,
  ALL_TOOLS,
  normalizeToolName,
  resolveCharacterTools,
  structuredLanguages,
  withLanguageFallbacks,
} from "./proficienciesAndLanguages.ts";
import { normalizeLanguageName, normalizeSavingThrowName, validPicks, type PickableCategory } from "./proficiencyPools.ts";
import { ABILITY_NAMES } from "./abilities.ts";
import { CLASS_DATA } from "./classData.ts";

/** One entry on the Proficiency Sheet. Added Proficiencies are `ruleGranted: false`. */
export interface SheetEntry {
  name: string;
  ruleGranted: boolean;
}

/**
 * What a character is proficient in, for the categories the sheet covers so far. Derived on every
 * read and never stored (ADR 0015). The other categories join this type in later slices.
 */
export interface ProficiencySheet {
  tools: SheetEntry[];
  languages: SheetEntry[];
  /** Ability names, for example "Wisdom". Only the first class's saves are a base; the rest come from grants. */
  savingThrows: SheetEntry[];
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

/** The saved picks of one pickable category, for the choice grants on the features the character has now. */
function choicePickNames(features: FeatureInstance[], character: Character, category: PickableCategory): string[] {
  return features.flatMap((feature) =>
    (feature.grants ?? []).flatMap((grant) =>
      grant.kind === "choice" && grant.category === category
        ? validPicks(grant, character.proficiencyPicks?.[grant.id] ?? [])
        : [],
    ),
  );
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
  // The first class's saves are the base, as they have always been. A later class adds none of its own.
  const firstClass = character.classes[0];
  const baseSaves = firstClass ? (catalogs.classRules ?? CLASS_DATA)[firstClass.className]?.savingThrows ?? [] : [];
  const savingThrows = sheetEntries([
    ...baseSaves.map((key) => ABILITY_NAMES[key]),
    ...fixedFeatureNames(features, "savingThrows").map(normalizeSavingThrowName),
    ...choicePickNames(features, character, "savingThrows"),
  ]);
  const toolRules = sheetEntries(tools);
  const languageRules = sheetEntries(languages);
  return {
    tools: [...toolRules, ...addedSheetEntries(character.addedTools, "tools", toolRules)],
    languages: [...languageRules, ...addedSheetEntries(character.addedLanguages, "languages", languageRules)],
    savingThrows,
  };
}
