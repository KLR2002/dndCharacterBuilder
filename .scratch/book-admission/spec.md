# Spec: One book-admission rule

**Status:** ready-for-agent

Architecture review candidate #6, "pass one book-scoped Compendium" (2026-11-18). Decided with the user on 2026-11-19. ADR 0025. Builds on `.scratch/srd-baseline-stays-srd/`, after which SRD folded options carry source `"SRD"`.

## Problem

`Compendium.for(activeBooks)` (`src/services/compendium.ts`) scopes top-level records, subclasses and subraces. Everything else is scoped by hand, in about 30 places, and they disagree:

- **Case.**
  - Most hand filters upper-case both sides; `for()` matches exactly.
  - Book codes are mixed-case (`SatO`, `WBtW`, `IDRotF`, `AitFR-AVT`).
  - These rules pass upper-cased books to `for()`, so a mixed-case record never matches:
    - `choices/maneuvers.ts` ~65
    - `choices/fightingStyles.ts` ~137
    - `choices/warlockChoices.ts` (several)
    - `spellPage.ts` ~356

    With today's data that hides nothing a player picks: the mixed-case option records are Character Secrets and Regional Features.
- **SRD records.** Some filters always admit `"SRD"`, others only the active books, and `for()` admits it only for records from the baseline fallback. An integrated catalog has its SRD records stripped, so `for()`'s rule and "always" give the same listings.
- **Empty list.** Most hand filters treat `[]` as every book; `for([])` admits none.
- **Pass-through modules.**
  - `src/services/dataService.ts`: a read facade with 11 importers, all components plus `CharacterContext`.
  - `src/services/dndRules.ts`: 8 lines of re-exports, 7 importers.

## Decisions

1. **One rule, in the Compendium (ADR 0025).** `CompendiumListings.admits(source?: string): boolean`:
   - no source → admitted
   - `"SRD"` → always admitted
   - book codes compare case-insensitively
   - `ALL_BOOKS` admits every book, and `[]` admits none
   - the SRD Baseline's listings admit every source

   `for(activeBooks)` filters with the same predicate.
2. **Every hand filter asks `admits`**, one rule family per ticket. Rules keep their signatures; where a rule has `activeBooks` and a Compendium, it asks `compendium.for(activeBooks).admits(source)` (or `catalogListings(...)`).
3. **Delete `dataService.ts` and `dndRules.ts`.** Callers import the rules modules directly, and read the Compendium through `currentCompendium()` / `catalogListings`.
4. **A guard test** forbids hand book comparisons in `src/rules` and `src/components`.
5. **Not in scope:** unifying rule signatures on `CharacterCatalogs`, and removing `currentCompendium()` calls from `src/rules`.

## Known behaviour changes

All intended:

- An empty book list now admits no book, in every reader.
- With the SRD Baseline, a saved pick from a book that is not active raises no "disabled sourcebook" warning (`builderTransitions.ts` ~1074), since book controls are hidden there.
- A mixed-case book's records are admitted when the book is on.

## Tickets

1. `issues/01-admits-in-the-compendium.md`
2. `issues/02-class-option-families.md`
3. `issues/03-spell-admission.md`
4. `issues/04-rule-choices-and-flows.md`
5. `issues/05-delete-the-read-facades.md`
