# 05: The builder's ASI section reads the Feat Slot module and FeatPicker

**What to build:** `src/components/builder/AsiFeatSection.tsx` (984 lines) keeps its own copy of the feat pick: 10 `useState` hooks and 12 checks of `"fighting initiate"`, `"martial adept"` and `"eldritch adept"` (both in the pick view and in the saved-pick cards around lines 800-960). Replace the feat tab with one `FeatSlotPick` state, `featSlotView` and `FeatPicker` (tickets 02, 04), confirm through `applyFeatSlotPick`, and confirm stays disabled until `view.complete`. The saved-pick cards show the taken feat's opened Rule Choices through `RuleChoicePicker` from `featSlotView` (or `featGrantedRuleChoices` filtered to that feat) and its spell picks through `GrantedSpellPicks` as today. The ASI (+2 / +1+1) tab is unchanged. Keep every `testID`, label and copy; add no new copy.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `grep -niE "fighting initiate|martial adept|eldritch adept|_CHOICE_ID" src/components/builder/AsiFeatSection.tsx` lists nothing (paste it); the file's line count before and after.
- [ ] A test or layout scenario takes Fighting Initiate at a Fighter 4 ASI in the builder: confirm is disabled until a style is picked, and the style is saved under `FIGHTING_INITIATE_CHOICE_ID`. Pick the seam (a rules test on `applyFeatSlotPick` plus `ONLY="Builder" ...` layout scenarios) and say which you used.
- [ ] Scoped layout runs for the builder ASI scenarios at 320, 393, 1280 pass. `npm run check:all` passes.
