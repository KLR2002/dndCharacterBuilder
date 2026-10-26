import type { ReviewedFeature } from "../overrides/proficiency-grants.ts";
import { featureKey } from "../parser/proficiency-grants.ts";
import { readsSpellGrants, spellGrantSentences } from "../parser/spell-grant-prose.ts";
import type { CoverageGap } from "./coverage.ts";
import type { TrackedData, TrackedFeat } from "./subjects.ts";

/**
 * The feats that grant spells, in their prose or their structured grants, and that the reader does not turn into Innate
 * Magic, with no reviewed mark (ADR 0017). A feat is covered when its spell grants are ones the reader reads. Each gap is
 * reported once per key, with its grant sentences (none when the feat has structured grants only). Throws when a mark
 * names no feat, and when a mark names a feat that the reader covers, so a stale mark cannot hide a gap.
 *
 * Feats that share a name (two sources of one feat) share a key. A mark applies to every feat under its key and fails if
 * any of them is covered. A gap is reported from the first feat under its key that is not covered.
 */
export function spellCoverageGaps(data: TrackedData, marks: ReviewedFeature[]): CoverageGap[] {
  const byKey = featsByKey(data.feats);

  const marked = new Set<string>();
  for (const mark of marks) {
    const k = featureKey(mark);
    const feats = byKey.get(k);
    if (!feats) throw new Error(`reviewed spell mark matches no feature: ${k}`);
    if (feats.some(isCovered)) throw new Error(`reviewed spell mark names a feature that has spell grants: ${k}`);
    marked.add(k);
  }

  const gaps: CoverageGap[] = [];
  for (const [k, feats] of byKey) {
    if (marked.has(k)) continue;
    for (const feat of feats) {
      if (isCovered(feat) || !isCandidate(feat)) continue;
      const sentences = spellGrantSentences(feat.description);
      gaps.push({ owner: FEAT_OWNER, feature: feat.name, level: FEAT_LEVEL, sentences });
      break;
    }
  }
  return gaps;
}

/** Feats are their own grant owner at level 0, as the proficiency and initiative gates key them (src/grants/subjects.ts). */
const FEAT_OWNER = "Feat";
const FEAT_LEVEL = 0;

/** A feat whose prose grants a spell, or that carries structured spell grants, is a candidate for the gate. */
function isCandidate(feat: TrackedFeat): boolean {
  return spellGrantSentences(feat.description).length > 0 || (feat.additionalSpells?.length ?? 0) > 0;
}

function isCovered(feat: TrackedFeat): boolean {
  return readsSpellGrants(feat.additionalSpells);
}

function featsByKey(feats: TrackedFeat[]): Map<string, TrackedFeat[]> {
  const byKey = new Map<string, TrackedFeat[]>();
  for (const feat of feats) {
    const k = featureKey({ owner: FEAT_OWNER, feature: feat.name, level: FEAT_LEVEL });
    byKey.set(k, [...(byKey.get(k) ?? []), feat]);
  }
  return byKey;
}
