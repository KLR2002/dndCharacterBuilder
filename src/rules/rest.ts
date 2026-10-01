import type { Character, ResourceCounter } from "../types/character.ts";
import { maxHp } from "./hp.ts";
import { totalLevel } from "./proficiencies.ts";

export interface ShortRestOptions {
  healedHp?: number;
  spentDice?: Record<string, number>;
}

/**
 * Applies the benefits of a Short Rest (1 hour in 5e rules):
 * - Resets warlock pact slots (`pactSlotsUsed = 0` and legacy `usedPactSlots = 0`).
 * - Resets resource counters with `resetOn === "short"`.
 * - Preserves resource counters with `resetOn === "long"`.
 * - Applies `healedHp` to `currentHp`, capped at `maxHp(character)`.
 * - Records spent dice into `usedHitDice`.
 */
export function applyShortRest(
  character: Character,
  options?: ShortRestOptions
): Character;
export function applyShortRest(
  character: Character,
  healedHp?: number,
  spentDice?: Record<string, number>
): Character;
export function applyShortRest(
  character: Character,
  optionsOrHealedHp?: ShortRestOptions | number,
  spentDiceArg?: Record<string, number>
): Character {
  let healedHp = 0;
  let spentDice: Record<string, number> | undefined;

  if (typeof optionsOrHealedHp === "number") {
    healedHp = optionsOrHealedHp;
    spentDice = spentDiceArg;
  } else if (optionsOrHealedHp && typeof optionsOrHealedHp === "object") {
    healedHp = optionsOrHealedHp.healedHp ?? 0;
    spentDice = optionsOrHealedHp.spentDice;
  }

  // Reset resource counters with resetOn === "short"
  const nextResourceCounters: Record<string, ResourceCounter> = {};
  for (const [key, counter] of Object.entries(character.resourceCounters ?? {})) {
    if (counter.resetOn === "short") {
      nextResourceCounters[key] = { ...counter, current: counter.max };
    } else {
      nextResourceCounters[key] = { ...counter };
    }
  }

  // Heal HP capped at maxHp
  const max = maxHp(character);
  const current = character.currentHp ?? 0;
  const nextHp = healedHp > 0 ? Math.min(max, current + healedHp) : current;

  // Record spent dice into usedHitDice
  const nextUsedHitDice: Record<string, number> = { ...(character.usedHitDice ?? {}) };
  if (spentDice) {
    for (const [die, count] of Object.entries(spentDice)) {
      if (typeof count === "number" && count > 0) {
        nextUsedHitDice[die] = (nextUsedHitDice[die] ?? 0) + count;
      }
    }
  }

  const nextDeathSaves =
    character.currentHp === 0 && nextHp > 0
      ? { successes: 0, failures: 0 }
      : character.deathSaves
        ? { ...character.deathSaves }
        : { successes: 0, failures: 0 };

  return {
    ...character,
    currentHp: nextHp,
    deathSaves: nextDeathSaves,
    pactSlotsUsed: 0,
    usedPactSlots: 0,
    usedHitDice: nextUsedHitDice,
    resourceCounters: nextResourceCounters,
  };
}

/**
 * Applies the benefits of a Long Rest (8 hours in 5e rules):
 * - Heals `currentHp` to full `maxHp(character)`.
 * - Resets `tempHp` to 0.
 * - Recovers at most `Math.max(1, Math.floor(totalLevel(character) / 2))` hit dice across used hit dice.
 * - Resets all resource counters (`resetOn === "short"` and `resetOn === "long"`).
 * - Resets `pactSlotsUsed`, legacy `usedPactSlots`, and `usedSpellSlots`.
 * - Decrements Exhaustion condition: e.g. "Exhaustion 2" -> "Exhaustion 1", "Exhaustion 1" -> removed, "Exhaustion" -> removed.
 *   Unrelated conditions like "Poisoned", "Blinded" are preserved.
 */
export function applyLongRest(
  character: Character,
  diceToRecover?: Record<string, number>
): Character {
  const max = maxHp(character);
  const maxDiceToRecover = Math.max(1, Math.floor(totalLevel(character) / 2));
  let remainingRecoveryBudget = maxDiceToRecover;
  const nextUsedHitDice: Record<string, number> = { ...(character.usedHitDice ?? {}) };

  if (diceToRecover && Object.keys(diceToRecover).length > 0) {
    for (const [die, requested] of Object.entries(diceToRecover)) {
      if (remainingRecoveryBudget <= 0) break;
      const currentlyUsed = Math.max(0, nextUsedHitDice[die] ?? 0);
      const toRecover = Math.min(currentlyUsed, Math.max(0, requested), remainingRecoveryBudget);
      nextUsedHitDice[die] = Math.max(0, currentlyUsed - toRecover);
      remainingRecoveryBudget -= toRecover;
    }
  } else {
    // Automatic recovery: recover largest dice first
    const dieKeys = Object.keys(nextUsedHitDice).sort((a, b) => {
      const faceA = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const faceB = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return faceB - faceA;
    });

    for (const die of dieKeys) {
      if (remainingRecoveryBudget <= 0) break;
      const currentlyUsed = Math.max(0, nextUsedHitDice[die] ?? 0);
      const toRecover = Math.min(currentlyUsed, remainingRecoveryBudget);
      nextUsedHitDice[die] = Math.max(0, currentlyUsed - toRecover);
      remainingRecoveryBudget -= toRecover;
    }
  }

  // Reset resource counters (both short and long)
  const nextResourceCounters: Record<string, ResourceCounter> = {};
  for (const [key, counter] of Object.entries(character.resourceCounters ?? {})) {
    if (counter.resetOn === "short" || counter.resetOn === "long") {
      nextResourceCounters[key] = { ...counter, current: counter.max };
    } else {
      nextResourceCounters[key] = { ...counter };
    }
  }

  // Decrement exhaustion condition
  const nextConditions: string[] = [];
  for (const condition of character.conditions ?? []) {
    const match = condition.match(/^exhaustion(?:\s+(\d+))?$/i);
    if (!match) {
      nextConditions.push(condition);
    } else {
      const level = match[1] ? parseInt(match[1], 10) : 1;
      const newLevel = level - 1;
      if (newLevel > 0) {
        nextConditions.push(`Exhaustion ${newLevel}`);
      }
    }
  }

  return {
    ...character,
    currentHp: max,
    tempHp: 0,
    deathSaves: { successes: 0, failures: 0 },
    usedHitDice: nextUsedHitDice,
    usedSpellSlots: {},
    pactSlotsUsed: 0,
    usedPactSlots: 0,
    sorceryPointsUsed: 0,
    resourceCounters: nextResourceCounters,
    conditions: nextConditions,
  };
}
