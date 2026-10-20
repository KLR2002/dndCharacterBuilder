import type { GrantOverride } from "../parser/proficiency-grants.ts";

/**
 * Reviewed Proficiency Grants for features the extractor cannot parse.
 *
 * Names only: each entry says which feature (owner, feature name, level) and
 * which grants it has, with grant names. No rule prose goes in this file. An
 * entry replaces the extracted grants for its feature. An entry that names a
 * feature the scrape does not contain is an error.
 *
 * A TypeScript module rather than a JSON file, because the in-app scraper
 * bundles these modules and cannot read files at runtime.
 */
export const PROFICIENCY_GRANT_OVERRIDES: { classes: GrantOverride[]; feats: GrantOverride[] } = {
  classes: [],
  feats: [],
};

/** A feature, named by owner, feature name and level, with no rule prose. */
export interface ReviewedFeature {
  owner: string;
  feature: string;
  level: number;
}

/**
 * Features reviewed and found to grant no proficiency, though their prose
 * matches the proficiency vocabulary. Names only. The coverage gate fails on a
 * mark that names an unknown feature, or a feature that has grants.
 */
export const REVIEWED_GRANTS_NOTHING: ReviewedFeature[] = [];
