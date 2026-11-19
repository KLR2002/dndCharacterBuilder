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
  - `checks/classSkillChoice.test.ts` "…holds once the Integrated Catalog is synced, and back" and "…saved under its SRD-named id moves…" still pass. The second calls `reconcile`; switch it to `migrateSavedPicks` if the alias move leaves `reconcile`.
  - `reconcile` alone no longer moves a legacy class tool bucket: proof the pass left.
- [ ] Every existing test of a moved pass that called `reconcile` to trigger the move calls `migrateSavedPicks` instead; list them.
- [ ] `npm run check:all` and `npm run check:live` pass.
- [ ] Scoped layout: `ONLY=Builder WIDTHS=393` and `ONLY="Level-Up" WIDTHS=393`, SRD and `-- --integrated`, green.

## Comments

Classification of the reconciler passes. Writers are the `src/` sites that write the field the pass reads.

| Pass | Input the pass reads | Writers (file:line) | Verdict |
| --- | --- | --- | --- |
| `moveLegacyFightingStyleIds` | a class style id under another source than the class is held under | `rules/choices/types.ts:159` (`setRuleChoicePick`), ids from `heldStyleId` (`rules/choices/fightingStyles.ts:57`), reading the same unscoped class list as the pass (`fightingStyles.ts:138`) | migrate |
| `moveAliasedProficiencyPicks` | a `proficiencyPicks` key that is a former grant id | `rules/proficiencyPools.ts:219-224` writes `grant.id`; `components/levelUpFlow/ClassChoicesStep.tsx:18` writes the choice id | migrate; runs in `reconcileForActiveBooks` on a Catalog change |
| `moveLegacyClassToolPicks` | `chosenTools.class` | none (`BackgroundSection.tsx:530-531` and `ancestryEngine.ts:152-153` write other buckets) | migrate |
| `moveLegacyClassSkillPicks` | a first-class `skillChoices` entry (`Class: <name>` or `class__…`) | none; `builderTransitions.ts:647-648` only filters; `migrateCharacter.ts:137-139` writes it on load | migrate |
| `moveLegacySourcePicks` | race and background `chosenTools` and `chosenLanguages` buckets | none that add a name; empties at `ancestryEngine.ts:175-176`, `builderTransitions.ts:951-952`, `BackgroundSection.tsx:530-531` (the pass ignores empty buckets) | migrate |
| `moveLegacySkillPicks` | `skillChoices` entries with origin race or background | none that add; removals at `builderTransitions.ts:472`, `:886`, `:950` | migrate |
| `moveExpertisePicksToGrants` | `chosenExpertise` names that no milestone holds and a skill grant offers | `expertise.ts:225`, `:245` (`toggleExpertiseChoice`, called from `levelUpFlow.ts:311` and `classChoiceWiring.ts:36`); a level or class removal can leave a name a grant now offers | stays in `reconcile` (Expertise milestones still write `chosenExpertise`) |
| `dropLegacyMulticlassSkillEntries` | an empty `multiclass_skill_*` entry | none; the id is only read at `builderTransitions.ts:641` | migrate |
| `dropLegacyBackgroundSkills` | a background skill copy in `chosenSkills` whose background is off | none that add to `chosenSkills`; removals at `builderTransitions.ts:473`, `:648`, `:882`, `:949`; a book switch is a `reconcileForActiveBooks` trigger | migrate |
| `moveLegacyInnateCounters` | a `resourceCounters` key `innate_spell_*` whose current id differs | `grantedSpells.ts:289-291`: a race's counter already has its current id; feat counters use `featCounterId` | migrate |
| `renameSrdNames` | an SRD name a Catalog prints under another name | none; a Catalog change | migrate (moved into the step) |

Decisions:
- `migrateSavedPicks` runs on load for every character (`CharacterContext.tsx`, in place of the `renameSrdNames` call) and first in `reconcileForActiveBooks`, before `reconcile`.
- Call sites of `migrateSavedPicks`: `src/context/CharacterContext.tsx` (load) and `src/rules/characterReconciler.ts` (`reconcileForActiveBooks`). Creation (`createCharacter`) does not call it: a new record holds no saved picks. The only other load path is `e2eSeedImport.ts`, which writes storage read back through the same load.
- `checks/legacyFieldsGuard.test.ts` covers `ruleChoices` and `resourceCounters` by file, not by id, because both are current fields. A new write inside an allowed file is not caught.
