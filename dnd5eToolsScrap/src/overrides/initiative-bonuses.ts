import type { InitiativeBonusOverride } from "../parser/initiative-bonuses.ts";
import type { ReviewedFeature } from "./proficiency-grants.ts";

/**
 * Reviewed Initiative Bonuses for features the extractor cannot read (ADR 0016).
 *
 * Names only, as the Proficiency Grant overrides are: each entry says which feature (owner, feature name, level)
 * carries which bonus. An entry replaces the extracted bonus for its feature. An entry that names a feature the
 * tracked files do not contain is an error.
 *
 * A TypeScript module rather than a JSON file, because the in-app scraper bundles these modules and cannot read
 * files at runtime.
 */
export const INITIATIVE_BONUS_OVERRIDES: InitiativeBonusOverride[] = [];

/**
 * Features whose prose adds a number to initiative, reviewed and found to grant the holder no Initiative Bonus.
 * Names only. The coverage gate fails on a mark that names an unknown feature, or a feature that has a bonus.
 */
export const REVIEWED_NO_INITIATIVE_BONUS: ReviewedFeature[] = [
  // Reaches only allies.
  { owner: "Mystic/Order of the Avatar", feature: "Avatar of Battle", level: 3 },
];

/**
 * Features that exist only in the Integrated Catalog, not in the tracked files, and are reviewed the same way. The
 * tracked gate cannot name them (an unknown mark throws there), so only the live gate reads this list.
 */
export const REVIEWED_NO_INITIATIVE_BONUS_LIVE_ONLY: ReviewedFeature[] = [
  // Spent on each use.
  { owner: "Bard/College of Dance", feature: "Tandem Footwork", level: 6 },
  // Spent on each use; a maneuver option, not a class feature.
  { owner: "Option", feature: "Ambush", level: 0 },
];
