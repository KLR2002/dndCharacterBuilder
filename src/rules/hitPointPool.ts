// Chooses which hit point pool an HP action changes: the Active Wild Shape's form, or the character.
// Lives beside hitPoints.ts and wildShapeHp.ts because wildShapeHp.ts already imports hitPoints.ts.
// Returns the patch to store. Nothing here touches storage.

import { damage, heal, setCurrentHp } from "./hitPoints.ts";
import { damageWildShape, healWildShape, setWildShapeHp, setWildShapeTempHp, type WildShapeCharacter, type WildShapeHpPatch } from "./wildShapeHp.ts";

export type HitPointAction = { kind: "damage" | "heal" | "set" | "temp"; amount: number };
export type HitPointTarget = "character" | "wildShape";

/** Without a target, the form is the pool while one is active, otherwise the character. */
function defaultTarget(character: WildShapeCharacter): HitPointTarget {
  return character.activeWildShape ? "wildShape" : "character";
}

function characterPatch(character: WildShapeCharacter, action: HitPointAction, maxHp: number): WildShapeHpPatch {
  const state = { currentHp: character.currentHp, tempHp: character.tempHp };
  if (action.kind === "damage") return damage(state, action.amount);
  if (action.kind === "heal") return heal(state, action.amount, maxHp);
  if (action.kind === "set") return setCurrentHp(state, action.amount, maxHp);
  if (!Number.isFinite(action.amount) || action.amount < 0) return {};
  return { tempHp: action.amount };
}

function wildShapePatch(character: WildShapeCharacter, action: HitPointAction): WildShapeHpPatch {
  const shape = character.activeWildShape;
  if (!shape) return {};
  if (action.kind === "damage") return damageWildShape(character, action.amount);
  if (action.kind === "heal") return healWildShape(shape, action.amount);
  if (action.kind === "set") return setWildShapeHp(character, action.amount);
  return setWildShapeTempHp(character, action.amount);
}

/**
 * The patch for one HP action. `target` picks the pool; without it, the form is the pool while one is
 * active. A "wildShape" target with no form active changes nothing.
 */
export function hitPointPatch(
  character: WildShapeCharacter,
  action: HitPointAction,
  maxHp: number,
  target: HitPointTarget = defaultTarget(character),
): WildShapeHpPatch {
  return target === "wildShape" ? wildShapePatch(character, action) : characterPatch(character, action, maxHp);
}
