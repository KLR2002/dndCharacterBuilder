# 03: A saved feat increase outside its pool is released with a notice

**What to build:** A feat pick's saved `featAbility` (in `asiSelections` or `originFeats`) that is not in the feat's Increase Choice (`featIncreaseOptions` from ticket 02) is released during reconcile (`src/rules/characterReconciler.ts`) with a review notice, the way a race's Increase Choice pick that leaves its pool is released (ADR 0019; find how `ancestryIncreases.ts` / `originCustomization.ts` and the reconciler do it and follow the same path and notice style). When the feat has no Increase Choice in the catalog (stale catalog, or the feat states none) the saved pick is kept and still counts: only a pool that exists and excludes the pick releases it. A fixed increase is never a saved choice and is not affected. Both the `featAbility` and the matching `asi` entry go, so the score drops by one.

**Blocked by:** 02

**Status:** done

**Landed:** 9d857f6. `src/rules/featIncrease.ts` (leaf module: `findFeat`, `featIncreaseOptions`, `releaseFeatIncreasesOutsidePool`; `featSlot.ts` re-exports them) avoids the reconciler → featSlot → builderTransitions import cycle. A released pick loses `featAbility` and `asi` (`effectiveScores` reads `asi` first), keeps the feat. Skipped while `compendium.stale`. check:all and check:live passed.

- [x] Tests (red first, paste it): a Resilient pick saved with `featAbility: "con"` against a catalog whose Resilient offers only `["str","dex"]` is released with one notice naming the feat; the same pick against a catalog with no `abilityScoreChoices` on Resilient is kept with no notice; an origin feat behaves the same as an ASI feat.
- [x] `npm run check:all` passes.
