# 01: One point-buy owner

**What to build:**

- **The module.** `src/rules/pointBuy.ts` owns point buy:
  - `POINT_BUY_BUDGET` (27), with the cost table from `POINT_BUY_COST` in `src/constants/rules.ts`. Move the table into the module if nothing else needs it in constants.
  - `pointBuySpent(scores)`.
  - `canSetPointBuyScore(scores, ability, next)`: within 8-15 and within budget.
  - Use it for the Abilities step's validity in `src/rules/creationFlow.ts` (~138-157).
- **The Builder.** `src/components/tabs/BuilderTab.tsx` (~120-140) reads the remaining points and the allowed change from the module; the literal `27` goes.
- No behaviour change.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tests in `checks/pointBuy.test.ts`:
  - All 8s spend 0.
  - 15/15/15/8/8/8 spends 27, and raising an 8 to 9 is refused.
  - 16 is refused.
  - Lowering is always allowed down to 8.
- [ ] `grep -rn "27" src/components/tabs/BuilderTab.tsx src/rules/creationFlow.ts`: no point-buy literal left.
- [ ] `npm run check:all` passes.
- [ ] Scoped layout: `ONLY=Abilities WIDTHS=393 npm run layout:check` green, SRD.
