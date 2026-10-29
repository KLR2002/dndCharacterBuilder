import type { AbilityKey, Character } from "../types/character.ts";
import { ALL_BOOKS } from "../constants/books.ts";
import type { CharacterCatalogs } from "./catalogs.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";
import { MUSICAL_INSTRUMENTS } from "./proficienciesAndLanguages.ts";
import { proficiencySheet } from "./proficiencySheet.ts";

export interface EvaluatedTool {
  name: string;
  isExpertise: boolean;
  ability?: AbilityKey;
  bonus: number;
  displayModifier: string;
  label: string;
}

export const CANONICAL_TOOL_ABILITIES: Record<string, AbilityKey> = {
  "thieves' tools": "dex",
  "herbalism kit": "wis",
  "navigator's tools": "wis",
  "disguise kit": "cha",
  "forgery kit": "dex",
  "poisoner's kit": "int",
};

export function hasArtificerToolExpertise(character: Character): boolean {
  return (character.classes || []).some(
    (c) => c.className.toLowerCase() === "artificer" && c.level >= 6
  );
}

export function isToolExpertise(toolName: string, character: Character): boolean {
  if (hasArtificerToolExpertise(character)) return true;
  const clean = toolName.trim().toLowerCase();
  return (character.chosenExpertise || []).some(
    (e) => e.trim().toLowerCase() === clean
  );
}

export function getToolAbility(toolName: string): AbilityKey | undefined {
  const clean = toolName.trim().toLowerCase();
  if (CANONICAL_TOOL_ABILITIES[clean]) {
    return CANONICAL_TOOL_ABILITIES[clean];
  }
  if (MUSICAL_INSTRUMENTS.some((m) => m.toLowerCase() === clean)) {
    return "cha";
  }
  return undefined;
}

export function evaluateCharacterTools(
  character: Character,
  catalogs?: CharacterCatalogs
): EvaluatedTool[] {
  const toolNames = proficiencySheet(character, catalogs ?? { activeBooks: ALL_BOOKS }).tools.map((t) => t.name);
  const pb = proficiencyBonus(totalLevel(character));
  const { modifiers } = effectiveScores(character);

  return toolNames.map((name) => {
    const isExp = isToolExpertise(name, character);
    const multiplier = isExp ? 2 : 1;
    const ability = getToolAbility(name);

    if (ability) {
      const abilityMod = modifiers[ability] ?? 0;
      const totalBonus = abilityMod + multiplier * pb;
      const sign = totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`;
      const abilityLabel = ability.charAt(0).toUpperCase() + ability.slice(1);
      return {
        name,
        isExpertise: isExp,
        ability,
        bonus: totalBonus,
        displayModifier: sign,
        label: `${name} (${sign}, ${abilityLabel})`,
      };
    }

    const flatBonus = multiplier * pb;
    return {
      name,
      isExpertise: isExp,
      bonus: flatBonus,
      displayModifier: `+${flatBonus} PB`,
      label: `${name} (+${flatBonus} PB)`,
    };
  });
}
