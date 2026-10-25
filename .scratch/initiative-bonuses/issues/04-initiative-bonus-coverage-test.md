# 04: A scraper test fails when a feature adds a number to initiative and nobody covered it

**What to build:** The safety net ADR 0016 promises. A test over the tracked data fails whenever a class feature, subclass feature, feat or ancestry trait has prose that adds a number to initiative and carries neither an Initiative Bonus nor a reviewed "adds no bonus" mark, so a newly scraped book is reviewed before it ships. Sentences about advantage, "shares your initiative count" and "when you roll initiative…" are never matched and need no mark. A stale mark or override fails the test too.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] A coverage function over the tracked data (same shape as the proficiency coverage function) reports each uncovered feature once, with its matched sentences, and ignores features that already carry a bonus.
- [ ] The gate is enforced on the real tracked data and passes. Where the vocabulary matches a sentence that grants nothing to the character (for example a bonus that reaches only allies, or one that must be spent or triggered), the feature is added to a reviewed-no-bonus list in the override area with a one-line reason.
- [ ] Invented-data tests cover: an uncovered sentence is a gap; a feature with a bonus is covered whatever its prose says; a reviewed mark covers a feature; a mark naming no feature throws; a mark on a feature that has a bonus throws; advantage, shared-count and roll-trigger sentences are not gaps.
- [ ] The review tooling used for proficiency coverage lists these gaps too, or a short note says why it does not.
- [ ] `npm run check:all` passes.
