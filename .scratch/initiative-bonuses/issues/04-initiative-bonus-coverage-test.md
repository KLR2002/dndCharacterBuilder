# 04: A scraper test fails when a feature adds a number to initiative and nobody covered it

**What to build:** The safety net ADR 0016 promises. A test over the tracked data fails whenever a class feature, subclass feature, feat or ancestry trait has prose that adds a number to initiative and carries neither an Initiative Bonus nor a reviewed "adds no bonus" mark, so a newly scraped book is reviewed before it ships. Sentences about advantage, "shares your initiative count" and "when you roll initiative…" are never matched and need no mark. A stale mark or override fails the test too.

**Blocked by:** 02, 03

**Status:** done

**Landed:** fast-forward of `worktree-agent-aa36b9ef547b9d242` (tip a7238f8). `check:all` passes (1261 app, 236 scraper); `check:live` 65/65. `initiativeCoverageGaps` covers class and subclass features, folded options, feats and race/subrace traits; the strict tracked gate is enforced and passes with one mark (Avatar of Battle: allies only). Tandem Footwork and the Ambush maneuver exist only in the live catalog, so they sit on a separate live-only mark list read by a new `check:live` gate. The candidate predicate was narrowed so a bare "Proficiency Bonus" in a roll trigger is not a candidate. Open items: `cli-review.ts` left unchanged (its output is the proficiency review, pinned by a test); Battle Master maneuvers live in `options_and_features.json`, which `enrich:grants` does not write, so Ambush is marked rather than given a bonus; the proficiency gate's `allRefs` still ignores race traits.

- [x] A coverage function over the tracked data (same shape as the proficiency coverage function) reports each uncovered feature once, with its matched sentences, and ignores features that already carry a bonus.
- [x] The gate is enforced on the real tracked data and passes. Where the vocabulary matches a sentence that grants nothing to the character (for example a bonus that reaches only allies, or one that must be spent or triggered), the feature is added to a reviewed-no-bonus list in the override area with a one-line reason.
- [x] Invented-data tests cover: an uncovered sentence is a gap; a feature with a bonus is covered whatever its prose says; a reviewed mark covers a feature; a mark naming no feature throws; a mark on a feature that has a bonus throws; advantage, shared-count and roll-trigger sentences are not gaps.
- [x] The review tooling used for proficiency coverage lists these gaps too, or a short note says why it does not (left unchanged: its output is the proficiency review, pinned by a test).
- [x] `npm run check:all` passes.
