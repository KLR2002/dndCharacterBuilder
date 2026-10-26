import type { ReviewedFeature } from "../overrides/proficiency-grants.ts";
import { featureKey } from "../parser/proficiency-grants.ts";
import { candidateSentences } from "../parser/initiative-bonuses.ts";
import type { CoverageGap } from "./coverage.ts";
import { classFeatureRefs, featRefs, optionRecordRefs, traitRefs, type GrantRef, type TrackedData } from "./subjects.ts";

/**
 * The features whose prose adds a number to initiative and that carry neither an Initiative Bonus nor a
 * reviewed mark (ADR 0016). Each is reported once per key, with its candidate sentences. Covers class features,
 * subclass features, folded options, feats and race and subrace traits. Throws when a mark names no feature, and
 * when a mark names a feature that has an Initiative Bonus, so a stale mark cannot hide a gap.
 *
 * Refs that share an owner, feature and level (two sources with one name) share a key. A mark applies to every
 * ref under its key and fails if any of them has a bonus. A gap is reported from the first ref under its key
 * that has candidates and no bonus.
 */
export function initiativeCoverageGaps(data: TrackedData, marks: ReviewedFeature[]): CoverageGap[] {
  const byKey = refsByKey(initiativeRefs(data));

  const marked = new Set<string>();
  for (const mark of marks) {
    const k = featureKey(mark);
    const refs = byKey.get(k);
    if (!refs) throw new Error(`reviewed initiative mark matches no feature: ${k}`);
    if (refs.some(hasBonus)) throw new Error(`reviewed initiative mark names a feature that has an Initiative Bonus: ${k}`);
    marked.add(k);
  }

  const gaps: CoverageGap[] = [];
  for (const [k, refs] of byKey) {
    if (marked.has(k)) continue;
    for (const ref of refs) {
      const sentences = candidateSentences(ref.subject.description);
      if (sentences.length === 0 || hasBonus(ref)) continue;
      gaps.push({ owner: ref.subject.owner, feature: ref.subject.feature, level: ref.subject.level, sentences });
      break;
    }
  }
  return gaps;
}

/**
 * Every feature that can carry an Initiative Bonus: class and subclass features with their options, feats, race and
 * subrace traits, and Options and Features records when the caller reads them.
 */
function initiativeRefs(data: TrackedData): GrantRef[] {
  return [
    ...classFeatureRefs(data.classes),
    ...featRefs(data.feats),
    ...traitRefs(data.races ?? []),
    ...optionRecordRefs(data.optionsAndFeatures ?? []),
  ];
}

function refsByKey(refs: GrantRef[]): Map<string, GrantRef[]> {
  const byKey = new Map<string, GrantRef[]>();
  for (const ref of refs) {
    const k = featureKey(ref.subject);
    byKey.set(k, [...(byKey.get(k) ?? []), ref]);
  }
  return byKey;
}

function hasBonus(ref: GrantRef): boolean {
  return ref.holder.initiativeBonus !== undefined;
}

