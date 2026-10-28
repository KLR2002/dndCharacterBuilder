import type { AbilityKey, CharacterClass } from "../types/character.ts";
import type { ClassData } from "../types/dnd5e.ts";
import { srdBaselineClasses } from "../services/compendium.ts";
import { allCatalogClasses, findClassData } from "./catalogs.ts";
import { abilityKeyOf } from "./abilities.ts";
export { MULTICLASS_PREREQUISITES } from "../constants/rules.ts";

/**
 * The Catalog class an entry holds: the class of its name and source in `classes`, else the SRD Baseline's
 * class of that name, so a catalog that lacks a class still gives its SRD values. Undefined for a class
 * neither has (an invented or unknown class). `classes` defaults to every class in the process-wide Compendium.
 */
export function heldClass(entry: { className: string; source?: string }, classes: readonly ClassData[] = allCatalogClasses()): ClassData | undefined {
  return findClassData(classes, entry) ?? findClassData(srdBaselineClasses(), entry);
}

/** The hit die a class without one in the Catalog rolls: the d8 every rule falls back to. */
const DEFAULT_HIT_DIE = 8;

export function hitDieOf(entry: CharacterClass, classes?: readonly ClassData[]): number {
  const faces = /^1d(\d+)$/.exec(heldClass(entry, classes)?.hitDie ?? "")?.[1];
  return faces ? Number(faces) : DEFAULT_HIT_DIE;
}

/** The caster kinds the class-level rules tell apart. A progression with no kind here casts by its own rule, or not at all. */
export type CasterKind = "full" | "half" | "artificer" | "pact";

/** The caster kind of a Catalog spellcasting progression. Anything else has no kind here. */
export function casterKindOfProgression(progression: string | undefined): CasterKind | undefined {
  if (progression === "full") return "full";
  if (progression === "1/2") return "half";
  if (progression === "artificer") return "artificer";
  if (progression === "pact") return "pact";
  return undefined;
}

export function casterKindOf(entry: CharacterClass, classes?: readonly ClassData[]): CasterKind | undefined {
  return casterKindOfProgression(heldClass(entry, classes)?.spellcasting?.progression);
}

export function spellAbilityOf(entry: CharacterClass, classes?: readonly ClassData[]): AbilityKey | undefined {
  return abilityKeyOf(heldClass(entry, classes)?.spellcasting?.ability);
}

export const THIRD_CASTERS: Record<string, string> = { Fighter: "Eldritch Knight", Rogue: "Arcane Trickster" };
export function isThirdCaster(c: CharacterClass): boolean {
  return c.level >= 3 && c.subclassName !== undefined && THIRD_CASTERS[c.className] === c.subclassName;
}
export function spellcastingAbility(c: CharacterClass, classes?: readonly ClassData[]): AbilityKey | undefined {
  return isThirdCaster(c) ? "int" : spellAbilityOf(c, classes);
}
// PHB individual paladin/ranger progression (NOT floor(level / 2) multiclass slots).
export function asiLevels(name: string): number[] {
  return name === "Fighter" ? [4, 6, 8, 12, 14, 16, 19] : name === "Rogue" ? [4, 8, 10, 12, 16, 19] : [4, 8, 12, 16, 19];
}
export const PHB_HALF_CASTER_SLOTS: Record<number, number[]> = {
  1: [], 2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2],
  7: [4, 3], 8: [4, 3], 9: [4, 3, 2], 10: [4, 3, 2],
  11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1], 14: [4, 3, 3, 1],
  15: [4, 3, 3, 2], 16: [4, 3, 3, 2], 17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1],
  19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2],
};
/** The Artificer's own table: the half-caster table, with two 1st-level slots from level 1. */
export const ARTIFICER_SLOTS: Record<number, number[]> = { ...PHB_HALF_CASTER_SLOTS, 1: [2] };
export const PHB_THIRD_CASTER_SLOTS: Record<number, number[]> = {
  3: [2], 4: [3], 5: [3], 6: [3], 7: [4, 2], 8: [4, 2], 9: [4, 2],
  10: [4, 3], 11: [4, 3], 12: [4, 3], 13: [4, 3, 2], 14: [4, 3, 2], 15: [4, 3, 2],
  16: [4, 3, 3], 17: [4, 3, 3], 18: [4, 3, 3], 19: [4, 3, 3, 1], 20: [4, 3, 3, 1],
};
