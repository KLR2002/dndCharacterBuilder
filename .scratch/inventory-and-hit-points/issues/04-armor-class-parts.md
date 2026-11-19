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

**Status:** done

**Landed:** merge a962ae1 (7818a28 pins, a67da08).
- **Parts:** `armorClass` returns `parts: { kind, label, value }[]`, with kinds base, ability, shield, fightingStyle, infusion and magic. `breakdown` is rendered from them and `ac` is their sum.
- **Text unchanged:** five breakdown pins in the new `checks/ac.test.ts` were written against the old code and still pass.
- **Stats tab:** the Defense and Infused badges read `parts`, with no regex left.
- **Gap:** no layout scenario asserts the badge text, so the unit tests on `parts` cover it.
- check:all passed; `ONLY=Stats` at 393 passed, SRD and integrated.

- [x] Tests in `checks/ac*.test.ts` (extend the existing file):
  - `parts` sum to `ac` in each branch: armor, unarmored Barbarian, unarmored Monk, plain.
  - Defense gives a `fightingStyle` part.
  - Enhanced Defense gives an `infusion` part.
  - `breakdown` text is unchanged for those cases (pin it before the change).
- [x] `grep -n "acBreakdown\.\(includes\|match\)" src/components/tabs/StatsTab.tsx` finds nothing.
- [x] `npm run check:all` passes.
- [x] Scoped layout: `ONLY=Stats WIDTHS=393`, SRD and `-- --integrated`, green.
