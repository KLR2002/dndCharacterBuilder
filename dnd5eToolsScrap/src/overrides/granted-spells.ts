import type { ReviewedFeature } from "./proficiency-grants.ts";

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
  // Their grant is a prepared group, which the reader does not model.
  { owner: "Feat", feature: "Abjuration Adept", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Conjuration Adept", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Divination Adept", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Enchantment Adept", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Evocation Adept", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Illusion Adept", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Necromancy Adept", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Transmutation Adept", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Boon of Magic School Mastery", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Boon of Revelry", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Boon of Siberys", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Cloying Mists", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Emerald Enclave Fledgling", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Enclave Magic", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Familiar Friend", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Magic Connoisseur", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Second Skin", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Shadowmoor Hexer", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Treacherous Allure", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Vampire Touched", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Warlike Familiar", level: 0, reason: "not modelled: always-prepared spells" },
  { owner: "Feat", feature: "Watchers", level: 0, reason: "not modelled: always-prepared spells" },
  // The Mark feats also grant an expanded spell list, which the reader does not model.
  { owner: "Feat", feature: "Mark of Detection", level: 0, reason: "not modelled: always-prepared spells and an expanded list" },
  { owner: "Feat", feature: "Mark of Finding", level: 0, reason: "not modelled: always-prepared spells and an expanded list" },
  { owner: "Feat", feature: "Mark of Handling", level: 0, reason: "not modelled: always-prepared spells and an expanded list" },
  { owner: "Feat", feature: "Mark of Healing", level: 0, reason: "not modelled: always-prepared spells and an expanded list" },
  { owner: "Feat", feature: "Mark of Hospitality", level: 0, reason: "not modelled: always-prepared spells and an expanded list" },
  { owner: "Feat", feature: "Mark of Passage", level: 0, reason: "not modelled: always-prepared spells and an expanded list" },
  { owner: "Feat", feature: "Mark of Sentinel", level: 0, reason: "not modelled: always-prepared spells and an expanded list" },
  { owner: "Feat", feature: "Mark of Warding", level: 0, reason: "not modelled: always-prepared spells and an expanded list" },
  // The grant names no casting ability, or gives its spells as a prepared group without one.
  { owner: "Feat", feature: "Boon of Misty Escape", level: 0, reason: "not modelled: no casting ability in the grant" },
  { owner: "Feat", feature: "Light Bringer", level: 0, reason: "not modelled: no casting ability in the grant" },
  // Its spells are cast from the feat's own text, with no spell grant in the catalog.
  { owner: "Feat", feature: "Genie Magic", level: 0, reason: "not modelled: no spell grant in the catalog" },
];
