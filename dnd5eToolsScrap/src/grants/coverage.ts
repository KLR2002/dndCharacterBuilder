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
 *
 * Tracked refs can share an owner, feature and level when they come from
 * different sources (two classes with one name). A mark names that key, so it
 * applies to every ref under it, and it fails if any of them has grants. A gap
 * is reported once per key, from the first ref under it that has none.
 */
export function coverageGaps(data: TrackedData, marks: ReviewedFeature[]): CoverageGap[] {
  const byKey = new Map<string, GrantRef[]>();
  for (const ref of allRefs(data)) {
    const k = featureKey(ref.subject);
    byKey.set(k, [...(byKey.get(k) ?? []), ref]);
  }

  const marked = new Set<string>();
  for (const mark of marks) {
    const k = featureKey(mark);
    const refs = byKey.get(k);
    if (!refs) throw new Error(`reviewed mark matches no feature: ${k}`);
    if (refs.some(hasGrants)) throw new Error(`reviewed mark names a feature that has grants: ${k}`);
    marked.add(k);
  }

  const gaps: CoverageGap[] = [];
  for (const [k, refs] of byKey) {
    if (marked.has(k)) continue;
    for (const ref of refs) {
      const sentences = matchedSentences(ref.subject.description);
      if (sentences.length === 0 || hasGrants(ref)) continue;
      gaps.push({ owner: ref.subject.owner, feature: ref.subject.feature, level: ref.subject.level, sentences });
      break;
    }
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
