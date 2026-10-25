import type { AbilityKey, Character, CharacterClass } from "../types/character.ts";

/** The two SRD half-proficiency rules: Jack of All Trades (Bard) and Remarkable Athlete (Champion Fighter). */
export type HalfProficiencyRule = "Jack of All Trades" | "Remarkable Athlete";

export interface HalfProficiency {
  rule: HalfProficiencyRule;
  bonus: number;
}

/** Remarkable Athlete reaches Strength, Dexterity and Constitution checks. */
const REMARKABLE_ATHLETE_ABILITIES: readonly AbilityKey[] = ["str", "dex", "con"];

const isBardOfSecondOrHigher = (c: CharacterClass) => c.className === "Bard" && c.level >= 2;

const isChampionOfSeventhOrHigher = (c: CharacterClass) =>
  c.className === "Fighter" &&
  c.level >= 7 &&
  (c.subclassName || c.subclass || "").trim().toLowerCase() === "champion";

/**
 * The half-proficiency rule that applies to a check of `ability`, or null when none does. Jack of All Trades adds
 * half the proficiency bonus rounded down; Remarkable Athlete adds it rounded up, on Strength, Dexterity and
 * Constitution checks. Only the higher applies, so a multiclass character never gets both. On a tie the line is
 * named Remarkable Athlete. The caller decides whether the check is one the rule covers (a skill the character
 * is not proficient in, or initiative).
 */
export function halfProficiencyFor(character: Character, ability: AbilityKey, proficiencyBonus: number): HalfProficiency | null {
  const classes = character.classes || [];
  const jack: HalfProficiency | null = classes.some(isBardOfSecondOrHigher)
    ? { rule: "Jack of All Trades", bonus: Math.floor(proficiencyBonus / 2) }
    : null;
  const athlete: HalfProficiency | null =
    REMARKABLE_ATHLETE_ABILITIES.includes(ability) && classes.some(isChampionOfSeventhOrHigher)
      ? { rule: "Remarkable Athlete", bonus: Math.ceil(proficiencyBonus / 2) }
      : null;
  if (!jack || (athlete && athlete.bonus >= jack.bonus)) return athlete;
  return jack;
}
