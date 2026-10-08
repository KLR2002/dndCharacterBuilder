// Compatibility adapter: only catalog resolution belongs here; calculations stay pure.
import type { Character } from "../types/character.ts";
import { getRaces, getBackgrounds, getClasses } from "./dataService";
import {
  evaluateCharacter as evaluateCharacterRules,
  type CharacterCatalogs,
  type EvaluatedCharacter,
} from "../rules/characterEvaluation.ts";

export { getAbilityModifier, formatModifier } from "../rules/abilities.ts";
export { totalLevel as calculateTotalLevel, proficiencyBonus as calculateProficiencyBonus } from "../rules/proficiencies.ts";
export { multiclassSlots as calculateMulticlassSpellSlots, pactSlots } from "../rules/slots.ts";
export { hitDiceByType } from "../rules/hp.ts";
export { grantedFeatures } from "../rules/grantedFeatures.ts";
export { getHitDicePools, spendHitDie, recoverHitDie } from "../rules/hitDice.ts";
export { type EvaluatedCharacter, type CharacterCatalogs } from "../rules/characterEvaluation.ts";

export function evaluateCharacter(
  character: Character,
  catalogs?: CharacterCatalogs
): EvaluatedCharacter {
  const resolved: CharacterCatalogs = {
    races: catalogs?.races ?? getRaces(catalogs?.activeBooks),
    backgrounds: catalogs?.backgrounds ?? getBackgrounds(catalogs?.activeBooks),
    classes: catalogs?.classes ?? getClasses(catalogs?.activeBooks),
    classRules: catalogs?.classRules,
    activeBooks: catalogs?.activeBooks,
  };
  return evaluateCharacterRules(character, resolved);
}

// Backward-compatible delegates powered by evaluateCharacter
export function calculateEffectiveAbilityScores(character: Character) {
  return evaluateCharacter(character).effectiveScores;
}
export function calculateMaxHp(character: Character) {
  return evaluateCharacter(character).hp.max;
}
export function calculateArmorClass(character: Character) {
  return evaluateCharacter(character).armorClass;
}
export function calculateSpeed(character: Character) {
  return evaluateCharacter(character).speed;
}
export function calculateSpeeds(character: Character) {
  return evaluateCharacter(character).speeds;
}
export function calculateSavingThrows(character: Character) {
  return evaluateCharacter(character).saves;
}
export function calculateSkills(character: Character) {
  return evaluateCharacter(character).skills;
}
export function calculateCarryingWeight(character: Character) {
  return evaluateCharacter(character).carryingWeight;
}

