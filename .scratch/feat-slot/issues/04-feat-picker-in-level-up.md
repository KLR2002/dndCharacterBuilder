# 04: One FeatPicker component, used by the Level-Up Flow

**What to build:** Extract the feat-picking body of `src/components/levelUpFlow/AsiFeatStep.tsx` into `src/components/feats/FeatPicker.tsx`. Props: the `featSlotView` result (ticket 02), the current `FeatSlotPick`, and `onChange(pick)`. It renders: the search box, the feat list with prerequisite notes (unmet feats disabled, as today), the selected feat's description, the Increase Choice buttons when the increase is a choice (fixed shows as text), and each opened Rule Choice through `RuleChoicePicker` (from `src/components/builder/builderStyles`). It holds no rule state of its own; search text may stay local. It does not render confirm or its frame. `AsiFeatStep` keeps its step frame and the ASI tab and uses `FeatPicker` for the feat tab. Keep every existing `testID`, label and copy; add no new copy (`ui-discipline`). Layout rules: `CODING_STANDARDS.md` section 7.

**Blocked by:** 02

**Status:** done

**Landed:** 6b194a6 (with af2eb78 dropping a source-text guard test). `FeatPicker` takes granular callbacks (`onSelectFeat`, `onSelectAbility`, `onToggleSubChoice`) because the Level-Up Flow keeps sub-choice picks in its plan; its sub-choices keep the step's existing chip groups, not `RuleChoicePicker`. `AsiFeatStep.tsx` 324 → 216 lines, `FeatPicker.tsx` 166. `allFeats` and `featSlotView(...).offered` are the same list. `ONLY="Level-Up"` passed at 320, 393 and 1280; check:all passed.

- [x] The Level-Up Flow behaves as before: existing `checks/levelUpFlow*.test.ts` and level-up layout scenarios pass unchanged (`ONLY="Level-Up" WIDTHS=320`, then `393`, then `1280 npm run layout:check`).
- [x] `AsiFeatStep.tsx` has no feat list, feat search or Increase Choice markup of its own (paste its line count before and after).
- [x] `npm run check:all` passes.
