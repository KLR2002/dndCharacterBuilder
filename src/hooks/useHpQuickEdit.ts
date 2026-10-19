import { useState } from "react";
import type { HpAction } from "../components/HpQuickEditModal";
import { useCharacters } from "../context/CharacterContext";
import { damage, heal, setCurrentHp, type HitPointPatch } from "../rules/hitPoints";
import { damageWildShape, healWildShape, setWildShapeHp, type WildShapeHpPatch } from "../rules/wildShapeHp";
import type { ActiveWildShape, Character } from "../types/character";

const HP_TRIGGER_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/** "character" edits normal HP. "wildShape" edits the Active Wild Shape's own HP. */
export type HpTarget = "character" | "wildShape";

function characterPatch(character: Character, maxHp: number, { kind, amount }: HpAction): HitPointPatch {
  const state = { currentHp: character.currentHp, tempHp: character.tempHp };
  if (kind === "damage") return damage(state, amount);
  if (kind === "heal") return heal(state, amount, maxHp);
  return setCurrentHp(state, amount, maxHp);
}

function wildShapePatch(character: Character, shape: ActiveWildShape, { kind, amount }: HpAction): WildShapeHpPatch {
  if (kind === "damage") return damageWildShape(character, amount);
  if (kind === "heal") return healWildShape(shape, amount);
  return setWildShapeHp(character, amount);
}

/**
 * Open/close state and wiring for the HP quick-edit modal and the touchable that opens it.
 * Spread `modalProps` onto <HpQuickEditModal /> and `triggerProps` onto the touchable.
 *
 * `maxHp` is the character's max HP and is used only for target "character". The "wildShape"
 * target reads the form's own HP, and it has no temp HP line.
 *
 * `character` may be missing while the screen is still loading. Callers must pass max HP as a
 * number in that case too, and the modal must not be rendered until the character exists.
 */
export function useHpQuickEdit(character: Character | null | undefined, maxHp: number, target: HpTarget = "character") {
  const { updateCharacter } = useCharacters();
  // The target whose box is open, or null. Keeps the box tied to its target: it shuts when that
  // target changes (the header badge switches back to normal HP) or when the form ends.
  const [openFor, setOpenFor] = useState<HpTarget | null>(null);

  const shape = character?.activeWildShape ?? null;
  const beast = target === "wildShape";
  const live = !beast || shape !== null;
  if (openFor !== null && (openFor !== target || !live)) setOpenFor(null);
  const visible = openFor === target && live;

  const open = () => setOpenFor(target);
  const close = () => setOpenFor(null);

  const onAction = (action: HpAction) => {
    if (!character) return;
    const patch = beast
      ? shape && wildShapePatch(character, shape, action)
      : characterPatch(character, maxHp, action);
    if (patch && Object.keys(patch).length > 0) void updateCharacter(character.id, patch);
  };

  return {
    open,
    close,
    visible,
    /** Applies an action directly, without opening the modal (used by the inline Damage / Heal buttons). */
    apply: onAction,
    modalProps: {
      visible,
      onClose: close,
      title: beast ? "Wild Shape HP" : "Hit Points",
      currentHp: beast ? (shape?.currentHp ?? 0) : (character?.currentHp ?? 0),
      maxHp: beast ? (shape?.maxHp ?? 0) : maxHp,
      tempHp: beast ? undefined : (character?.tempHp ?? 0),
      onAction,
    },
    triggerProps: {
      onPress: open,
      accessibilityRole: "button" as const,
      accessibilityLabel: beast ? "Change wild shape hit points" : "Change hit points",
      hitSlop: HP_TRIGGER_HIT_SLOP,
    },
  };
}
