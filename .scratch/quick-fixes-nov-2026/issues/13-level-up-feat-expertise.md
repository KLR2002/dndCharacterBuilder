# 13: Level Up asks for the Expertise a picked feat brings

**What to build:**

- **The problem.** A Rogue 3 who takes Skill Expert on the Level-Up Flow's ASI/Feat step is never asked for the feat's Expertise. The plan reads its Expertise milestones in `planLevelUp` before the ASI/Feat pick exists, and `setPlanAsi` never reads them again, so the plan has no `feat_skill_expert` milestone and often no Class Choices step. The character saves with the pick open, to be made in Edit Build. Prodigy is the same.
- **The fix.** The plan's Expertise milestones are read on the planned character with the plan's ASI/Feat pick added:
  - `newExpertiseMilestones` in `src/rules/classChoices.ts` takes an optional `asi?: AsiSelection`. The milestones held before the level are still read on `character`. The new ones are read on `holding(character, entry)` with `asi` appended to `asiSelections`. So a feat milestone counts as new.
  - `plannedLevelChoices` in `src/rules/levelUpFlow.ts` passes the plan's ASI/Feat pick through. `planLevelUp` passes `options.picks?.asi`, and `setPlanSubclass` passes `plan.picks.asi` so a subclass change keeps the feat's milestone.
  - `setPlanAsi` becomes `setPlanAsi(character, plan, asi, opts)`, the same shape as `setPlanSubclass`. It sets the pick, then reads the level's choices again on it:
    - It sets `expertiseMilestones`.
    - It adds or removes the Class Choices step, kept in `STEP_ORDER`.
    - It drops Expertise picks no milestone offers any more, the way `setPlanSubclass` does.
    - It leaves every other pick and step alone.
  - `classChoicesLevelView` takes the ASI/Feat pick too, and `levelUpClassChoicesView` passes `plan.picks.asi`. The Class Choices step then shows the feat's milestone, and `applies` counts it.
  - `applyLevelUpPlan` applies the Expertise picks after the ASI/Feat pick and its feat picks, not before. `toggleExpertiseChoice` reads the milestones on the character, and the feat's milestone exists only once the feat is held.
  - `src/app/levelup/[id].tsx` calls `setPlanAsi(character, plan, asi, flowOpts)`.
- **Not in scope.** The feat's own skill pick (Skill Expert's proficiency) stays on the saved feat card, as in the builder. The Expertise options are the skills and tools the character already has.

**Blocked by:** None

**Status:** open

- [ ] Tests in `checks/levelUpFlowPlan.test.ts` (or a new `checks/levelUpFeatExpertise.test.ts`), red first. Use the integrated test catalog (`loadTestCatalog("classes")` and `loadTestCatalog("feats")`, `ALL_BOOKS`), since Skill Expert is TCE. Base character: a Rogue 3 (Thief) with Stealth, Perception, Deception and Acrobatics, Thieves' Tools, and Expertise in Stealth and Perception.
  - Planning Rogue 4 and setting Skill Expert (featAbility `dex`) with `setPlanAsi` adds the Class Choices step and a `feat_skill_expert` milestone. Its options leave out Stealth and Perception.
  - The Class Choices step is not complete until one Expertise is picked, and then it is.
  - The applied plan saves `chosenExpertise` as Stealth, Perception and the pick, with Skill Expert in `asiSelections`.
  - Switching the pick back to a plain ASI removes the step, the milestone and the Expertise pick.
  - The Review rows include `Expertise` with the pick.
  - `levelUpClassChoicesView` on the plan has `applies` true and lists the feat's milestone.
  - A plan with no feat is unchanged: the existing tests still pass.
- [ ] `npm run check:all` passes.
- [ ] Seen in the running app on the integrated catalog at 320 and 1280 (main session).
