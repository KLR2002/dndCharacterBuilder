import type { StartingEquipmentCardSlot } from "../../rules/startingEquipment";

/** A choice slot's place among the choice slots, and whether the character has picked one of its options. */
export interface ChoiceSlotHeader {
  /** One-based, counting the choice slots only. */
  number: number;
  /** How many choice slots the card has. */
  total: number;
  complete: boolean;
}

/** The header of each choice slot, keyed by the slot's own index on the card. Fixed and unrecognised slots have none. */
export function choiceSlotHeaders(slots: StartingEquipmentCardSlot[]): Map<number, ChoiceSlotHeader> {
  const choices = slots.filter((slot): slot is Extract<StartingEquipmentCardSlot, { kind: "choice" }> => slot.kind === "choice");
  return new Map(
    choices.map((slot, index) => [
      slot.slot,
      {
        number: index + 1,
        total: choices.length,
        complete: slot.options.some((option) => option.chosen),
      },
    ]),
  );
}
