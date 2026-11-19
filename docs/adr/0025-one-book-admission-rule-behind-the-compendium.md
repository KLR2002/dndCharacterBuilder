# 0025 One Book-Admission Rule, Behind the Compendium

## Context
The Compendium scopes its listings to the active books, but only top-level records and their subclasses and subraces. Folded options, subclass spell lists, saved picks, rule-choice ids and "is TCE on" checks were each scoped by hand, in about 30 places across `src/rules` and a few components. They disagreed:
- **Case:** most upper-cased both sides, while the Compendium matched exactly. Book codes are mixed-case (`SatO`, `WBtW`, `IDRotF`), and six rules handed the Compendium upper-cased books, which matched no mixed-case record.
- **SRD records:** some always admitted them; others admitted only the active books.
- **Empty book list:** most treated it as every book, and the Compendium as none.

## Decision
- **One rule:** whether a source is admitted is answered by the Compendium's listings, `admits(source)`, and nowhere else.
  - A record with no source is admitted.
  - An `"SRD"` record is always admitted: the SRD Baseline is not a book a player turns off.
  - Book codes compare without regard to case.
  - `ALL_BOOKS` (no list) admits every book, and an empty list admits no book.
  - The SRD Baseline's listings are unscoped and admit every source: book controls are hidden until an Integrated Catalog exists (Sourcebook Gating).
- **Scoping uses the same predicate:** the listings `for(activeBooks)` returns are filtered by it.
- **Rules ask `admits` instead of comparing book codes:** that covers a folded option, a subclass spell, a saved pick and "is TCE active". A guard test forbids comparing book codes by hand in `src/rules` and `src/components`.
- **Rule signatures are not unified by this decision.** Rules keep taking `activeBooks` and a Compendium, or `CharacterCatalogs`. The read facades `src/services/dataService.ts` and `src/services/dndRules.ts` are removed; their callers read the Compendium or the rules modules directly.

## Considered Options
Moving every rule to one `CharacterCatalogs` parameter and removing `currentCompendium()` from `src/rules` was deferred. It touches about 170 signatures and changes nothing a player sees, while admission was where readers disagreed. Treating an empty list as every book was rejected: a player who turns every book off expects only the SRD.
