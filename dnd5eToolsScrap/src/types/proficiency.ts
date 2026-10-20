/**
 * Proficiency Grants: what a single rule gives a character in skills, tools,
 * languages, weapons, armor or saving throws. Shared by the scraper's output
 * models and the app's catalog types (see ADR 0015). Type-only on purpose so
 * the app can import it without pulling in any scraper code.
 */

export type ProficiencyCategory = "skills" | "tools" | "languages" | "weapons" | "armor" | "savingThrows";

/** The entries a Proficiency Choice draws from. */
export type ProficiencyPool =
  /** A plain list of names, for example two skills from a fixed list. */
  | { kind: "names"; names: string[] }
  /** Any entry of the grant's category, for example any language. */
  | { kind: "any" }
  /**
   * A property rule over weapons: any of the listed base types that lack every
   * listed property, plus any weapons named explicitly. `attackType`, when set,
   * keeps only melee or only ranged weapons.
   */
  | {
      kind: "weapons";
      base: Array<"simple" | "martial">;
      withoutProperties: string[];
      plus: string[];
      attackType?: "melee" | "ranged";
    };

export interface FixedProficiencyGrant {
  /** Built from source, owner, feature, level and position; never changes once shipped. */
  id: string;
  kind: "fixed";
  category: ProficiencyCategory;
  names: string[];
}

export interface ChoiceProficiencyGrant {
  id: string;
  kind: "choice";
  category: ProficiencyCategory;
  count: number;
  pool: ProficiencyPool;
}

export type ProficiencyGrant = FixedProficiencyGrant | ChoiceProficiencyGrant;

/** A grant as written in the override file: names only, no id (the scraper assigns it). */
export type ProficiencyGrantSpec =
  | { kind: "fixed"; category: ProficiencyCategory; names: string[] }
  | { kind: "choice"; category: ProficiencyCategory; count: number; pool: ProficiencyPool };

/** One item the extractor could not turn into grants, for review. */
export interface UnparsedProficiency {
  owner: string;
  feature: string;
  level: number;
  /** The sentences (or raw structured entries) that matched but could not be parsed. */
  unparsed: string[];
}

/** What a scrape run learned about Proficiency Grants. */
export interface ProficiencyReport {
  /** Features (class, subclass, feat) that produced at least one grant. */
  covered: number;
  unparsed: UnparsedProficiency[];
}
