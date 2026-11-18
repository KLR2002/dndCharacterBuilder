# 0023 Feat Increase Choices Live in the Catalog, and Every Feat Slot Reads One Module

## Context
A feat record states its ability increase as fixed scores or as a choice (`choose`: the scores allowed, the amount). The scraper kept only the fixed numbers, so Resilient, Athlete, Fey Touched, Skill Expert and every other feat with a choice reached the app with no increase, and a hand-written table of 52 feat names (`HALF_FEATS`) filled the gap. That table is non-SRD content in `src/` (ADR 0014) and the same name-based fix ADR 0019 removed for races. The race and background origin-feat cards looked the increase up by name alone, so they depended on the table entirely.

The four places that offer a feat (the builder's ASI section, the Level-Up Flow's ASI/Feat step, and the race and background origin-feat cards) each assembled the offer, the prerequisite check, the increase and the feat's sub-choices themselves. The builder also knew Fighting Initiate, Martial Adept and Eldritch Adept by name to show their sub-choices, although the Level-Up Flow already read them from the Rule Choice pointer table, and every place assumed `PHB` for a feat saved without a source.

## Decision
- The Catalog states a feat's Increase Choice as data, in the shape races use (`abilityScoreChoices`: the scores allowed, how many, the amount). The Catalog Format is raised. No feat is known by name for its increase, and `HALF_FEATS` is deleted.
- With a stale catalog a feat is still offered without its Increase Choice, and a saved increase is kept and still counts. A saved increase that leaves its feat's pool is released with a review notice; a character whose scores change only because the data was corrected gets no notice (as in ADR 0019).
- One rules module answers for every Feat Slot from a pending pick (the slot, the feat, its increase, its sub-choice picks): the feats offered with their prerequisite results, the increase options, the Rule Choices the feat opens, whether the pick is complete, and applying it. The feat's sub-choices come from the pointer table only; the UI names no feat. Rule Choices gate confirming the pick; the feat's spell picks stay on the taken feat. A taken feat is found by name and source, or by its name alone when that is unique among the active feats, never by assuming a book.
- One feat picker component shows that module's answer in all four places; each place keeps its own frame.

## Considered Options
Keeping `HALF_FEATS` as a fallback for stale catalogs was rejected for ADR 0014's reason, and because a stale catalog already hides what it cannot state. Deepening only the builder's ASI section was rejected: the origin-feat cards were where the name-only lookup did the most harm. Asking for a feat's spell picks before it could be confirmed was rejected for now, because the spell lists already have their own picker and pending notice.
