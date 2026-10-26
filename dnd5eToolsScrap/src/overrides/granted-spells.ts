import type { ReviewedFeature } from "./proficiency-grants.ts";

/**
 * A feat whose spell grants the reader does not turn into Innate Magic, reviewed (ADR 0017). The reason says what is not
 * modelled, so the follow-up is visible from this file. The gate reads names only; the reason is for the reviewer.
 */
export interface ReviewedSpellFeat extends ReviewedFeature {
  reason: string;
}

/**
 * Feats the tracked files hold whose spell grants the reader does not model. Names only. The coverage gate fails on a
 * mark that names an unknown feat, or a feat the reader covers.
 */
export const REVIEWED_NO_SPELL_GRANTS: ReviewedSpellFeat[] = [
  // The grant names no casting ability, so the reader gives no card.
  { owner: "Feat", feature: "Cartomancer", level: 0, reason: "not modelled: no casting ability in the grant" },
  { owner: "Feat", feature: "Outlands Envoy", level: 0, reason: "not modelled: no casting ability in the grant" },
  { owner: "Feat", feature: "Rune Shaper", level: 0, reason: "not modelled: no casting ability in the grant" },
  // Ritual-only grants: the ritual book is not modelled.
  { owner: "Feat", feature: "Quicksmithing", level: 0, reason: "not modelled: the ritual book" },
  { owner: "Feat", feature: "Ritual Caster", level: 0, reason: "not modelled: the ritual book" },
  { owner: "Feat", feature: "Servo Crafting", level: 0, reason: "not modelled: the ritual book" },
  { owner: "Feat", feature: "Strixhaven Mascot", level: 0, reason: "not modelled: the ritual book" },
];

/**
 * Feats only the live catalog holds (their books are not in the tracked files), reviewed the same way. The tracked gate
 * cannot name them (an unknown mark throws there), so only the live gate reads this list.
 */
export const REVIEWED_NO_SPELL_GRANTS_LIVE_ONLY: ReviewedSpellFeat[] = [];
