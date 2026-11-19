# 04: The AC result carries its parts

**What to build:**

- **Parts.** `armorClass` (`src/rules/ac.ts` ~62) returns `parts` beside `ac` and `breakdown`: one entry per term, `{ kind, label, value }`. At least these kinds:
  - `"base"` (armor or 10)
  - `"ability"`
  - `"shield"`
  - `"fightingStyle"` (Defense)
  - `"infusion"` (Enhanced Defense, Repulsion Shield)
  - `"magic"`

  `breakdown` is built from `parts`, so the text is unchanged.
- **The Stats tab.** `src/components/tabs/StatsTab.tsx` (~165-171, ~447-450) reads the "Defense +1" and "Infused +N" badges from `parts`, with no regex over `breakdown`.
- **Other readers.** Check other readers of `breakdown`: `grep -rn "breakdown" src --include=*.tsx`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tests in `checks/ac*.test.ts` (extend the existing file):
  - `parts` sum to `ac` in each branch: armor, unarmored Barbarian, unarmored Monk, plain.
  - Defense gives a `fightingStyle` part.
  - Enhanced Defense gives an `infusion` part.
  - `breakdown` text is unchanged for those cases (pin it before the change).
- [ ] `grep -n "acBreakdown\.\(includes\|match\)" src/components/tabs/StatsTab.tsx` finds nothing.
- [ ] `npm run check:all` passes.
- [ ] Scoped layout: `ONLY=Stats WIDTHS=393`, SRD and `-- --integrated`, green.
