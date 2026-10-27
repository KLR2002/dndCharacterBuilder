import type { Character } from "../types/character.ts";

/**
 * The character with each notice appended to its needsReview list once: a notice already on the list is not repeated. Returns
 * the character itself when there are no notices.
 */
export function withNotices(character: Character, notices: readonly string[]): Character {
  if (notices.length === 0) return character;
  return { ...character, needsReview: Array.from(new Set([...(character.needsReview ?? []), ...notices])) };
}
