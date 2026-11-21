# 06: Level-up offers the new level's Expertise and optional features

**What to build:** The Level-Up Flow offers no Expertise picks and no optional features; a Rogue reaching 6 picks Expertise later in Edit Build. Add to the plan's picks (`LevelUpPicks`, `src/rules/levelUpFlow.ts:63`) the new level's Expertise picks and optional-feature toggles, offered by `ClassChoicesStep` through `ClassChoiceCards` from the view for the new level only (milestones and optional features gained at that class level), and applied in `applyLevelUpPlan` (~203) through the same transitions the builder uses (find how `ClassProgressionSection`/its successor records Expertise and `setOptionalFeatureEnabled`). The step is incomplete while an Expertise pick of the new level is missing; optional features never block. `flowSteps` shows the Class Choices step when the new level brings only Expertise or only optional features. The Review summary (`levelUpSummary` ~636) lists the picks.

**Blocked by:** 07

**Status:** done

**Landed:** merge of the two ticket-06 commits. `newExpertiseMilestones` keeps the planned character's milestones whose id the current character lacks, minus options already claimed; the plan stores `expertiseMilestones`, `expertisePicks` and `optionalFeatures`; `applyLevelUpPlan` applies them through `toggleExpertiseChoice` and `setOptionalFeatureEnabled`; Review rows "Expertise" and "Optional & Replacement Class Features". The step now appears for a level that brings only an optional feature (Barbarian 2 → 3 Primal Knowledge; also Fighter 3 → 4 Martial Versatility and Wizard 2 → 3 Cantrip Formulas, whose step-list tests were updated). New integrated scenario `Level-Up Flow expertise` (Rogue 5 → 6) green at 320, 393, 1280; no scenario covers the optional-feature card in the Level-Up step. check:all and check:live passed.

- [x] Tests (red first): a Rogue 5 → 6 plan has a Class Choices step with two Expertise picks, is incomplete until both are picked, and the applied character holds them; a level that brings only an optional feature shows the step, which is complete untouched; Review lists the picks.
- [x] Scoped layout: Level-Up scenarios at 320, 393, 1280 (add a Rogue 5 → 6 scenario if none reaches Expertise; check its screenshot). `npm run check:all` and `npm run check:live` pass. Last ticket: the main session runs the full layout gate.
