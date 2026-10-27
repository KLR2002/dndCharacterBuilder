import type { ReviewedFeature } from "./proficiency-grants.ts";

/**
 * A subrace whose spell grant waits on an option the player picks in one of the subrace's Rule Choices (ADR 0017). The grant
 * is read only while that option is picked. Names only: the race and subrace, the trait holding the choice, and the option.
 * The scraper writes the gate onto each of the subrace's grants as the Rule Choice id it waits on and the option.
 */
export interface SpellGrantGate {
  race: string;
  subrace: string;
  subraceSource: string;
  trait: string;
  option: string;
}

/** The reviewed spell grant gates. A gate that names no subrace with spell grants fails the tracked-data check. */
export const SPELL_GRANT_GATES: SpellGrantGate[] = [
  // The Moon Elf or Sun Elf descent's wizard cantrip is read only when the Cantrip option of the Variant Feature is picked.
  { race: "Half-Elf", subrace: "Moon Elf or Sun Elf Descent", subraceSource: "SCAG", trait: "Variant Feature (Choose 1)", option: "Cantrip" },
];

/**
 * A feat whose spell grants the reader does not turn into Innate Magic, reviewed (ADR 0017). The reason says what is not
 * modelled, so the follow-up is visible from this file. The gate reads names only; the reason is for the reviewer.
 */
interface ReviewedSpellFeat extends ReviewedFeature {
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
  // The 2024 print also grants an always-prepared group.
  { owner: "Feat", feature: "Ritual Caster", level: 0, reason: "not modelled: the ritual book, and always-prepared spells in the 2024 print" },
  { owner: "Feat", feature: "Servo Crafting", level: 0, reason: "not modelled: the ritual book" },
  { owner: "Feat", feature: "Strixhaven Mascot", level: 0, reason: "not modelled: the ritual book" },
];

/**
 * Feats only the live catalog holds (their books are not in the tracked files), reviewed the same way. The tracked gate
 * cannot name them (an unknown mark throws there), so only the live gate reads this list.
 */
export const REVIEWED_NO_SPELL_GRANTS_LIVE_ONLY: ReviewedSpellFeat[] = [
  // The grant names no casting ability.
  { owner: "Feat", feature: "Boon of Misty Escape", level: 0, reason: "not modelled: no casting ability in the grant" },
  { owner: "Feat", feature: "Light Bringer", level: 0, reason: "not modelled: no casting ability in the grant" },
  // Its spells are cast from the feat's own text, with no spell grant in the catalog.
  { owner: "Feat", feature: "Genie Magic", level: 0, reason: "not modelled: no spell grant in the catalog" },
];
