# 04: Attack rows keep their name readable at phone width

**What to build:** On the Actions tab at phone width (about 410 dp, not compact) the to-hit and damage Roll Badges of an attack sit side by side and never shrink, so the name column is squeezed to a few letters and words break mid-word ("Shortswo / rd", "Unar / med / Strike", "bludgeo / ning"). The same row markup is copied four times in `src/components/tabs/ActionsTab.tsx`: the default Unarmed Strike (~111), the equipped weapon attacks (~173), the off-hand attack (~281) and the spell attacks (~396).

Extract one `AttackRow` (`src/components/tabs/actions/AttackRow.tsx`) and use it in all four places. Its props are the info column (children: name, subtitle lines, badges), the to-hit badge (optional, spells may have none), the damage badge, `onPress` (optional) and the bottom border. It owns the layout:

- Info column: `flex: 1`, `minWidth: 0`, so it takes the space and its text wraps at word boundaries.
- Width < `BREAKPOINTS.phone` (600) and not compact: info column left, to-hit above damage in one column on the right (`flexDirection: "column"`, `alignItems: "stretch"`, `flexShrink: 1`, `maxWidth: "50%"`).
- Compact (< 380): info column on top, the badges below in a row with `flexWrap: "wrap"` (the current compact behaviour).
- ≥ 600: badges side by side on the right, as today.

The badge column must be able to shrink and its labels wrap (`CODING_STANDARDS.md` section 7), so the layout does not rely on the breakpoint alone. Keep every existing `testID`, label, roll source and press behaviour unchanged. No new copy.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The "Actions rolls" layout scenario (`scripts/layout-check.mjs`, `checkActionRolls`) asserts, at each width, that every attack name renders without a mid-word break (each word of the title lies on one line: compare a `Range` over each word against its line boxes) and, below 600 px and at 380 px or wider, that the damage badge's top is below the to-hit badge's bottom. It fails on the current code at 393 (paste the failing output in the report), and passes after the change.
- [ ] All four rows use `AttackRow`; `ActionsTab.tsx` has no other `attackRow` style use.
- [ ] `ONLY="Actions rolls" WIDTHS=320 npm run layout:check`, then `WIDTHS=393` and `WIDTHS=1280` pass.
- [ ] `npm run check:all` passes.
