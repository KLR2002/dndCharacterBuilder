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
  // The Drow Descent's spells are read only while the Drow Magic option of its Variant Feature is picked.
  { race: "Half-Elf", subrace: "Drow Descent", subraceSource: "SCAG", trait: "Variant Feature (Choose 1)", option: "Drow Magic" },
];

/**
 * A race's or subrace's spell grant whose source data gives its spells in a different shape from the trait text that grants
 * them, corrected to the trait text (ADR 0017). Each section the correction gives (`known`, `innate`) replaces that section of
 * the grant; a section it leaves out stays as the source gives it, and so do the ability and the expanded lists. A subrace
 * names its own record with `subrace` and `subraceSource`; a race's own grant leaves both out. The reason is for the reviewer.
 */
export interface SpellGrantCorrection {
  race: string;
  raceSource: string;
  subrace?: string;
  subraceSource?: string;
  reason: string;
  known?: Record<string, unknown>;
  innate?: Record<string, unknown>;
}

/** The reviewed spell grant corrections. A correction that names no grant fails the tracked-data check. */
export const SPELL_GRANT_CORRECTIONS: SpellGrantCorrection[] = [
  {
    race: "Dwarf",
    raceSource: "PHB",
    subrace: "Mark of Warding",
    subraceSource: "ERLW",
    reason: "the trait adds arcane lock from 3rd level, which the grant does not give",
    known: { "1": ["alarm", "mage armor"], "3": ["arcane lock"] },
  },
  {
    race: "Gnome (Deep)",
    raceSource: "DMG",
    reason: "the trait gives nondetection at will and the other three once per Long Rest; the grant gives all four once per Long Rest",
    known: { "1": ["blindness/deafness", "blur", "disguise self"] },
    innate: { "1": ["nondetection"] },
  },
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
  // Its spells are cast from the feat's own text, with no spell grant in the catalog.
  { owner: "Feat", feature: "Genie Magic", level: 0, reason: "not modelled: no spell grant in the catalog" },
];
