// Pure hit point arithmetic shared by the Stats tab and the HP quick-edit modal.
// Every function returns the patch to store: { currentHp, tempHp }. Nothing here touches storage.

export interface HitPointState {
  currentHp: number;
  tempHp: number;
}

/** Temp HP absorbs the hit first; whatever is left comes off current HP, which floors at 0. */
export function damage(state: HitPointState, amount: number): HitPointState {
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

  return { currentHp: Math.max(0, state.currentHp - remaining), tempHp: temp };
}

/** Adds to current HP, capped at max HP. Temp HP is not affected. */
export function heal(state: HitPointState, amount: number, maxHp: number): HitPointState {
  return { currentHp: Math.min(maxHp, state.currentHp + amount), tempHp: state.tempHp };
}

/**
 * Sets current HP to an exact total, clamped to 0..maxHp and rounded down.
 * A non-finite total (NaN, Infinity) leaves current HP unchanged. Temp HP is kept.
 */
export function setCurrentHp(state: HitPointState, total: number, maxHp: number): HitPointState {
  if (!Number.isFinite(total)) return { currentHp: state.currentHp, tempHp: state.tempHp };
  const clamped = Math.min(maxHp, Math.max(0, Math.floor(total)));
  return { currentHp: clamped, tempHp: state.tempHp };
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
