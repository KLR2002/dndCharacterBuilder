// Pure hit point arithmetic for an Active Wild Shape (the beast's own hit points and temp HP).
// Each function returns only the keys that change, as a character patch. An empty patch means
// nothing changes (non-finite or negative input, or no form active). Nothing here touches storage.
//
// Temp HP travels with the form: assuming a shape moves the character's temp HP onto it, and the
// Revert button moves it back (never stacking). A form that ends from its HP (damage, or setting its
// HP to 0) takes its temp HP with it. Damage to the form takes the form's temp HP first, then its HP.
// Healing never touches temp HP.
//
// Carry-over: damage beyond the form's remaining temp HP and HP ends the form, and the excess is
// applied to the character's normal HP through `damage()` from hitPoints.ts. Healing never carries over.

import type { ActiveWildShape } from "../types/character.ts";
import { damage, type HitPointPatch, type HitPointState } from "./hitPoints.ts";

export interface WildShapeCharacter extends HitPointState {
  activeWildShape?: ActiveWildShape | null;
}

/** Character fields this module may change: the form, normal temp HP, and normal HP when damage carries over. */
export type WildShapeHpPatch = Partial<HitPointPatch> & { activeWildShape?: ActiveWildShape | null };

const isUsableAmount = (amount: number) => Number.isFinite(amount) && amount >= 0;

/** The form's temp HP. A save from before form temp HP existed has none, which counts as 0. */
const formTempHp = (shape: ActiveWildShape) => shape.tempHp ?? 0;

/**
 * The form with new HP values. The `tempHp` key is written only when the form already has one, so a
 * legacy form with no temp HP keeps no such key.
 */
function withFormHp(shape: ActiveWildShape, currentHp: number, tempHp: number): ActiveWildShape {
  const next: ActiveWildShape = { ...shape, currentHp };
  if (shape.tempHp !== undefined) next.tempHp = tempHp;
  return next;
}

/**
 * Assumes a form. The character's temp HP moves onto the form and the character's temp HP is set to 0.
 * Adopting a new form while one is active keeps the old form's temp HP on the new form, and the
 * character's own temp HP is left as it is.
 */
export function enterWildShape(character: WildShapeCharacter, shape: Omit<ActiveWildShape, "tempHp">): WildShapeHpPatch {
  const current = character.activeWildShape;
  if (current) return { activeWildShape: { ...shape, tempHp: formTempHp(current) } };
  return { activeWildShape: { ...shape, tempHp: character.tempHp }, tempHp: 0 };
}

/**
 * Ends the form by the Revert button only. The form's temp HP moves back to the character. Temp HP
 * never stacks, so the character keeps the larger of the two.
 */
export function revertWildShape(character: WildShapeCharacter): WildShapeHpPatch {
  const shape = character.activeWildShape;
  if (!shape) return {};
  return { activeWildShape: null, tempHp: Math.max(character.tempHp, formTempHp(shape)) };
}

/**
 * Damage to the beast. The form's temp HP takes it first, then its HP. If the form's HP reaches 0 the
 * form ends, and any excess goes to normal HP through `damage()`. The form's temp HP is already
 * used up by then, so none of it returns to the character.
 */
export function damageWildShape(character: WildShapeCharacter, amount: number): WildShapeHpPatch {
  const shape = character.activeWildShape;
  if (!shape || !isUsableAmount(amount)) return {};

  const after = damage({ currentHp: shape.currentHp, tempHp: formTempHp(shape) }, amount);
  if (after.currentHp > 0) return { activeWildShape: withFormHp(shape, after.currentHp, after.tempHp) };

  const carryOver = amount - shape.currentHp - formTempHp(shape);
  if (carryOver === 0) return { activeWildShape: null };

  return { ...damage({ currentHp: character.currentHp, tempHp: character.tempHp }, carryOver), activeWildShape: null };
}

/** Heal to the beast, capped at its max HP. Neither normal HP nor the form's temp HP is touched. */
export function healWildShape(shape: ActiveWildShape, amount: number): WildShapeHpPatch {
  if (!isUsableAmount(amount)) return {};
  return { activeWildShape: { ...shape, currentHp: Math.min(shape.maxHp, shape.currentHp + amount) } };
}

/**
 * Sets the beast HP to an exact total, clamped to 0..maxHp and rounded down. Setting 0 is a drop, the
 * same as damage that takes the form to 0: the form ends with no carry-over, its temp HP is lost, and
 * the character's temp HP is left alone. Only Revert returns temp HP. A non-finite total changes nothing.
 */
export function setWildShapeHp(character: WildShapeCharacter, total: number): WildShapeHpPatch {
  const shape = character.activeWildShape;
  if (!shape || !Number.isFinite(total)) return {};
  const clamped = Math.min(shape.maxHp, Math.max(0, Math.floor(total)));
  if (clamped === 0) return { activeWildShape: null };
  return { activeWildShape: { ...shape, currentHp: clamped } };
}

/**
 * Sets the form's temp HP to an exact amount. It replaces the old value and does not stack. 0 clears it.
 * A negative or non-finite value changes nothing.
 */
export function setWildShapeTempHp(character: WildShapeCharacter, value: number): WildShapeHpPatch {
  const shape = character.activeWildShape;
  if (!shape || !isUsableAmount(value)) return {};
  return { activeWildShape: { ...shape, tempHp: Math.floor(value) } };
}
