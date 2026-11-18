# 04: One component per Creation Step

**What to build:** `src/components/builder/ClassProgressionSection.tsx` hosts five Creation Steps behind `step` checks (`(!step || step === "class")` ~267, `"subclass"` ~457, `"classChoices"` ~556 and ~783 and ~923, `"asiFeats"` ~870, `"equipment"` ~885 and ~901) with 25 props. Split it into one component per step under `src/components/builder/` (for example `ClassLevelsSection`, `SubclassSection`, `ClassChoicesSection`, the ASI/Feats host, `ClassEquipmentSection`), each taking only the props its part uses. The Class Choices part renders a `ClassChoiceCards` component (`src/components/builder/ClassChoiceCards.tsx`) that takes the view from `classChoicesStepView` plus callbacks (`onToggleRuleChoice(choice, option)`, `onClearChoice(choice)`, `onToggleExpertise`, `onToggleOptionalFeature`, and the starting skill pick's `toggleSkill`), so the Level-Up Flow can use it with plan callbacks (ticket 05). `BuilderTab.tsx` (~452) renders the step's component when `step` is set and all of them in order when it is not (free-form builder). Shared state (subclass change warning, `applySoleSubclasses` effect) goes with the part that uses it. No visible change.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] No component file over 500 lines from the split; `ClassProgressionSection.tsx` is gone or only re-exports (say which). Line counts in the report.
- [ ] Scoped layout: the Creation Flow, Edit Build and builder class/subclass/class-choice/equipment scenarios at 320 and 393, and 1280 for one wide one. `npm run check:all` passes.
