import { useState } from "react";
import { useCharacters } from "../context/CharacterContext";
import type { HitPointPatch } from "../rules/hitPoints";
import type { Character } from "../types/character";

const HP_TRIGGER_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Open/close state and wiring for the HP quick-edit modal and the touchable that opens it.
 * Spread `modalProps` onto <HpQuickEditModal /> and `triggerProps` onto the touchable.
 *
 * `character` may be missing while the screen is still loading. Callers must pass max HP as a
 * number in that case too, and the modal must not be rendered until the character exists.
 */
export function useHpQuickEdit(character: Character | null | undefined, maxHp: number) {
  const { updateCharacter } = useCharacters();
  const [visible, setVisible] = useState(false);

  const open = () => setVisible(true);
  const close = () => setVisible(false);

  return {
    open,
    close,
    visible,
    modalProps: {
      visible,
      onClose: close,
      currentHp: character?.currentHp ?? 0,
      tempHp: character?.tempHp ?? 0,
      maxHp,
      onChange: (patch: HitPointPatch) => {
        if (character) void updateCharacter(character.id, patch);
      },
    },
    triggerProps: {
      onPress: open,
      accessibilityRole: "button" as const,
      accessibilityLabel: "Change hit points",
      hitSlop: HP_TRIGGER_HIT_SLOP,
    },
  };
}
