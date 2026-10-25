import type { InitiativeBonusOverride } from "../parser/initiative-bonuses.ts";

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
