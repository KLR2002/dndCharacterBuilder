import type { AbilityKey } from "../types/character.ts";
import { ABILITY_NAMES } from "./abilities.ts";

/**
 * The Roll Log sources of the Stats tab's roll badges: an ability check reads "Strength check", a saving
 * throw "Wisdom save", a skill its own name ("Athletics") and initiative "Initiative". The badges read the
 * bonuses from the Evaluated Character Engine and the Proficiency Sheet; this module only names the rolls.
 */

/** The Roll Log source of an ability check, like "Strength check". */
export function checkSource(ability: AbilityKey): string {
  return `${ABILITY_NAMES[ability]} check`;
}

/** The Roll Log source of a saving throw, like "Wisdom save". */
export function saveSource(ability: AbilityKey): string {
  return `${ABILITY_NAMES[ability]} save`;
}

/** The Roll Log source of the initiative roll. */
export const INITIATIVE_SOURCE = "Initiative";
