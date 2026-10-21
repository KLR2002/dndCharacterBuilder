import type { AbilityKey, CharacterClass } from "../types/character.ts";
import type { ClassData } from "../types/dnd5e.ts";
import { srdBaselineClasses } from "../services/compendium.ts";
import { allCatalogClasses, findClassData } from "./catalogs.ts";
export { MULTICLASS_PREREQUISITES } from "../constants/rules.ts";

export interface ClassRules {
  hitDie: number;
  savingThrows: AbilityKey[];
  caster?: "full" | "half" | "pact";
  spellAbility?: AbilityKey;
}
export const CLASS_DATA: Record<string, ClassRules> = {
  Barbarian: { hitDie: 12, savingThrows: ["str", "con"] },
  Bard: { hitDie: 8, savingThrows: ["dex", "cha"], caster: "full", spellAbility: "cha" },
  Cleric: { hitDie: 8, savingThrows: ["wis", "cha"], caster: "full", spellAbility: "wis" },
  Druid: { hitDie: 8, savingThrows: ["int", "wis"], caster: "full", spellAbility: "wis" },
  Fighter: { hitDie: 10, savingThrows: ["str", "con"] },
  Monk: { hitDie: 8, savingThrows: ["str", "dex"] },
  Paladin: { hitDie: 10, savingThrows: ["wis", "cha"], caster: "half", spellAbility: "cha" },
  Ranger: { hitDie: 10, savingThrows: ["str", "dex"], caster: "half", spellAbility: "wis" },
  Rogue: { hitDie: 8, savingThrows: ["dex", "int"] },
  Sorcerer: { hitDie: 6, savingThrows: ["con", "cha"], caster: "full", spellAbility: "cha" },
  Warlock: { hitDie: 8, savingThrows: ["wis", "cha"], caster: "pact", spellAbility: "cha" },
  Wizard: { hitDie: 6, savingThrows: ["int", "wis"], caster: "full", spellAbility: "int" },
};
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

export const THIRD_CASTERS: Record<string, string> = { Fighter: "Eldritch Knight", Rogue: "Arcane Trickster" };
export function isThirdCaster(c: CharacterClass): boolean {
  return c.level >= 3 && c.subclassName !== undefined && THIRD_CASTERS[c.className] === c.subclassName;
}
export function spellcastingAbility(c: CharacterClass): AbilityKey | undefined {
  return isThirdCaster(c) ? "int" : CLASS_DATA[c.className]?.spellAbility;
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
export const PHB_THIRD_CASTER_SLOTS: Record<number, number[]> = {
  3: [2], 4: [3], 5: [3], 6: [3], 7: [4, 2], 8: [4, 2], 9: [4, 2],
  10: [4, 3], 11: [4, 3], 12: [4, 3], 13: [4, 3, 2], 14: [4, 3, 2], 15: [4, 3, 2],
  16: [4, 3, 3], 17: [4, 3, 3], 18: [4, 3, 3], 19: [4, 3, 3, 1], 20: [4, 3, 3, 1],
};
