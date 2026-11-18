# Spec: One module for every Feat Slot

**Status:** ready-for-agent

Decided with the user on 2026-11-18 (architecture review candidate 4). Terms: **Feat Slot** and **Increase Choice** in `GLOSSARY.md`. Decision: `docs/adr/0023-feat-increases-live-in-the-catalog-and-every-feat-slot-reads-one-module.md`.

## Problem

- The scraper (`dnd5eToolsScrap/src/scrapers/feats.ts`, `parseAbilityScores`) keeps only a feat's fixed increases and drops `choose`. Resilient, Athlete, Fey Touched, Skill Expert and others reach the app with `abilityScoreIncrease: null`, and `HALF_FEATS` (52 non-SRD names, `src/rules/leveling.ts:16`) fills the gap. `AncestrySection` and `BackgroundSection` call `getFeatAbilityBonusOptions(name)` without the record, so origin feats rely on that table alone.
- Four places offer a feat and each assembles offer, prerequisite, increase and sub-choices itself: `src/components/builder/AsiFeatSection.tsx` (984 lines, 10 `useState`, 12 checks of `"fighting initiate"`, `"martial adept"`, `"eldritch adept"`), `src/components/levelUpFlow/AsiFeatStep.tsx` with `src/rules/levelUpFlow.ts` (`featSubChoicesForSelection`, `asiFeatAbilityPending`, `asiFeatStepView`, already generic), and the origin-feat cards in `AncestrySection.tsx` and `BackgroundSection.tsx`.
- Every place guesses a missing source as `featSource || "PHB"`.

## Decisions

1. The Catalog carries a feat's Increase Choice as `abilityScoreChoices`, in the race shape (`AbilityScoreChoice`: `from`, `count`, `amount`), parsed by the same code as races. `REQUIRED_CATALOG_FORMAT` goes from 15 to 16. `HALF_FEATS` and the name fallback are deleted.
2. Stale catalog: the feat is still offered without its Increase Choice; a saved `featAbility` is kept and still counts.
3. A saved `featAbility` outside its feat's pool is released with a review notice; a change caused only by corrected data gives no notice (ADR 0019's rule).
4. One rules module, `src/rules/featSlot.ts`, takes a pending pick (`FeatSlotPick`: slot, feat name and source, increase, sub-choice picks) and returns the feats offered with their prerequisite results, the increase options, the Rule Choices the feat opens (from `featGrantedRuleChoices`, the pointer table), the feat spell picks it opens, whether the pick is complete, and applies it. Rule Choices gate completeness; spell picks do not and stay on the taken feat's card.
5. A taken feat is found by name and source, or by name alone when unique among the active feats; never by assuming `PHB`.
6. One `FeatPicker` component (`src/components/feats/FeatPicker.tsx`) shows the module's answer in all four places; each place keeps its frame.

## Tickets

1. `01-catalog-feat-increase-choices.md`: the scraper keeps feat Increase Choices; Catalog Format 16.
2. `02-feat-slot-module.md`: `featSlot.ts`; increase from the Catalog only, `HALF_FEATS` deleted; source lookup; Level-Up Flow reads it.
3. `03-release-feat-increase-outside-pool.md`: saved increase outside its pool is released with a notice.
4. `04-feat-picker-in-level-up.md`: `FeatPicker`, used by `AsiFeatStep`.
5. `05-builder-asi-section-on-feat-slot.md`: `AsiFeatSection` on the module and `FeatPicker`; no feat names in UI.
6. `06-origin-feat-cards-on-feat-picker.md`: race and background origin-feat cards on `FeatPicker`.
