import type { AbilityKey, Character } from "../types/character.ts";
import type { ResolvedAncestry } from "./types.ts";
import { CLASS_DATA, type ClassRules } from "./classData.ts";
import { ABILITIES, effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";

export function savingThrows(character: Character, classes: Record<string, ClassRules> = CLASS_DATA, opts: ResolvedAncestry = {}) {
  const { modifiers } = effectiveScores(character, opts);
  const prof = proficiencyBonus(totalLevel(character));
  const saves = classes[character.classes[0]?.className]?.savingThrows || [];
  const result = {} as Record<AbilityKey, { proficient: boolean; isProficient: boolean; bonus: number }>;
  for (const key of ABILITIES) {
    const proficient = saves.includes(key);
    result[key] = { proficient, isProficient: proficient, bonus: modifiers[key] + (proficient ? prof : 0) };
  }
  return result;
}
