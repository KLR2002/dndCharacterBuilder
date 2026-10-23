import type { Character, StartingEquipmentPicks } from "../types/character.ts";

// The picks' own bookkeeping. This file imports nothing but types, so the Character Reconciler can prune picks
// without pulling in the catalog and proficiency readers.

/** The picks that belong to the character's first class. Picks made for another class, or none, read as absent. */
export function picksOfFirstClass(character: Character): StartingEquipmentPicks | undefined {
  const picks = character.startingEquipmentPicks;
  const first = character.classes[0];
  if (!picks || !first) return undefined;
  const sameSource = (picks.source ?? "").toLowerCase() === (first.source ?? "").toLowerCase();
  return picks.className === first.className && sameSource ? picks : undefined;
}

/** Drops picks that no longer belong to the first class, because the class changed or was removed. Unchanged otherwise. */
export function pruneStartingEquipmentPicks(character: Character): Character {
  if (!character.startingEquipmentPicks || picksOfFirstClass(character)) return character;
  const next = { ...character };
  delete next.startingEquipmentPicks;
  return next;
}

/**
 * The key a generic entry's picks are stored under: its slot index, its option letter (`_` for a fixed slot) and its
 * entry index within that option.
 */
export function startingEquipmentEntryKey(address: { slot: number; option: string | null; entry: number }): string {
  return `${address.slot}.${address.option ?? "_"}.${address.entry}`;
}
