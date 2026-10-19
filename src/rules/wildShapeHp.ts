// Pure hit point arithmetic for an Active Wild Shape (the beast's own hit points).
// Each function returns only the keys that change, as a character patch. An empty patch means
// nothing changes (non-finite or negative input). Nothing here touches storage.
//
// Carry-over: damage beyond the form's remaining HP ends the form and is applied to the
// character's normal HP through `damage()` from hitPoints.ts. Healing never carries over.

import type { ActiveWildShape } from "../types/character.ts";
import { damage, type HitPointPatch, type HitPointState } from "./hitPoints.ts";

export interface WildShapeCharacter extends HitPointState {
  activeWildShape?: ActiveWildShape | null;
}

/** Character fields this module may change: the form, and normal HP when damage carries over. */
export type WildShapeHpPatch = Partial<HitPointPatch> & { activeWildShape?: ActiveWildShape | null };

const isUsableAmount = (amount: number) => Number.isFinite(amount) && amount >= 0;

/**
 * Damage to the beast. Below its HP the form just loses HP. At or above it the form ends, and any
 * excess (after the form's HP is used up) goes to normal HP through `damage()`.
 */
export function damageWildShape(character: WildShapeCharacter, amount: number): WildShapeHpPatch {
  const shape = character.activeWildShape;
  if (!shape || !isUsableAmount(amount)) return {};

  const remaining = shape.currentHp - amount;
  if (remaining > 0) return { activeWildShape: { ...shape, currentHp: remaining } };

  const carryOver = amount - shape.currentHp;
  if (carryOver === 0) return { activeWildShape: null };

  return { ...damage({ currentHp: character.currentHp, tempHp: character.tempHp }, carryOver), activeWildShape: null };
}

/** Heal to the beast, capped at its max HP. Normal HP is never touched. */
export function healWildShape(shape: ActiveWildShape, amount: number): WildShapeHpPatch {
  if (!isUsableAmount(amount)) return {};
  return { activeWildShape: { ...shape, currentHp: Math.min(shape.maxHp, shape.currentHp + amount) } };
}

/**
 * Sets the beast HP to an exact total, clamped to 0..maxHp and rounded down. Setting 0 ends the
 * form with no carry-over. A non-finite total changes nothing.
 */
export function setWildShapeHp(shape: ActiveWildShape, total: number): WildShapeHpPatch {
  if (!Number.isFinite(total)) return {};
  const clamped = Math.min(shape.maxHp, Math.max(0, Math.floor(total)));
  if (clamped === 0) return { activeWildShape: null };
  return { activeWildShape: { ...shape, currentHp: clamped } };
}
