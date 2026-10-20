import type { Character } from "../types/character.ts";
import type { CharacterCatalogs } from "./catalogs.ts";
import {
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

/**
 * The Proficiency Sheet. The catalog bundle is required: a call site must say which Compendium it
 * reads, because a default that means "no catalog" silently empties the lists (quick fix 04).
 */
export function proficiencySheet(character: Character, catalogs: CharacterCatalogs): ProficiencySheet {
  const tools = resolveCharacterTools(character, catalogs);
  const languages = withLanguageFallbacks(structuredLanguages(character, catalogs), character);
  return {
    tools: sheetEntries(tools),
    languages: sheetEntries(languages),
  };
}
