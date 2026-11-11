# 03: An ability score nothing has set is 8

**What to build:** A new character starts with 10 in every ability score, so under Point Buy (the default method, whose base is 8) it has already spent 12 of its 27 points. Every place that writes a score nothing has set writes 8 instead: one named constant in `src/constants/rules.ts` (beside `POINT_BUY_COST` and `STANDARD_ARRAY`) for the unset score, and one helper for the six-score record built from it, used by:

- `createCharacter` in `src/context/CharacterContext.tsx` (~216, `baseAbilityScores` of a new character);
- `src/rules/builderTransitions.ts`: `setStandardArrayPick` removing a pick (~59, `value ?? 10`), `rollRolledAbilities` (~69), `setRolledAbilityPick` removing a pick (~92, `index === null ? 10 : ...`), `clearRolledAbilityPicks` (~107);
- `resetSA` in `src/components/tabs/BuilderTab.tsx` (~161), and the two `?? (character.abilityMethod === "pointBuy" ? 8 : 10)` fallbacks (~123, ~129), which become the constant for every method;
- `src/components/builder/AbilityScoresSection.tsx` (~77-78) already builds 8s for the switch to Point Buy: use the helper there too.

Saved characters keep the scores they have; no migration. Test fixtures (`makeChar()` in `checks/testUtils.ts` and the per-test records) are not changed. `GLOSSARY.md` gets one sentence under **Ability Scores**: a base score nothing has set (a new character, an empty Standard Array or Rolled Abilities slot, a reset) is 8.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tests at `src/rules/builderTransitions.ts` (in `checks/builderTransitions.test.ts`): removing a Standard Array pick, removing a Rolled Abilities pick, a new roll and clearing the Rolled picks each leave the affected scores at 8; the expected values are written as literals
- [ ] A test through `createCharacter` (see `checks/context.test.ts`, which already drives it) shows a new character's six base scores are 8 and its Point Buy has all 27 points left
- [ ] No `10` remains as an unset-score default in `src/` (`grep -rn "dex: 10" src` lists nothing outside `src/data`)
- [ ] `npm run check:all` passes
