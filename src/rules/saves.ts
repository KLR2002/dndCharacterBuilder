import type { AbilityKey, Character } from "../types/character.ts";
import type { ResolvedAncestry } from "./types.ts";
import { ABILITIES, ABILITY_NAMES, effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";
import type { SheetEntry } from "./proficiencySheet.ts";

/**
 * Saving-throw bonuses. Proficiency comes from the Proficiency Sheet's saving throws (ticket 07), so
 * the card, evaluation and any other reader agree on which saves the character has.
 */
export function savingThrows(character: Character, sheetSaves: readonly SheetEntry[], opts: ResolvedAncestry = {}) {
  const { modifiers } = effectiveScores(character, opts);
  const prof = proficiencyBonus(totalLevel(character));
  const held = new Set(sheetSaves.map((entry) => entry.name.toLowerCase()));
  const result = {} as Record<AbilityKey, { proficient: boolean; isProficient: boolean; bonus: number }>;
  for (const key of ABILITIES) {
    const proficient = held.has(ABILITY_NAMES[key].toLowerCase());
    result[key] = { proficient, isProficient: proficient, bonus: modifiers[key] + (proficient ? prof : 0) };
  }
  return result;
}
