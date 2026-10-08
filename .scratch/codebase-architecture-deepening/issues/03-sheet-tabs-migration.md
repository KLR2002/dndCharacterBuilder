# 03: Character Sheet Tabs Migration to Evaluated Model

**What to build:** Migrate the character sheet presentation tabs (`StatsTab.tsx`, `ActionsTab.tsx`, `FeaturesTab.tsx`, `InventoryTab.tsx`, `character/[id].tsx` header) to consume `evaluateCharacter(currentCharacter)`. Replace the ten individual derived stat calculation calls with a single evaluated character model. Delete the shallow adapter `src/services/dndRules.ts` or reduce it to backward-compatible re-exports, eliminating repeated catalog queries.

**Blocked by:** 02: Deep Character Evaluator Engine.

**Status:** done

- [x] Update `character/[id].tsx` shell header to read level, max HP, and AC from `evaluateCharacter`.
- [x] Refactor `StatsTab.tsx` to read ability scores, modifiers, AC, speeds, saves, skills, and proficiencies directly from the evaluated model.
- [x] Refactor `ActionsTab.tsx` to use weapon attacks and saving throws from the evaluated model.
- [x] Remove obsolete individual calculation calls from `dndRules.ts`, deprecating or deleting the shallow adapter.
- [x] Run `EXPO_NO_TELEMETRY=1 npm run lint`, `npx tsc --noEmit`, and `npm test` to verify complete green pass.

