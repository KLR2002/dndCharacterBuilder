# 04: Expertise on proficiencies from the background

**What to build:** A player cannot choose Expertise on skill or tool proficiencies that came from their background. Diagnose which path loses them (the Expertise options reading a partial list of proficiencies, the background not being passed in, or the Expertise picker filtering them out), then fix it narrowly. This overlaps with the Proficiency Sheet spec, which will later feed the same options from the sheet; keep this fix small and note in a comment on this ticket what the sheet ticket must preserve.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A regression test, written first, fails on the current code: a character whose background grants skill proficiencies (fixed and chosen) and tool proficiencies has them offered by every Expertise milestone for its class.
- [ ] Picking Expertise on a background-granted skill or tool gives double proficiency on the card.
- [ ] If the background changes or is removed, the Expertise pick on its proficiency is released by the existing reconciler, with a notice.
- [ ] The diagnosis and what the Proficiency Sheet must preserve are written as a Comment on this ticket.
- [ ] `npm run check:all` passes.

## Comments

**Diagnosis.** The lost path is the catalog bundle, not the reconciler. `ClassProgressionSection` called `getAvailableExpertiseMilestones(character)` and `toggleExpertiseChoice(cur, item)` with no bundle. Without a bundle:
- `resolveCharacterTools` returns no background tool grants at all, so a background's fixed tool (Thieves' Tools for a Rogue) is never offered.
- `skills()` falls back to the static `BACKGROUND_SKILL_PROFICIENCIES` table, so a catalog background's fixed skill that is not in that table is missing. A skill the player chose is still offered, because it sits in `chosenSkills`.
- `toggleExpertiseChoice` then refuses the item, and the "Invalid Expertise Warning" lists it as no longer proficient.

The reconciler already passed the compendium and was not the cause. The card path (`evaluateCharacter`) already passes the resolved background, so its double proficiency was correct.

**Fix.** The catalog bundle is now a required parameter of `getAvailableExpertiseMilestones`, `toggleExpertiseChoice` and `pruneInvalidExpertise`. `ClassProgressionSection` passes the same bundle `BuilderTab` builds (scoped to `activeBooks`). `pruneInvalidExpertise` now appends a `needsReview` notice for each Expertise pick it releases.

**What the Proficiency Sheet must preserve.**
- The Expertise options (the milestone lists, the picker and the Invalid Expertise warning) read the sheet's full list of skills and tools. That list includes catalog background grants, both fixed and chosen.
- The grant lookup stays scoped to the active books, the same as the card.
- No caller falls back to a partial table when it has no bundle. The bundle is required, so the compiler finds any caller that omits it.
- A released Expertise pick gets a `needsReview` notice in the form `<name> Expertise removed: ...`.
- Regression tests: the three `background expertise:` tests in `checks/expertise.test.ts`.
