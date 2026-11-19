# 03: Legacy moves run on load and catalog change

**What to build:**

- **Classify each pass first.** These run in `reconcile` (`src/rules/characterReconciler.ts` ~82-103):
  - `moveLegacyFightingStyleIds`
  - `moveAliasedProficiencyPicks`
  - `moveLegacyClassToolPicks`
  - `moveLegacySourcePicks`
  - `moveLegacySkillPicks`
  - `moveLegacyClassSkillPicks` (ticket 02)
  - `moveExpertisePicksToGrants`
  - `dropLegacyMulticlassSkillEntries`
  - `dropLegacyBackgroundSkills`
  - `moveLegacyInnateCounters`

  For each, find what it reads (a field, or a value inside one) and every place in `src/` that writes it. Grep and paste the writers.
  - A pass whose input only old saves or a catalog change can produce is a migration.
  - A pass whose input a current transition writes stays in `reconcile`. `moveExpertisePicksToGrants` is a suspect: Expertise milestones still write `chosenExpertise`.

  Put the table (pass, input, writers, verdict) in your report and in a `## Comments` section of this ticket.
- **The step.** Add `src/rules/savedPicksMigration.ts` with `migrateSavedPicks(character, compendium, activeBooks)`:
  - It runs the migration passes in their current order, then `renameSrdNames`.
  - It returns the same object when nothing changes.
  - Remove those passes from `reconcile`.
- **Where it runs (ADR 0026).**
  - On load: `src/context/CharacterContext.tsx`, in place of the `renameSrdNames` call after `migrateCharacter`, for every character.
  - In `reconcileForActiveBooks` (`characterReconciler.ts` ~117), before `reconcile`. The context calls it when the books or the catalog change and when a character is opened.
- **Guard.** `checks/legacyFieldsGuard.test.ts` lists, with a reason each, the files allowed to write these fields:
  - `chosenSkills`, `skillChoices`
  - `chosenTools`, `chosenLanguages`
  - `chosenExpertise`, if it stays a current field: say which
  - the legacy fighting-style and innate-counter fields the passes read

  Any other write fails. Make it fail once on a planted write, then remove the plant.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Tests, `checks/savedPicksMigration.test.ts`:
  - A character holding every legacy shape (one per migration pass, built from that pass's existing tests) comes out of `migrateSavedPicks` with each moved, and `reconcile` then leaves it unchanged.
  - `migrateSavedPicks` is idempotent.
  - A Proficiency Choice pick saved under a grant alias moves when `reconcileForActiveBooks` runs with a compendium whose grant carries that alias. That is the catalog-change case.
  - `reconcile` alone no longer moves a legacy class tool bucket: proof the pass left.
- [ ] Every existing test of a moved pass that called `reconcile` to trigger the move calls `migrateSavedPicks` instead; list them.
- [ ] `npm run check:all` and `npm run check:live` pass.
- [ ] Scoped layout: `ONLY=Builder WIDTHS=393` and `ONLY="Level-Up" WIDTHS=393`, SRD and `-- --integrated`, green.
