import type { Character } from "../types/character.ts";
import type { RulesOptions, ResolvedAncestry } from "./types.ts";
import { armorCategory } from "./ac.ts";
import { effectiveScores } from "./abilities.ts";

export function speed(character: Character, opts: RulesOptions = {}): number {
  let value = opts.subrace?.speed?.walk ?? opts.race?.speed?.walk ?? 30;
  const equipped = (opts.items ?? character.items).filter(i => i.isEquipped);
  const monk = character.classes.find(c => c.className === "Monk")?.level || 0;
  if (monk >= 2 && !equipped.some(i => armorCategory(i))) value += 10 + Math.floor((monk - 2) / 4) * 5;
  const barbarian = character.classes.find(c => c.className === "Barbarian")?.level || 0;
  if (barbarian >= 5 && !equipped.some(i => armorCategory(i) === "heavy")) value += 10;
  return value;
}
export function carryingWeight(character: Character, opts: ResolvedAncestry = {}) {
  const { str } = effectiveScores(character, opts).scores;
  const coins = Object.values(character.pouch).reduce((sum, value) => sum + value, 0);
  const weight = character.items.reduce((sum, item) => sum + (item.weight ?? 0) * (item.quantity ?? 1), 0) + coins / 50;
  return { currentWeight: Math.round(weight * 10) / 10, maxCapacity: str * 15, encumbered: weight > str * 5, heavilyEncumbered: weight > str * 10 };
}
