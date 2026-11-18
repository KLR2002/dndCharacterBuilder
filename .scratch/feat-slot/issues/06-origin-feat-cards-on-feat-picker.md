# 06: Race and background origin-feat cards use FeatPicker

**What to build:** `src/components/builder/AncestrySection.tsx` (origin feat list ~line 740-800, current feat card ~500-570) and `src/components/builder/BackgroundSection.tsx` (~300-400) each render their own feat list, prerequisite check and Increase Choice. Move both to `featSlotView` with an origin `FeatSlot` and `FeatPicker` (tickets 02, 04), applying through `applyFeatSlotPick`. Each card keeps its frame, its existing spell picks (`GrantedSpellPicks`) and its replace/remove behaviour (`applyOriginFeat`, `removeOriginFeat`, `grantBackgroundFeat`: a feat the race already holds stays the race's entry). Keep every `testID`, label and copy; add no new copy.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Neither section imports `validateFeatPrerequisites` or renders its own feat list (paste the grep); a Variant Human taking Resilient sees the six-score Increase Choice from the Catalog (test against `featSlotView` with an origin slot).
- [ ] Scoped layout runs for the race and background scenarios (`ONLY="Builder Race"`, `ONLY="Builder Background"`, use the real scenario names) at 320, 393 and 1280 pass. `npm run check:all` passes.
- [ ] Gate (this is the last ticket): `npm run check:live` and the full `npm run layout:check` pass.
