# 01: Feat Prerequisite & Origin Feats Engine

**What to build:** Build the core feat validation and origin feats rules engine. Implement `validateFeatPrerequisites(character, feat, effectiveScores, proficiencies)` supporting ability score minimums (STR/DEX/INT/WIS/CHA >= 13), armor/weapon proficiencies, spellcaster prerequisites, level thresholds, and race/subrace requirements. Implement origin feat application (`applyOriginFeat`, `removeOriginFeat`), support half-feat ability choices, and integrate them into `effectiveScores` and builder state.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Implement `src/rules/feats.ts` with prerequisite evaluation logic and origin feat helpers.
- [x] Support half-feat +1 ability bonus resolution in `src/rules/abilities.ts` (`effectiveScores`).
- [x] Add unit tests in `checks/feats.test.ts` covering prerequisites (abilities, armor, spells, level, race) and half-feat stat calculations.
- [x] Verify zero TypeScript errors and all tests pass with `npm test`.
