// Pure hit point arithmetic shared by the Stats tab and the HP quick-edit modal.
// Every function returns the patch to store: { currentHp, tempHp } plus deathSaves when HP ends above 0.
// Nothing here touches storage.

export interface HitPointState {
  currentHp: number;
  tempHp: number;
}

export interface HitPointPatch extends HitPointState {
  /** Present only when the resulting current HP is above 0. Death saves are cleared then. */
  deathSaves?: { successes: 0; failures: 0 };
}

/**
 * Death saves are cleared whenever current HP ends above 0, by any route. A character at 0 HP
 * keeps its saves, so that key is left out of the patch.
 */
function withDeathSaves(state: HitPointState): HitPointPatch {
  if (state.currentHp > 0) return { ...state, deathSaves: { successes: 0, failures: 0 } };
  return state;
}

/** Temp HP absorbs the hit first; whatever is left comes off current HP, which floors at 0. */
export function damage(state: HitPointState, amount: number): HitPointPatch {
  let temp = state.tempHp;
  let remaining = amount;

  if (temp > 0) {
    if (remaining <= temp) {
      temp -= remaining;
      remaining = 0;
    } else {
      remaining -= temp;
      temp = 0;
    }
  }

  return withDeathSaves({ currentHp: Math.max(0, state.currentHp - remaining), tempHp: temp });
}

/** Adds to current HP, capped at max HP. Temp HP is not affected. */
export function heal(state: HitPointState, amount: number, maxHp: number): HitPointPatch {
  return withDeathSaves({ currentHp: Math.min(maxHp, state.currentHp + amount), tempHp: state.tempHp });
}

/**
 * Sets current HP to an exact total, clamped to 0..maxHp and rounded down.
 * A non-finite total (NaN, Infinity) leaves current HP unchanged. Temp HP is kept.
 */
export function setCurrentHp(state: HitPointState, total: number, maxHp: number): HitPointPatch {
  if (!Number.isFinite(total)) return withDeathSaves({ currentHp: state.currentHp, tempHp: state.tempHp });
  const clamped = Math.min(maxHp, Math.max(0, Math.floor(total)));
  return withDeathSaves({ currentHp: clamped, tempHp: state.tempHp });
}

/**
 * Full heal on level-up: current HP goes to the new max, which the caller computes from the
 * levelled character. Death saves clear because the result is above 0. Temp HP is kept.
 */
export function fullHealAtLevelUp(state: HitPointState, newMaxHp: number): HitPointPatch {
  return setCurrentHp(state, newMaxHp, newMaxHp);
}

/**
 * Reads a typed amount: a non-negative integer, surrounding whitespace allowed.
 * Anything else (negative, fractional, empty, non-numeric, unsafe size) gives undefined.
 */
export function parseAmount(input: string): number | undefined {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}
