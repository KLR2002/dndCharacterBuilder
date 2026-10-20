import type { AbilityKey, AbilityScores, Character } from "../types/character.ts";
import type { ResolvedAncestry } from "./types.ts";
export { POINT_BUY_COST, STANDARD_ARRAY } from "../constants/rules.ts";

export const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
/** Each ability's full name, as the Catalog writes it in proficiency grants and requirements. */
export const ABILITY_NAMES: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};
export function getAbilityModifier(score: number): number { return Math.floor((score - 10) / 2); }
export function formatModifier(mod: number): string { return mod >= 0 ? `+${mod}` : `${mod}`; }
export function effectiveScores(character: Character, opts: ResolvedAncestry = {}): { scores: AbilityScores; modifiers: AbilityScores } {
  const defaultBase = character.abilityMethod === "pointBuy" ? 8 : 10;
  const scores = {
    str: character.baseAbilityScores?.str ?? defaultBase,
    dex: character.baseAbilityScores?.dex ?? defaultBase,
    con: character.baseAbilityScores?.con ?? defaultBase,
    int: character.baseAbilityScores?.int ?? defaultBase,
    wis: character.baseAbilityScores?.wis ?? defaultBase,
    cha: character.baseAbilityScores?.cha ?? defaultBase,
  };
  const racial = character.racialAbilityBonuses || {};
  const increases = Object.keys(racial).length ? [racial] : [
    ...(opts.race?.abilityScoreIncrease || []), ...(opts.subrace?.abilityScoreIncrease || []),
  ];
  for (const selection of [...(character.asiSelections || []), ...(character.originFeats || [])]) {
    if (selection.asi) {
      increases.push(selection.asi);
    } else if (selection.type === "feat" && selection.featAbility) {
      increases.push({ [selection.featAbility]: 1 });
    }
  }
  for (const increase of increases) {
    for (const [name, value] of Object.entries(increase)) {
      const key = name.toLowerCase() as AbilityKey;
      if (ABILITIES.includes(key) && Number.isFinite(value)) scores[key] += value;
    }
  }
  const modifiers = { ...scores };
  for (const key of ABILITIES) modifiers[key] = getAbilityModifier(scores[key]);
  return { scores, modifiers };
}
export function hasFeat(character: Character, name: string): boolean {
  const norm = name.toLowerCase();
  const fromAsi = (character.asiSelections || []).some(s => s.type === "feat" && s.featName?.toLowerCase() === norm);
  const fromOrigin = (character.originFeats || []).some(s => s.type === "feat" && s.featName?.toLowerCase() === norm);
  return fromAsi || fromOrigin;
}
