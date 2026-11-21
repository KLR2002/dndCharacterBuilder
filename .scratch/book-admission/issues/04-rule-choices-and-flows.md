# 04: Rule Choices, features and flows ask `admits`

**What to build:** Every book comparison in these rules goes through the listings' `admits`:

- **`src/rules/ruleChoices.ts`:**
  - ~70: ancestry choices.
  - ~194: subclass choices. Keep the local guard that lets through an id prefix which is not a known book (`ALL_RESOURCE_BOOKS`); it handles ids, not admission.
- **`src/rules/subclassChoiceTable.ts`** ~440, including `readPointerRow`'s option filter (~499), which admits `SRD` options by hand since SRD-baseline ticket 01.
- **`src/rules/featureOptions.ts`** ~21 (`describeClassFeature`): the owner's book stays listed; other options are listed when admitted.
- **`src/rules/proficiencyChoiceOffers.ts`** ~120
- **`src/rules/levelUpFlow.ts`** ~943: subclass offers. Drop the "SRD counts as active" comment once the rule says so.
- **`src/rules/builderTransitions.ts`** ~1074: the "disabled sourcebook" warnings.
  - With the SRD Baseline, no warning: its listings admit every source.
  - An `"SRD"` saved pick never warns.
- **`src/rules/raceLookup.ts`** ~80, `src/rules/originCustomization.ts` ~59 (`ALL_BOOKS` still means TCE is active).

Where a function has no Compendium, add a parameter defaulting to `currentCompendium()`.

**Blocked by:** 01

**Status:** done

**Landed:** merge 3ac40ff (f74ebba); review fix 1d7d688.
- **Converted to `admits`:** `availableRuleChoices`, `availableSubclassRuleChoices` (id-prefix guard kept), `readPointerRow`, `describeClassFeature`, `subclassOptions`, `proficiencyChoiceOffers`, `checkActiveBooksIntegrity` and Origin Customization availability. Each takes an optional Compendium; `FeaturesTab` and `CharacterContext` pass `currentCompendium()`.
- **Fixed:** with the SRD Baseline and books `["SRD"]`, the Hunter's Prey and Land Biome picks are now offered (red before), and the SRD Baseline raises no book warnings.
- **Fixtures:** two pre-existing fixtures flagged integrated (`levelUpFlow`, `proficiencyChoices`). The `proficiencyChoices` case is now absent because its class is scoped out.
- **Baseline re-record:** `books=none` rows went empty (the agreed rule), plus SRD-fixture rows whose non-SRD records are now unscoped. On the real SRD Baseline, 20 of 525 rows differ, all with books `["SRD"]` (Land, Hunter, Fiend), as intended.
- **Review fix:** a custom background's feature has source `Custom`, which no book admits, so with an Integrated Catalog its skill and language picks vanished (probe: before `[skills, languages]`, after `[]`). It is now exempt by identity; the test was red without the fix.
- **Not done:** `raceLookup.ts` ~80 would cycle through `compendium.ts`; moved to ticket 05.
- **Tests:** 10 in `checks/ruleChoiceBookAdmission.test.ts`.
- check:all, check:live, and `ONLY="Level-Up"`/`ONLY=Builder` at 393 passed, SRD and integrated.

- [x] Before changing the code, run the tests that cover these files and record the count. They must pass after, unchanged, except tests that pin an empty book list as "every book" or an SRD-mode book warning; say which, and why each changed.
- [x] New tests:
  - Mixed-case books give the same ancestry and subclass Rule Choices and subclass offers as upper-case.
  - A Hunter's Prey option sourced `SRD` is listed by `describeClassFeature` with books `["XGE"]`.
  - With the SRD Baseline and books `["SRD"]` (what "Revert to SRD" saves), an SRD Ranger 3 Hunter is offered Hunter's Prey and an SRD Druid 2 Land is offered its Biome pick. Today the `PHB`-sourced rows are dropped at `ruleChoices.ts` ~194; see `checks/srdBaseline.test.ts`.
  - The book warnings: an integrated character with an XGE feat and books `["PHB"]` warns; the same character with the SRD Baseline does not; an SRD race never warns.
- [x] Paste `grep -nE "toUpperCase|SRD_SOURCE|activeBooks\??\.(includes|some)"` over the eight files. What remains must not be admission.
- [x] `npm run check:all` and `npm run check:live` pass.
- [x] Scoped layout: `ONLY="Level-Up" WIDTHS=393` and `ONLY=Builder WIDTHS=393`, green, SRD and `-- --integrated`.
