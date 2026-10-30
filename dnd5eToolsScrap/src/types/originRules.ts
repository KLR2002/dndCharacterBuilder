/**
 * Origin Customization's structured swap data (ADR 0014): the kinds of proficiency a rule's swap table replaces and the
 * kinds that may replace them. Shared by the scraper's output and the app's catalog types. Type-only on purpose, so the
 * app can import it without pulling in any scraper code.
 */

/** The closed vocabulary of proficiency kinds a swap table names. */
export type OriginProficiencyKind = "skill" | "tool" | "armor" | "simple weapon" | "martial weapon";

/** One row of a Proficiency Swaps table: the kind it replaces and the kinds that may replace it. */
export interface ProficiencySwapRow {
  from: OriginProficiencyKind;
  to: OriginProficiencyKind[];
}

/** One rule's swap data, as the Integrated Catalog holds it. Carries no prose. */
export interface OriginRuleRecord {
  name: string;
  source: string;
  proficiencySwaps: ProficiencySwapRow[];
}
