/**
 * A class's starting equipment, one slot per entry of its `defaultData`, in printed order. A slot's index is its
 * position in that list, and an option's letter is its key in the source (`a`, `b`, `c`), so a pick can be
 * stored by slot index and option letter.
 */

/** A catalog item named as printed, with the source it is printed in. */
export interface StartingEquipmentItem {
  kind: "item";
  name: string;
  source: string;
  quantity: number;
}

/** Any item of a generic type, named as the source prints it (`weaponMartial`, `focusSpellcastingArcane`). */
export interface StartingEquipmentType {
  kind: "type";
  equipmentType: string;
  quantity: number;
}

/** An entry of a shape the parser does not recognise. It is kept in place, with the raw value, and reported. */
export interface StartingEquipmentUnrecognised {
  kind: "unrecognised";
  raw: unknown;
}

export type StartingEquipmentEntry = StartingEquipmentItem | StartingEquipmentType | StartingEquipmentUnrecognised;

/** One option of a choice slot: the letter it is printed under and every entry it grants. */
export interface StartingEquipmentOption {
  letter: string;
  entries: StartingEquipmentEntry[];
}

/** A slot the player takes whole (`_`), a slot the player picks one option of (`a`, `b`, ...), or a slot of an unrecognised shape. */
export type StartingEquipmentSlot =
  | { kind: "fixed"; entries: StartingEquipmentEntry[] }
  | { kind: "choice"; options: StartingEquipmentOption[] }
  | { kind: "unrecognised"; raw: unknown };
