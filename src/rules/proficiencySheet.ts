import type { Character } from "../types/character.ts";
import type { ProficiencyCategory } from "../types/dnd5e.ts";
import { catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { grantedFeatures } from "./grantedFeatures.ts";
import type { FeatureInstance } from "./types.ts";
import {
  ALL_LANGUAGE_NAMES,
  normalizeToolName,
  resolveCharacterTools,
  structuredLanguages,
  withLanguageFallbacks,
} from "./proficienciesAndLanguages.ts";

/** One entry on the Proficiency Sheet. Hand-added entries (ticket 06) will be `ruleGranted: false`. */
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

/** A known language's own spelling, or the name as written with each word capitalized. */
export function normalizeLanguageName(raw: string): string {
  const clean = raw.trim();
  const known = ALL_LANGUAGE_NAMES.find((name) => name.toLowerCase() === clean.toLowerCase());
  if (known) return known;
  return clean
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** The fixed names of one category across the features the character has now. Choice grants wait for their slice. */
function fixedFeatureNames(features: FeatureInstance[], category: ProficiencyCategory): string[] {
  return features.flatMap((feature) =>
    (feature.grants ?? []).flatMap((grant) => (grant.kind === "fixed" && grant.category === category ? grant.names : [])),
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
  ];
  const languages = withLanguageFallbacks(
    [...structuredLanguages(character, catalogs), ...fixedFeatureNames(features, "languages").map(normalizeLanguageName)],
    character,
  );
  return {
    tools: sheetEntries(tools),
    languages: sheetEntries(languages),
  };
}
