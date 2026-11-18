# 02: One view for the Class Choices step

**What to build:** Add `classChoicesStepView(character, query)` to `src/rules/classChoices.ts`. Over every held class (the way `creationFlow.ts` `classChoicesOf` ~255 combines `classChoicesAtLevel(character, entry, 0, query)`), it returns: the starting skill picks and the skill Proficiency Choices (`skillPickOffers`) for the Skills card; the rule choices split by `group` (ticket 01: fightingStyle, maneuver, warlock, infusion, other) with the non-skill class and subclass Proficiency Choices in other; the Expertise milestones and picks (`getAvailableExpertiseMilestones`, `getMilestonePicks` from `src/rules/expertise.ts`) including invalid saved picks; the optional features available (find what `BuilderTab` passes as `availableOptionalFeatures` and move that derivation behind the view); and `complete` (every skill pick, proficiency choice, rule choice and Expertise pick filled; optional features never block). Feat-origin Proficiency Choices stay where they are today in this ticket (ticket 03 moves them).

Then: `creationFlow.ts` decides the Class Choices step's skip and completeness from the view (Expertise now counts), and `ClassProgressionSection.tsx`'s Class Choices and Expertise parts read their lists from the view instead of assembling them (~556-870). No visible change.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Tests (red first): a Rogue 1 with no Expertise picked has `complete: false`, and with two picked `true`; a class with only optional features available is `complete: true`; the view lists the same choices, in the same groups, as the section did before for the characters from ticket 01's test.
- [ ] `ClassProgressionSection.tsx` no longer calls `offeredRuleChoices`, `proficiencyChoiceOffers`, `skillPickOffers` or `getAvailableExpertiseMilestones` (paste the grep).
- [ ] Creation Flow tests (`checks/creationFlow*.test.ts`) pass; add one: a Rogue draft at the Class Choices step is not complete until Expertise is picked.
- [ ] Scoped layout: the Creation Flow and class-choice scenarios at 393. `npm run check:all` passes.
