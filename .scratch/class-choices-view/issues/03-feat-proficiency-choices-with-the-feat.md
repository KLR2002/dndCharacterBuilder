# 03: A feat's proficiency choices show with the feat

**What to build:** Proficiency Choices with origin `"feat"` (Skilled, Skill Expert and the like; `proficiencyChoiceOffers` in `src/rules/proficiencyChoiceOffers.ts`) are picked today in the Class Choices step, which comes before the ASI/Feats step and whose gate does not count them. Move them to the feat:
- `src/rules/featSlot.ts`: `featPickView` reports the picked feat's Proficiency Choices (`proficiencyChoices`), and a function for a taken feat (beside `takenFeatRuleChoices`) returns the taken feat's. They never make a pick incomplete (like spell picks).
- `src/components/feats/FeatPicker.tsx` (`FeatPickDetails`) renders them with `ProficiencyChoicePicker` (`src/components/builder/ProficiencyChoicePicker.tsx`, see `BackgroundSection.tsx` for its use) on the taken feat: the builder ASI saved cards, the race and background origin-feat cards. In the Level-Up feat step, where the feat is not applied before Review, show them on the pick only if the plan can hold proficiency picks today; otherwise leave them to the saved card after Review and say so in the report.
- The class view (ticket 02) and `ClassProgressionSection` drop origin `"feat"`.

**Blocked by:** 02

**Status:** done

**Landed:** merge of 17ab07c, ece71b7. `featProficiencyChoiceOffers` (`proficiencyChoiceOffers.ts`) matches a feat's offers by the feature's origin, name and source; `featPickView(...).proficiencyChoices` and `takenFeatProficiencyChoices` in `featSlot.ts`. `skillPickOffers` no longer includes origin `"feat"`, and the class view's other card drops feat offers. `FeatPickDetails` renders them (`FeatProficiencyPickers`) on the saved ASI card and the race and background origin cards; the Level-Up feat step does not (the plan holds no proficiency picks), so they appear on the saved card after Review. New integrated scenarios `Builder origin feat Skilled` and `Builder ASI feat Skilled` passed at 393 with the class-choice scenarios; check:all passed.

- [x] Tests (red first): a character holding Skilled (ASI) or Skilled as a Variant Human origin feat gets its Proficiency Choice from the Feat Slot module and not from `classChoicesStepView`.
- [x] Layout: `Builder ASI feat Fighting Initiate`, `Builder origin feat` and the class-choice scenarios at 393 (`-- --integrated`); add a Skilled pick to one of the feat scenarios, assert its picker shows on the feat card, and check its screenshot. `npm run check:all` passes.
