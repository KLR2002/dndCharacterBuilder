# 01: Hit Dice Lifecycle Engine & Rest Operations

**What to build:** Consolidate the entire hit dice lifecycle into a deep module (`src/rules/hitDice.ts`). Encapsulate pooling by die type (`d12`, `d10`, `d8`, `d6`), spending with Constitution modifier healing rolls and maximum HP bounds clamping, manual recovery, and automated long-rest recovery (largest dice first). Wire `StatsTab` and `RestModal` to call `spendHitDie(character, die, options?)` and `recoverHitDie(character, die?)`, eliminating direct UI mutations to `character.usedHitDice`.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Create `src/rules/hitDice.ts` with `getHitDicePools`, `spendHitDie`, and `recoverHitDie`.
- [x] Connect `applyShortRest` and `applyLongRest` in `src/rules/rest.ts` to use `hitDice.ts`.
- [x] Refactor `StatsTab.tsx` and `RestModal.tsx` to dispatch hit dice actions through `hitDice.ts` instead of directly manipulating `character.usedHitDice`.
- [x] Write unit tests in `checks/hitDice.test.ts` verifying multiclass pooling (e.g. Barbarian 1 / Bard 1), spending with CON scaling and HP bounds, and long-rest recovery.
- [x] Verify zero TypeScript errors and all tests pass with `npm test`.
