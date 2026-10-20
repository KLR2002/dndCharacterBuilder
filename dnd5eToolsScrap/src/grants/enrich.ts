import { newProficiencyReport, resolveFeatureGrants, unmatchedOverrides, type GrantOverride } from "../parser/proficiency-grants.ts";
import { allRefs, classFeatureRefs, featRefs, type GrantRef, type TrackedClass, type TrackedData, type TrackedFeat } from "./subjects.ts";

/** Reviewed overrides, one list per tracked file. Matches the shape of PROFICIENCY_GRANT_OVERRIDES. */
export interface GrantOverrides {
  classes: GrantOverride[];
  feats: GrantOverride[];
}

/** The text of the two tracked files this tooling enriches. */
export interface TrackedFiles {
  classes: string;
  feats: string;
}

/**
 * Adds, replaces or removes the `grants` field on every tracked class feature,
 * subclass feature and feat, using the same extractor and overrides as the
 * scraper. Nothing else on the data is touched.
 */
export function enrichTrackedData(data: TrackedData, overrides: GrantOverrides): void {
  const classes = classFeatureRefs(data.classes);
  const feats = featRefs(data.feats);
  // The tracked files hold every class and feat, so an override that names none of them is stale.
  requireEveryOverridePlaced(classes, overrides.classes);
  requireEveryOverridePlaced(feats, overrides.feats);
  applyGrants(classes, overrides.classes);
  applyGrants(feats, overrides.feats);
}

function requireEveryOverridePlaced(refs: GrantRef[], overrides: GrantOverride[]): void {
  const [stale] = unmatchedOverrides(refs.map((ref) => ref.subject), overrides);
  if (stale) throw new Error(`proficiency override matches no feature: ${stale.owner}|${stale.feature}|${stale.level}`);
}

/**
 * Enriches the text of both tracked files. Each file must already be in the
 * tracked format, so that writing it back reproduces every byte that the
 * enrichment did not change.
 */
export function enrichGrantFiles(files: TrackedFiles, overrides: GrantOverrides): TrackedFiles {
  const data = readTracked(files);
  enrichTrackedData(data, overrides);
  return writeTracked(data);
}

/** Removes every `grants` field from features and feats. The inverse of enrichment on the same data. */
export function stripGrantFiles(files: TrackedFiles): TrackedFiles {
  const data = readTracked(files);
  for (const ref of allRefs(data)) delete ref.holder.grants;
  return writeTracked(data);
}

function applyGrants(refs: GrantRef[], overrides: GrantOverride[]): void {
  const resolved = resolveFeatureGrants(
    refs.map((ref) => ref.subject),
    overrides,
    newProficiencyReport()
  );
  resolved.forEach((result, i) => {
    const holder = refs[i].holder;
    if (result.grants.length > 0) holder.grants = result.grants;
    else delete holder.grants;
  });
}

/** The tracked format: JSON.stringify with two-space indent and no trailing newline. */
function readTracked(files: TrackedFiles): TrackedData {
  return {
    classes: parseCanonical(files.classes, "classes.json") as TrackedClass[],
    feats: parseCanonical(files.feats, "feats.json") as TrackedFeat[],
  };
}

function writeTracked(data: TrackedData): TrackedFiles {
  return { classes: canonical(data.classes), feats: canonical(data.feats) };
}

function parseCanonical(text: string, name: string): unknown {
  const data: unknown = JSON.parse(text);
  if (canonical(data) !== text) {
    throw new Error(`${name} is not canonical tracked JSON (two-space indent, no trailing newline); refusing to rewrite it`);
  }
  return data;
}

function canonical(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
