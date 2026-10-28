import type { Character } from "../types/character.ts";

/**
 * The character with each notice appended to its needsReview list once: a notice already on the list is not repeated. Returns
 * the character itself when there are no notices.
 */
export function withNotices(character: Character, notices: readonly string[]): Character {
  if (notices.length === 0) return character;
  return { ...character, needsReview: Array.from(new Set([...(character.needsReview ?? []), ...notices])) };
}

/**
 * The list with the notice of that text removed, or with every notice removed when `notice` is omitted. A text that matches
 * no notice leaves the list as it is. An empty result is undefined, which is how the character stores no notices.
 */
export function dismissNotices(needsReview: readonly string[] | undefined, notice?: string): string[] | undefined {
  const kept = notice === undefined || !needsReview ? [] : needsReview.filter((text) => text !== notice);
  return kept.length > 0 ? kept : undefined;
}
