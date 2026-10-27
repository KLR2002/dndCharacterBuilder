# Spec: Spells Wrap-up (switched-off books, lineage reconcile, "self only", unscoped reads)

**Status:** ready-for-human
**Tracker:** local markdown (`.scratch/spells-wrap-up/`).
**Related:** `.scratch/record-lookup-and-releases/spec.md`, `.scratch/granted-spells-followups/spec.md`, ADR 0017, ADR 0013, CODING_STANDARDS §7. GLOSSARY *Innate Magic*, *Expanded Spell List*, *SRD Baseline*.

## Problem

Closing the spell work. A pick whose sourcebook the player switched off must go, with a notice, whether the pick is a spell, a race, lineage or feat choice; today race, lineage and feat picks stay while their book is off, and some readers hide the choice while the pick lingers. The check must also run when the player opens a character. `changeLineage` does not reconcile and Custom Lineage is untested. Nondetection from the Gnome (Deep) grant works only on the caster, and the card does not say so. A few readers still resolve a held record without the active books.

## Decisions already made

- Boon of Magic School Mastery is a 2024 option and is ignored. Android layout is checked by the user; the design must be responsive.
- Not changed: tests that run only under `check:live` (accepted), the `removeClassLevel` concurrent-update wrapper (the app has no concurrent updates), the ancestry banner and race-picker badge showing the subrace alone, saved rule-choice trait labels.

## Acceptance Criteria

### AC-1: Switched-off book releases picks

**Given** a character with a spell, race, lineage or feat pick whose owner or spell comes from a sourcebook
**When** the player switches that book off
**Then** the pick is released with a notice naming the spell and the source, and the choice is not offered while the book is off. A catalog that does not hold the record at all (not loaded) still keeps the pick.

### AC-2: Check when a character is opened

**Given** a character holding picks of a switched-off book, saved before the book was switched off
**When** the player selects the character
**Then** the picks are released with the notice without any other action.

### AC-3: Readers agree

**Given** a book switched off
**When** the race spell choices, the granted-spell cards, the expanded-list sources and the pick pruning read the character
**Then** all four treat the book the same way: hidden choice and released pick, never a hidden choice with a kept pick.

### AC-4: Re-enabling

**Given** AC-1 released a pick
**When** the book is switched on again
**Then** the choice is offered again, empty, and nothing is restored silently.

### AC-5: Lineage change reconciles

**Given** a lineage swap (including Custom Lineage and "none")
**When** it completes
**Then** the old lineage's race picks are released with a notice in the same step, and Custom Lineage has a test.

### AC-6: "(self only)"

**Given** the Gnome (Deep) grant's Nondetection
**When** the Spells tab shows the card
**Then** the spell reads "Nondetection (self only)", the note comes from reviewed catalog data (not app code), and it wraps cleanly at 320, 360, 393 and 412 px, SRD-free (integrated) layout check.

### AC-7: Held records resolved with the active books

**Given** a held race, subrace, background or class record
**When** any reader resolves it where the active books are known (the Journal tab, the legacy cantrip migration, `resolveCharacterBackground`, the Fighting Style ids)
**Then** the active books scope the choice, a custom background named like a catalog one never resolves to the catalog record, and the Fighting Style id takes its source from the class record, not a fixed book.

### AC-8: Expanded-list spells stranded by a book switch

**Given** a spell the character knows only because a held feat's, race's, lineage's or background's expanded list offered it
**When** the book of that source is switched off (or the character is opened with it switched off)
**Then** the spell is released with a notice naming the spell and the source; a spell a class lists itself stays; switching the book back on does not restore it.

### AC-9: Custom Lineage to none

**Given** a character whose lineage is Custom Lineage
**When** the player chooses "None"
**Then** the character is left in a consistent state: the custom race is cleared (the player picks a race again) and nothing of the custom race remains granted.

## Architecture Constraints

- ADR 0017 stands. No non-SRD name in app code: the "(self only)" note is reviewed scraper data carried on the spell entry. Catalog Format rises to 11 if the scraped record shape changes (format 10 is already pushed).
- Releases use the existing notice wording "X removed from Y: reason" and the one expanded-list release. Keep-when-not-loaded stays only for a catalog that lacks the record entirely.
- Layout per CODING_STANDARDS §7; no new explanatory copy beyond the "(self only)" suffix.

## Verification Map

| Criterion | Seam | Oracle and evidence |
| --- | --- | --- |
| AC-1, 3, 4 | `reconcileForActiveBooks`, `pruneInvalidFeatSpellPicks`, race spell choices, `grantedSpellSources`, invented two-book catalog | Red-then-green tests; `check:all` |
| AC-2 | `CharacterContext` selection effect and `reconcileForActiveBooks` | Test of the reconcile on a stale character; the effect's trigger on selection verified by test or read with line reference |
| AC-5 | `changeLineage`, invented lineages including Custom | Red-then-green tests |
| AC-6 | Scraper override and enrich tests, the Spells tab | `check:live` for the real grant, layout scenario at four widths, integrated, screenshots viewed |
| AC-8, 9 | `reconcileForActiveBooks`, `changeLineage`, invented catalog | Red-then-green tests |
| AC-7 | Each reader with an invented two-book catalog | Red-then-green tests |

## Out of Scope

Anything listed under Decisions already made.

## Open Risks

None open; if a ticket finds an unlisted break it reports and fixes it in the same ticket.
