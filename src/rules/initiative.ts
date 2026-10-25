import type { AbilityScores } from "../types/character.ts";
import type { InitiativeBonus } from "../types/dnd5e.ts";
import type { FeatureInstance } from "./types.ts";
import type { HalfProficiency } from "./halfProficiency.ts";

/** One line of the initiative breakdown: where a part of the initiative comes from, and its value. */
export interface InitiativePart {
  label: string;
  value: number;
}

export interface Initiative {
  total: number;
  breakdown: InitiativePart[];
}

/**
 * Initiative is the Dexterity modifier plus every Initiative Bonus the character's features carry (ADR 0016), plus
 * the half-proficiency rule that applies to a Dexterity check, if any. The breakdown lists Dexterity first, then
 * each bonus that contributes, labelled with its feature, in feature order, then the half-proficiency line last.
 * A feature instance counts once. An ability-modifier bonus never counts below 0, so it adds no line when it is 0.
 */
export function initiativeOf(
  features: FeatureInstance[],
  modifiers: AbilityScores,
  proficiencyBonus: number,
  halfProficiency: HalfProficiency | null,
): Initiative {
  const breakdown: InitiativePart[] = [{ label: "Dexterity", value: modifiers.dex }];
  const counted = new Set<string>();
  for (const feature of features) {
    if (!feature.initiativeBonus || counted.has(feature.id)) continue;
    counted.add(feature.id);
    const value = bonusValue(feature.initiativeBonus, modifiers, proficiencyBonus);
    if (value !== 0) breakdown.push({ label: feature.name, value });
  }
  if (halfProficiency) breakdown.push({ label: halfProficiency.rule, value: halfProficiency.bonus });
  return { total: breakdown.reduce((sum, part) => sum + part.value, 0), breakdown };
}

function bonusValue(bonus: InitiativeBonus, modifiers: AbilityScores, proficiencyBonus: number): number {
  switch (bonus.kind) {
    case "ability":
      return Math.max(0, modifiers[bonus.ability]);
    case "proficiency":
      return proficiencyBonus;
    case "flat":
      return bonus.value;
  }
}
