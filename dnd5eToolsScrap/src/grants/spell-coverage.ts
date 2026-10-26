import type { ReviewedFeature } from "../overrides/proficiency-grants.ts";
import { featureKey } from "../parser/proficiency-grants.ts";
import { readsSpellGrants, spellGrantSentences } from "../parser/spell-grant-prose.ts";
import type { CoverageGap } from "./coverage.ts";
import { featRefs, type GrantRef, type TrackedData } from "./subjects.ts";

/**
 * The feats that grant spells, in their prose or their structured grants, and that the reader does not turn into Innate
 * Magic, with no reviewed mark (ADR 0017). A feat is covered when its spell grants are ones the reader reads. Each gap is
 * reported once per key, with its grant sentences (none when the feat has structured grants only). Throws when a mark
 * names no feat, and when a mark names a feat that the reader covers, so a stale mark cannot hide a gap.
 *
 * Refs that share an owner, feature and level (two sources with one name) share a key. A mark applies to every ref under
 * its key and fails if any of them is covered. A gap is reported from the first ref under its key that is not covered.
 */
export function spellCoverageGaps(data: TrackedData, marks: ReviewedFeature[]): CoverageGap[] {
  const byKey = refsByKey(featRefs(data.feats));

  const marked = new Set<string>();
  for (const mark of marks) {
    const k = featureKey(mark);
    const refs = byKey.get(k);
    if (!refs) throw new Error(`reviewed spell mark matches no feature: ${k}`);
    if (refs.some(isCovered)) throw new Error(`reviewed spell mark names a feature that has spell grants: ${k}`);
    marked.add(k);
  }

  const gaps: CoverageGap[] = [];
  for (const [k, refs] of byKey) {
    if (marked.has(k)) continue;
    for (const ref of refs) {
      if (isCovered(ref) || !isCandidate(ref)) continue;
      const sentences = spellGrantSentences(ref.subject.description);
      gaps.push({ owner: ref.subject.owner, feature: ref.subject.feature, level: ref.subject.level, sentences });
      break;
    }
  }
  return gaps;
}

/** A feat whose prose grants a spell, or that carries structured spell grants, is a candidate for the gate. */
function isCandidate(ref: GrantRef): boolean {
  return spellGrantSentences(ref.subject.description).length > 0 || (ref.holder.additionalSpells?.length ?? 0) > 0;
}

function isCovered(ref: GrantRef): boolean {
  return readsSpellGrants(ref.holder.additionalSpells);
}

function refsByKey(refs: GrantRef[]): Map<string, GrantRef[]> {
  const byKey = new Map<string, GrantRef[]>();
  for (const ref of refs) {
    const k = featureKey(ref.subject);
    byKey.set(k, [...(byKey.get(k) ?? []), ref]);
  }
  return byKey;
}
