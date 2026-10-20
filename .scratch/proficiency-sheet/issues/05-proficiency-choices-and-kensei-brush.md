# 05: Proficiency Choices and the Kensei brush

**What to build:** Proficiency Choices (a rule offering a pool) can be picked in the Class & Subclass Choices card, shown as "Picked N / M", and saved per grant id. A Way of the Kensei monk chooses calligrapher's supplies or painter's supplies, and the pick appears on the sheet. Old saved choice buckets (race, background and class tools and languages) keep being read and are never rewritten. A pick whose grant no longer applies is released by the reconciler with a notice. Pickers hide what the character already has; a fixed grant that duplicates is kept once.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Picks are saved in a store keyed by grant id; a guard test fails if an existing grant id is renamed or disappears.
- [ ] Old buckets are still read and are not rewritten.
- [ ] "Picked 0 / N" appears for an unmade choice and blocks nothing.
- [ ] A Kensei monk can choose either tool, and the choice shows on the sheet and the card.
- [ ] Changing the subclass releases the pick through `reconcile()` with a `needsReview` notice, and reconciling a valid character returns it unchanged.
- [ ] Saved picks are kept when the catalog is missing and take effect again when it returns.
- [ ] The picker hides held proficiencies.
- [ ] The new rows pass `npm run layout:check` in both modes, with a seed that shows the choice.
- [ ] `npm run check:all` passes.
