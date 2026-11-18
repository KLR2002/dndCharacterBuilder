# 06: Race and background origin-feat cards use FeatPicker

**What to build:** `src/components/builder/AncestrySection.tsx` (origin feat list ~line 740-800, current feat card ~500-570) and `src/components/builder/BackgroundSection.tsx` (~300-400) each render their own feat list, prerequisite check and Increase Choice. Move both to `featSlotView` with an origin `FeatSlot` and `FeatPicker` (tickets 02, 04), applying through `applyFeatSlotPick`. Each card keeps its frame, its existing spell picks (`GrantedSpellPicks`) and its replace/remove behaviour (`applyOriginFeat`, `removeOriginFeat`, `grantBackgroundFeat`: a feat the race already holds stays the race's entry). Keep every `testID`, label and copy; add no new copy.

**Blocked by:** 05

**Status:** done

**Landed:** merge of c8c82f5, with 94eaab0 (the modal list keeps its 450 height). Design revised by the main session after reading the cards: `FeatPicker` splits into `FeatList` and `FeatPickDetails`; the race modal renders `FeatList`; both origin cards render `FeatPickDetails` for the taken feat, so an origin feat's Rule Choices (a Variant Human's Fighting Initiate style) now show on the race card, where before the rules opened them but no screen did. The background keeps its "Claim Feat" buttons as its frame. The old modal row's description excerpt and "Half-Feat" line went with the old markup (Info opens the description). New scenario `Builder origin feat` (integrated) passed at 320, 393 and 1280; `Builder Race`, `Builder Background`, `Level-Up Flow feat`, `Builder Class feats` passed at 393. check:all and check:live passed.

- [x] Neither section imports `validateFeatPrerequisites` or renders its own feat list (paste the grep); a Variant Human taking Resilient sees the six-score Increase Choice from the Catalog (test against `featSlotView` with an origin slot).
- [x] Scoped layout runs for the race and background scenarios (`ONLY="Builder Race"`, `ONLY="Builder Background"`, use the real scenario names) at 320, 393 and 1280 pass. `npm run check:all` passes.
- [x] Gate (this is the last ticket): `npm run check:live` and the full `npm run layout:check` pass.
