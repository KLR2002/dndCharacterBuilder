// Compatibility adapter: only catalog resolution belongs here; calculations stay pure.
import type { Character } from "../types/character.ts";
import { findRace, findBackground } from "./dataService";
import { effectiveScores } from "../rules/abilities.ts";
import { maxHp } from "../rules/hp.ts";
import { armorClass } from "../rules/ac.ts";
import { speed, carryingWeight } from "../rules/speed.ts";
import { savingThrows } from "../rules/saves.ts";
import { skills } from "../rules/skills.ts";

export { getAbilityModifier, formatModifier } from "../rules/abilities.ts";
export { totalLevel as calculateTotalLevel, proficiencyBonus as calculateProficiencyBonus } from "../rules/proficiencies.ts";
export { multiclassSlots as calculateMulticlassSpellSlots, pactSlots } from "../rules/slots.ts";
export { hitDiceByType } from "../rules/hp.ts";
export { grantedFeatures } from "../rules/grantedFeatures.ts";

function ancestry(character: Character) {
  const choice = character.race;
  const race = choice ? findRace(choice.name, choice.source) : undefined;
  const subrace = race?.subraces.find(s => s.name === choice?.subraceName && (!choice.subraceSource || s.source === choice.subraceSource));
  return { race, subrace };
}
export function calculateEffectiveAbilityScores(character: Character) {
  return effectiveScores(character, ancestry(character));
}
export function calculateMaxHp(character: Character) {
  return maxHp(character, ancestry(character));
}
export function calculateArmorClass(character: Character) {
  return armorClass(character, ancestry(character));
}
export function calculateSpeed(character: Character) {
  return speed(character, ancestry(character));
}
export function calculateSavingThrows(character: Character) {
  return savingThrows(character, undefined, ancestry(character));
}
export function calculateSkills(character: Character) {
  const bg = character.background ? findBackground(character.background.name, character.background.source) : undefined;
  return skills(character, {
    ...ancestry(character),
    backgrounds: bg ? [bg] : undefined,
  });
}
export function calculateCarryingWeight(character: Character) {
  return carryingWeight(character, ancestry(character));
}
