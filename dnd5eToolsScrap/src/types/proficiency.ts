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
   * Any entry of the listed categories, for example any tool or any language. Type-only: the scraper never
   * emits it, and the app declares it for a custom background's choice.
   */
  | { kind: "anyOf"; categories: Array<"tools" | "languages"> }
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

/**
 * A pick on another feature's choice that a grant depends on: the grant applies only while the character's
 * pick on the choice of `feature` (at `level`, in the same subclass) names the feature that carries the grant.
 * Carried by a grant that is an option's own text, for example a subclass feature that is one option of an
 * earlier feature's choice.
 */
export interface GrantRequirement {
  feature: string;
  level: number;
}

export interface FixedProficiencyGrant {
  /** Built from the feature and what the grant names. Never changes once shipped. */
  id: string;
  /** Former ids this grant was saved under (its position in the feature). A saved pick under one moves to `id`. */
  aliases?: string[];
  kind: "fixed";
  category: ProficiencyCategory;
  names: string[];
  requires?: GrantRequirement;
}

export interface ChoiceProficiencyGrant {
  /** Built from the feature and the kind of choice. The pool it picks from is not part of the id. Never changes once shipped. */
  id: string;
  /**
   * Former ids this grant was saved under: its position in the feature, and, for a choice whose id changed, the id that
   * named its pool. A saved pick under one moves to `id`.
   */
  aliases?: string[];
  kind: "choice";
  category: ProficiencyCategory;
  count: number;
  pool: ProficiencyPool;
  requires?: GrantRequirement;
}

export type ProficiencyGrant = FixedProficiencyGrant | ChoiceProficiencyGrant;

/** A grant as written in the override file: names only, no id (the scraper assigns it). */
export type ProficiencyGrantSpec =
  | { kind: "fixed"; category: ProficiencyCategory; names: string[]; requires?: GrantRequirement }
  | { kind: "choice"; category: ProficiencyCategory; count: number; pool: ProficiencyPool; requires?: GrantRequirement };

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
