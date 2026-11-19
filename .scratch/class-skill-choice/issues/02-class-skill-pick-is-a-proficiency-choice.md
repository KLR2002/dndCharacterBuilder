# 02: The class skill pick is a Proficiency Choice

**What to build:**

- **The grant.** In `src/rules/proficiencySources/classBase.ts`, add `startingSkillGrantOf(cls)` beside `multiclassSkillGrantOf`.
  - It reads the class record's `startingProficiencies.skills` entry that has a `choose`.
  - Grant id: `${cls.source}/${cls.name}/Starting Proficiencies@1#skills:choice:from`, or `:any` when the pool is any skill.
  - Count and pool come from the record.
  - `startingFeatureOf` in `src/rules/proficiencySheet.ts` (~215) puts it on the first class's Starting Proficiencies feature, next to `cls.grants`. A class with no `grants` (the Fighter) now gets the feature too.
  - Amend ADR 0015's last bullet to name the starting skill choice as well.
- **Offer and pick.** The pick reaches the Class Choices step through `proficiencyChoiceOffers` and `skillPickOffers`, as the multiclass skill pick does, and is picked with `pickRuleChoice` and cleared with `clearProficiencyPick`. Remove the old path:
  - `toggleSkill` and `getPickedSkillsForSource` in `BuilderTab.tsx` (~240-343)
  - `skillChoiceOffers` (`proficiencySheet.ts` ~510)
  - `startingSkills` and its completeness check in `classChoices.ts` (`classChoicesAtLevel` ~69/~86, `classChoicesStepView` ~242/~260); `ClassLevelChoices.skillChoices`
  - `onToggleStartingSkill` and the starting-skill card in `ClassSteps.tsx` and `ClassChoiceCards.tsx`
  - `skillChoices: [], chosenSkills: []` in the level-up `ClassChoicesStep.tsx` (~30)
- **The sheet must not count a pick twice or lose one.** Until a character's legacy entry has moved, the sheet reads the class's legacy `skillChoices` entry and `chosenSkills` as it does today. Once moved, it reads the pick.
- **Moving saved picks.** `moveLegacyClassSkillPicks(character, compendium)` in `src/rules/proficiencyPicks.ts`:
  - It moves the names of a first-class legacy entry into the grant's pick, up to the grant's count, using the pool's spelling. A legacy entry has origin `"class"`, with id `"Class: <name>"` or migrateCharacter's `class__<name>__<source>__skills`.
  - It removes moved names from `chosenSkills` unless another legacy entry still holds them.
  - It drops an entry once all its names have moved; a name it cannot place stays, where the sheet keeps reading it.

  Add it to `reconcile` beside `moveLegacySkillPicks` (ticket 03 moves the passes out).
- **Removing the first class** (`removeClassLevel` ~633-645): the class's grant goes, so `pruneInvalidProficiencyPicks` releases the pick. Drop the id-prefix pruning of class `skillChoices`, unless a legacy entry not yet moved still needs it; say which.
- **Review step.** `ReviewStep.tsx` shows the character's skills from the Proficiency Sheet (`proficiencySheet(...).skills`), not `chosenSkills`.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merge c88e3d0 (0d1a87f, f13cdf9); review fix 028ac12.
- **The grant:** `startingSkillGrantOf` in `classBase.ts` reads the record's `skillProficiencies` (the Catalog's name for the starting skills) and goes on the Starting Proficiencies feature. The pick is titled "<Class> starting skills".
- **The old path is removed:** `toggleSkill`, `getPickedSkillsForSource`, `skillChoiceOffers`, `startingSkills`, `SkillPicker`, and the starting-skill props in ClassSteps, ClassChoiceCards and the level-up step. ReviewStep lists the sheet's skills.
- **The move:** `moveLegacyClassSkillPicks` runs in `reconcile`. The sheet reads a legacy entry until it moves.
- **Class removal:** the pruner releases the pick when the class is removed, with a review notice (that removal used to be silent). `removeClassLevel` keeps its prune of class entries not yet moved, including the `class__…` shape.
- **Review fix (028ac12):** the code-built grant ids named the record's source, so a Fighter made on the SRD Baseline lost its skills after a sync (probe: SRD `[Athletics, Perception]`, integrated `[]`). The multiclass skill grant had the same flaw since its move. Both now name `PHB` for an SRD or PHB class, with the SRD-named id as an alias that moves saved picks. Two tests were red without the fix; two book-admission allow-list entries were added.
- **Deviations accepted:**
  - A third pick replaces the oldest, the shared Proficiency Choice behaviour.
  - The Fighter has no multiclass skill.
  - The creation-flow signature reads class proficiency picks.
- **Found:** the Bard's `{ any: 3 }` is scraped as `choose: 2`; filed as quick fix 08.
- check:all, check:live, and `ONLY` Class Choices, Builder, Review and Level-Up at 393 passed, SRD and integrated.

- [x] Tests, `checks/classSkillChoice.test.ts`:
  - A Fighter 1 (SRD) is offered one skill Proficiency Choice of 2 from the Fighter's 8 skills, with the grant id above. A Bard's pool is any skill, with id `…:any` and count 3.
  - Picking two through `pickRuleChoice` puts them on the sheet; a third is refused; the Class Choices step is complete with two and incomplete with one.
  - A Rogue 1 / Fighter 1: only the Rogue's starting choice, plus the Fighter's multiclass choice as today.
  - A saved Fighter with the legacy entry `{ id: "Class: Fighter", origin: "class", picked: ["Athletics", "Perception"] }` and `chosenSkills` holding them:
    - The sheet shows both before and after `reconcile`.
    - After, they are the grant's pick, the entry is gone, and `chosenSkills` no longer holds them.
    - A legacy name outside the pool stays.
  - A migrateCharacter-shaped entry (`class__Fighter__PHB__skills`) moves the same way.
  - Removing the only Fighter level releases the pick.
- [x] Every existing test that reads `startingSkills`, `skillChoiceOffers` or class `skillChoices` is updated to the new path; list them and say what each now asserts.
- [x] `npm run check:all` and `npm run check:live` pass.
- [x] Scoped layout, `WIDTHS=393`, SRD and `-- --integrated`: `ONLY="Class Choices"`, `ONLY=Builder`, `ONLY=Review`, `ONLY="Level-Up"`. Scenarios that picked class skills through the old card must pick them through the new one. Open a Class Choices screenshot showing a Fighter's skill pick and describe it.
