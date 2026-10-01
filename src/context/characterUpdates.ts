import type { Character } from "../types/character.ts";

/** Pure transition: timestamps and persistence belong to the caller. */
export function applyCharacterUpdate(
  characters: Character[], id: string, updater: (c: Character) => Character,
): Character[] {
  return characters.map(character => character.id === id ? updater(character) : character);
}
