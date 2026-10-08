import type { Character } from "../types/character.ts";
import { CLASS_DATA, type ClassRules } from "./classData.ts";
import { effectiveScores } from "./abilities.ts";
import { maxHp, hitDiceByType } from "./hp.ts";
import { totalLevel } from "./proficiencies.ts";

export interface HitDiePool {
  total: number;
  used: number;
  remaining: number;
}

export interface SpendHitDieResult {
  character: Character;
  healed: number;
  roll: number;
  conMod: number;
}

export const VALID_HIT_DICE = new Set(["d4", "d6", "d8", "d10", "d12", "d20"]);

export function isValidHitDie(die: string): boolean {
  return VALID_HIT_DICE.has(die);
}

/**
 * Returns pools of hit dice categorized by die token ("d12", "d10", "d8", "d6").
 */
export function getHitDicePools(
  character: Character,
  classes: Record<string, ClassRules> = CLASS_DATA
): Record<string, HitDiePool> {
  return hitDiceByType(character, classes);
}

/**
 * Spends a single hit die of the given type, rolls for healing + CON modifier,
 * clamps to max HP (PHB 2014 min 0), and records the used die token.
 * Does not spend the die if already at max HP or if the pool is exhausted.
 */
export function spendHitDie(
  character: Character,
  die: string,
  options?: { roll?: number }
): SpendHitDieResult {
  const conMod = effectiveScores(character).modifiers.con ?? 0;
  if (!VALID_HIT_DICE.has(die)) {
    return { character, healed: 0, roll: 0, conMod };
  }

  const pools = getHitDicePools(character);
  const pool = pools[die];
  const max = maxHp(character);
  const current = character.currentHp ?? 0;

  if (!pool || pool.remaining <= 0 || current >= max) {
    return { character, healed: 0, roll: 0, conMod };
  }

  const faces = parseInt(die.replace(/\D/g, ""), 10) || 8;
  const roll = options?.roll ?? (Math.floor(Math.random() * faces) + 1);
  const healAmount = Math.max(0, roll + conMod);
  const nextHp = Math.min(max, current + healAmount);
  const actualHealed = Math.max(0, nextHp - current);

  const currentUsed = character.usedHitDice?.[die] ?? 0;
  const nextUsedHitDice = {
    ...(character.usedHitDice ?? {}),
    [die]: currentUsed + 1,
  };

  return {
    character: {
      ...character,
      currentHp: nextHp,
      usedHitDice: nextUsedHitDice,
    },
    healed: actualHealed,
    roll,
    conMod,
  };
}

/**
 * Recovers a single used hit die of the given type (or the first available used die).
 */
export function recoverHitDie(character: Character, die?: string): Character {
  if (die && !VALID_HIT_DICE.has(die)) return character;
  const nextUsedHitDice = { ...(character.usedHitDice ?? {}) };
  const pools = getHitDicePools(character);

  const targetDie =
    die ??
    Object.entries(pools).find(([d, p]) => VALID_HIT_DICE.has(d) && p.used > 0)?.[0];

  if (!targetDie) return character;

  const currentUsed = nextUsedHitDice[targetDie] ?? 0;
  if (currentUsed <= 0) return character;

  nextUsedHitDice[targetDie] = Math.max(0, currentUsed - 1);
  return {
    ...character,
    usedHitDice: nextUsedHitDice,
  };
}

/**
 * Recovers up to floor(totalLevel / 2) hit dice (min 1) during a Long Rest,
 * either matching a requested breakdown or recovering largest dice first.
 */
export function recoverHitDiceLongRest(
  character: Character,
  requested?: Record<string, number>
): Character {
  const maxDiceToRecover = Math.max(1, Math.floor(totalLevel(character) / 2));
  let remainingBudget = maxDiceToRecover;
  const nextUsedHitDice = { ...(character.usedHitDice ?? {}) };

  if (requested && Object.keys(requested).length > 0) {
    for (const [die, count] of Object.entries(requested)) {
      if (!VALID_HIT_DICE.has(die)) continue;
      if (remainingBudget <= 0) break;
      const currentlyUsed = Math.max(0, nextUsedHitDice[die] ?? 0);
      const toRecover = Math.min(currentlyUsed, Math.max(0, count), remainingBudget);
      nextUsedHitDice[die] = Math.max(0, currentlyUsed - toRecover);
      remainingBudget -= toRecover;
    }
  } else {
    // Largest dice first
    const dieKeys = Object.keys(nextUsedHitDice)
      .filter((die) => VALID_HIT_DICE.has(die))
      .sort((a, b) => {
        const faceA = parseInt(a.replace(/\D/g, ""), 10) || 0;
        const faceB = parseInt(b.replace(/\D/g, ""), 10) || 0;
        return faceB - faceA;
      });

    for (const die of dieKeys) {
      if (remainingBudget <= 0) break;
      const currentlyUsed = Math.max(0, nextUsedHitDice[die] ?? 0);
      const toRecover = Math.min(currentlyUsed, remainingBudget);
      nextUsedHitDice[die] = Math.max(0, currentlyUsed - toRecover);
      remainingBudget -= toRecover;
    }
  }

  return {
    ...character,
    usedHitDice: nextUsedHitDice,
  };
}
