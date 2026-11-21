# Spec: The class skill pick is a Proficiency Choice

**Status:** ready-for-agent

Architecture review candidate #7 (2026-11-18). Decided with the user on 2026-11-19. Amends ADR 0015; ADR 0026.

## Problem

- **The first class's skill pick still uses the old fields.**
  - It is saved in `skillChoices` (an entry with origin `"class"` and id `"Class: <name>"`) and `chosenSkills`.
  - Race, background, class tool and multiclass skill picks are already Proficiency Choices, saved in `proficiencyPicks` under a grant id.
  - Its transition is an 80-line `toggleSkill` in `src/components/tabs/BuilderTab.tsx` (~260-343), untested.
  - It is offered through `skillChoiceOffers` (`src/rules/proficiencySheet.ts` ~510). `classChoicesAtLevel` (`src/rules/classChoices.ts` ~69, ~86) and `classChoicesStepView` (~242, ~260) carry it as `startingSkills`, with its own completeness check. `ClassChoiceCards` renders it through `onToggleStartingSkill`.
  - `removeClassLevel` prunes it by an id prefix (`src/rules/builderTransitions.ts` ~633-645).
  - The creation Review step shows `chosenSkills` (`src/components/creationFlow/ReviewStep.tsx` ~31).
- **Nine "move legacy picks" passes run on every edit.** `reconcile` (`src/rules/characterReconciler.ts` ~82-103) runs them on every transition:
  - `moveLegacyFightingStyleIds`
  - `moveAliasedProficiencyPicks`
  - `moveLegacyClassToolPicks`
  - `moveLegacySourcePicks`
  - `moveLegacySkillPicks`
  - `moveExpertisePicksToGrants`
  - `dropLegacyMulticlassSkillEntries`
  - `dropLegacyBackgroundSkills`
  - `moveLegacyInnateCounters`

  Each moves a saved shape that current code no longer writes, or that only a catalog change creates.
- **Two point-buy budgets.**
  - `BuilderTab` hard-codes `27` (~126, ~134).
  - `creationFlow.ts` has its own `POINT_BUY_BUDGET` (~138) and spend loop (~150-156).

## Decisions

1. **The grant is built from the class record**, like the multiclass skill choice (ADR 0015 amendment).
   - `startingSkillGrantOf(cls)` reads `startingProficiencies.skills`. Its id is `<source>/<class>/Starting Proficiencies@1#skills:choice:from`, or `…:any` for a pool of any skill.
   - It goes on the first class's Starting Proficiencies feature.
   - No Catalog Format bump.
2. **The pick goes through the Proficiency Choice path:**
   - Offers come from `proficiencyChoiceOffers` / `skillPickOffers`.
   - Picks use `pickRuleChoice` and `clearProficiencyPick`.
   - Completeness is the proficiency check.
   - `toggleSkill`, `skillChoiceOffers`, `startingSkills` and `onToggleStartingSkill` go.
3. **Saved class skill picks move once:** a legacy class entry's names go to the grant's pick, up to its count. A name it cannot take stays where the sheet already reads it.
4. **Legacy moves run on load and on catalog change, not on every edit (ADR 0026).**
   - One step, `migrateSavedPicks(character, compendium, activeBooks)`, runs each pass whose input no current transition writes. It also takes over `renameSrdNames`.
   - It runs when characters load, and in `reconcileForActiveBooks`, which runs when the books or the catalog change and when a character is opened.
   - A pass whose input a current transition still writes stays in `reconcile`.
   - A guard test lists which files may write the legacy fields.
5. **One point-buy owner:** `src/rules/pointBuy.ts`.

## Tickets

1. `issues/01-one-point-buy-owner.md`
2. `issues/02-class-skill-pick-is-a-proficiency-choice.md`
3. `issues/03-legacy-moves-on-load.md`
