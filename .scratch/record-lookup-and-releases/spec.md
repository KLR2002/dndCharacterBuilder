# Spec: Record Lookup by Name and Complete Releases

**Status:** ready-for-human
**Tracker:** local markdown (`.scratch/record-lookup-and-releases/`).
**Related:** `.scratch/granted-spells-followups/spec.md` (the work this completes), ADR 0017 and its Amendment, ADR 0013 (SRD Baseline), ADR 0014, CODING_STANDARDS §7. GLOSSARY terms *SRD Baseline*, *Integrated Catalog*, *Expanded Spell List*, *Innate Magic*.

## Problem

A character saved on the SRD Baseline loses its race's ability bonuses, size, darkvision and every racial trait once the integrated catalog loads, because several readers match the saved race by source only (Hill Dwarf HP also drops). Several transitions ignore the active books, so a feat held in two books can lose a used counter. `changeRace`, a lost spellcasting or class, and a lineage swap leave picks or expanded-list spells behind without a notice. The legacy-pick move ignores an empty entry under the new key. The builder trait and the prepared-spell badge still name the subrace alone.

## Acceptance Criteria

### AC-1: Race found by name after a catalog change

**Given** a High Elf Wizard saved with race source "SRD"
**When** the integrated catalog (source "PHB") is loaded
**Then** ability bonuses, size, darkvision, speed, granted traits and rule choices equal what the SRD catalog gave. Hill Dwarf and Human likewise, and Hill Dwarf HP stays 10.

### AC-2: Both directions

**Given** a character saved on the integrated catalog
**When** only the SRD Baseline is loaded
**Then** the same results hold.

### AC-3: Source first, then name, scoped to active books

**Given** a catalog holding the race under two sources
**When** the saved source matches one
**Then** that record is used. When none match, an active book's record is used, then catalog order, and the result is the same on every load. The same lookup serves the subrace.

### AC-4: Other record kinds

**Given** a character saved with class, subclass, background or feat source "SRD"
**When** the integrated catalog loads
**Then** its sheet equals the SRD one. Kinds that already hold get a regression test; any that break are fixed through the same lookup.

### AC-5: Saved source untouched

**Given** any of the above
**When** the character loads
**Then** its saved sources are never rewritten.

### AC-6: Active books everywhere

**Given** a background-claimed feat held in two active books, with a used counter
**When** a class, subclass, custom-background, ancestry-clear or rest-modal pick transition runs
**Then** the counter stays.

### AC-7: Race change names what it drops

**Given** a character with race picks
**When** `changeRace` runs
**Then** each dropped pick has a notice naming the spell and the race.

### AC-8: Losing spellcasting or a class

**Given** a spell known only from an expanded list of a held feat, race or background
**When** the character loses Spellcasting or Pact Magic, or that class
**Then** the spell is released with a notice; a spell a class lists itself stays.

### AC-9: Lineage swap

**Given** the AC-8 spell from a lineage
**When** the lineage is swapped
**Then** the spell is released with a notice.

### AC-10: Empty entry

**Given** a legacy racial pick whose new key already holds an empty entry
**When** it moves
**Then** the entry takes the pick.

### AC-11: Race naming

**Given** a High Elf
**When** the builder trait and the class-list badge of prepared race spells show
**Then** the trait reads "High Elf Cantrip (choose 1)" and the badge reads "High Elf"; the rule from the earlier work applies to every other subrace.

## Architecture Constraints

- One shared race and subrace lookup (source, then name, scoped to active books) replaces the strict matches in `characterAncestry`, `grantedFeatures`, `speed`, `raceRuleChoices` and `compendium.findRace`; `ancestryEngine` already does this and uses the same function.
- The saved source is never rewritten. No non-SRD name enters app code.
- Notice wording follows "X removed from Y: reason". No new explanatory copy.
- Layout rules per CODING_STANDARDS §7 for any UI text change.

## Verification Map

| Criterion or risk | Seam | Oracle and evidence |
| --- | --- | --- |
| AC-1 to AC-5 | `evaluateCharacter`, `grantedFeatures`, `speed`, `findRace` with SRD and integrated catalogs | Red-then-green tests on real data plus invented catalogs for the two-source case; `check:all`, `check:live` |
| AC-6 | Transitions, invented catalog | Counter kept; `check:all` |
| AC-7 to AC-10 | Transitions and `migrateCharacter`, invented catalog | Notices and entries asserted; `check:all` |
| AC-11 | Builder race section and Spells tab | Layout scenario and screenshot, integrated, four widths |

## Out of Scope

Vampire Touched, the Boon of Magic School Mastery filter, nondetection's "self only", Hexblood's RHW record, native layout verification, rewriting saved sources, per-class spell-level caps.

## Open Risks

- AC-4 may find breaks in more record kinds than expected. Owner: the implementer of the first probing ticket, who reports before fixing beyond the shared lookup.
- A name-only lookup with no active-book scope returns catalog order; scoping is part of AC-3.
