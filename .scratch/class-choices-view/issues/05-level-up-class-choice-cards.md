# 05: The Level-Up Class Choices step shows the same cards

**What to build:** `src/components/levelUpFlow/ClassChoicesStep.tsx` renders `plan.classChoices` as a flat `RuleChoicePicker` list. Render `ClassChoiceCards` (ticket 04) instead, from `classChoicesStepView` evaluated for the new level only (`classChoicesAtLevel(character, entry, fromLevel)` semantics: the plan's class entry, after the previous level), with the callbacks writing to the plan (`setPlanClassChoicePick`, `src/rules/levelUpFlow.ts:543`). Groups, card titles and chosen-option descriptions match the builder. Expertise and optional features are not offered yet (ticket 06); the view's fields for them are empty or ignored here. `levelUpStepComplete` (~585) reads the view's `complete` for this step.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Level-Up tests pass; one new test: a Fighter 2 → 3 Battle Master plan's step lists its maneuvers in the maneuver group.
- [ ] Scoped layout: the Level-Up scenarios at 320, 393, 1280 (`-- --integrated`); open one screenshot of the Class Choices step and describe it. `npm run check:all` passes.
