import type { Character } from "../types/character.ts";
import type { CharacterCatalogs } from "./catalogs.ts";
import { ALL_LANGUAGE_NAMES, ALL_TOOLS } from "./proficienciesAndLanguages.ts";
import { normalizeAddedName, proficiencySheet } from "./proficiencySheet.ts";

/** The two categories a player can add to by hand (Added Proficiency). Skills, weapons and armor cannot. */
export type AddedCategory = "tools" | "languages";

export type AddProficiencyResult =
  | { ok: true; character: Character }
  | { ok: false; reason: "empty" | "held" };

/** Known tools or languages the player can pick, minus everything the Proficiency Sheet already holds. */
export function addedProficiencyOptions(
  character: Character,
  catalogs: CharacterCatalogs,
  category: AddedCategory,
): string[] {
  const held = new Set(proficiencySheet(character, catalogs)[category].map((entry) => entry.name.toLowerCase()));
  const known = category === "tools" ? ALL_TOOLS : ALL_LANGUAGE_NAMES;
  return known.filter((name) => !held.has(name.toLowerCase()));
}

/**
 * Records a tool or language by hand. Rejects an empty name and anything the sheet already holds,
 * rule-granted or added, matched case-insensitively. A known name is stored with its known spelling.
 */
export function addAddedProficiency(
  character: Character,
  catalogs: CharacterCatalogs,
  category: AddedCategory,
  raw: string,
): AddProficiencyResult {
  const name = normalizeAddedName(category, raw);
  if (!name) return { ok: false, reason: "empty" };
  const key = name.toLowerCase();
  if (proficiencySheet(character, catalogs)[category].some((entry) => entry.name.toLowerCase() === key)) {
    return { ok: false, reason: "held" };
  }
  return category === "tools"
    ? { ok: true, character: { ...character, addedTools: [...(character.addedTools ?? []), name] } }
    : { ok: true, character: { ...character, addedLanguages: [...(character.addedLanguages ?? []), name] } };
}

/**
 * Removes an added entry, matched case-insensitively. A name that is only rule-granted has no stored
 * entry, so nothing changes; rule-granted entries cannot be removed.
 */
export function removeAddedProficiency(character: Character, category: AddedCategory, raw: string): Character {
  const key = raw.trim().toLowerCase();
  if (category === "tools") {
    return { ...character, addedTools: (character.addedTools ?? []).filter((name) => name.trim().toLowerCase() !== key) };
  }
  return {
    ...character,
    addedLanguages: (character.addedLanguages ?? []).filter((name) => name.trim().toLowerCase() !== key),
  };
}
