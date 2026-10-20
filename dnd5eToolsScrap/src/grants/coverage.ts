import type { ReviewedFeature } from "../overrides/proficiency-grants.ts";
import { matchedSentences } from "../parser/proficiency-grants.ts";
import { allRefs, type GrantRef, type TrackedData } from "./subjects.ts";

/** A feature whose prose matches the proficiency vocabulary, with neither grants nor a mark. */
export interface CoverageGap extends ReviewedFeature {
  /** The matched sentences only, without their final punctuation. */
  sentences: string[];
}

/**
 * The features that match the proficiency vocabulary and are neither covered by
 * grants nor marked as granting nothing. Reads the enriched data as it is and
 * runs no extraction. Throws when a mark names no feature, or a feature that
 * has grants, so a stale mark cannot hide a gap.
 */
export function coverageGaps(data: TrackedData, marks: ReviewedFeature[]): CoverageGap[] {
  const refs = allRefs(data);
  const byKey = new Map<string, GrantRef>();
  for (const ref of refs) {
    const k = featureKey(ref.subject);
    if (byKey.has(k)) throw new Error(`duplicate tracked feature: ${k}`);
    byKey.set(k, ref);
  }

  const marked = new Set<string>();
  for (const mark of marks) {
    const k = featureKey(mark);
    const ref = byKey.get(k);
    if (!ref) throw new Error(`reviewed mark matches no feature: ${k}`);
    if (hasGrants(ref)) throw new Error(`reviewed mark names a feature that has grants: ${k}`);
    marked.add(k);
  }

  const gaps: CoverageGap[] = [];
  for (const ref of refs) {
    const sentences = matchedSentences(ref.subject.description);
    if (sentences.length === 0 || hasGrants(ref) || marked.has(featureKey(ref.subject))) continue;
    gaps.push({ owner: ref.subject.owner, feature: ref.subject.feature, level: ref.subject.level, sentences });
  }
  return gaps;
}

/** A gap as one line for a failure message: `Owner / Feature (level N)`. */
export function gapName(gap: Pick<CoverageGap, "owner" | "feature" | "level">): string {
  return `${gap.owner} / ${gap.feature} (level ${gap.level})`;
}

function hasGrants(ref: GrantRef): boolean {
  return ref.holder.grants !== undefined && ref.holder.grants.length > 0;
}

function featureKey(s: ReviewedFeature): string {
  return `${s.owner}|${s.feature}|${s.level}`;
}
