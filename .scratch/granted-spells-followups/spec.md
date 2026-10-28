# Spec: Granted Spells Follow-ups (prepared grants, expanded lists, open items)

**Status:** ready-for-human
**Tracker:** local markdown (`.scratch/granted-spells-followups/`).
**Related:** `.scratch/granted-spells/spec.md` (the work this completes), ADR 0017 and its amendment, ADR 0015, ADR 0013, CODING_STANDARDS §7. GLOSSARY terms *Innate Magic*, *Always-Prepared Spells*, *Expanded Spell List*, *Catalog Format*, *Spell Owner*.

## Problem

After the granted-spells release, many spell grants from feats and races still do not show. About 37 feats use `prepared` groups (Adept feats, Mark of X, Vampire Touched, Boons). Mark feats and Mark races carry `expanded` lists the reader ignores. Five grants name no casting ability, so they get no card. Nine leveled `known` race spells are unverified against their trait text. Half-Elf Drow Descent ignores its pick. Several release and counter gaps remain.

## Acceptance Criteria

### AC-1: Prepared spells in the class list

**Given** a Wizard 5 holding a feat or race whose `prepared` group names Spell X
**When** the Spells tab opens
**Then** X is listed under its level in the Wizard's list with a lock icon and a badge naming the source, it is not in `knownSpells` or `preparedSpells`, and the Wizard's prepared count and limit are unchanged.

### AC-2: Every class gets them

**Given** a Wizard 3 / Cleric 2 with that source
**When** either class's list is opened
**Then** X is listed in both, and its save DC and attack bonus use the active class's ability.

### AC-3: Level gate

**Given** a race whose prepared spell unlocks at character level 3
**When** the character is level 2
**Then** it is absent; at level 3 it is listed.

### AC-4: No class

**Given** a Fighter (no spellcasting) holding that source
**When** the Spells tab opens
**Then** a small locked card for the source lists X with no counter. When the character takes a spellcasting class, the card is gone and X appears in the class list.

### AC-5: Release

**Given** AC-1
**When** the feat or race is removed or swapped
**Then** X disappears from every list and no ghost remains in stored spells.

### AC-6: Expanded lists of feats and races

**Given** a character with Spellcasting (or Pact Magic) holding a feat or race whose `expanded` lists name Spell Y
**When** learning spells
**Then** Y is offered on every spellcasting class's list. Given no spellcasting feature yet, Y is not offered. Given Y was learned and only that list offered it, when the source is removed, Y is released with a review notice; a spell the class gives itself stays.

### AC-7: Grants with no ability

**Given** a feat whose grant names spells and no ability (Cartomancer-shaped)
**When** the Spells tab opens
**Then** its card lists the cantrips at will and the daily spells with their Long Rest counters, and shows no ability, DC or attack row.

### AC-8: Leveled `known` race spells

**Given** each of the 9 grants with leveled `known` spells (Dwarf Mark of Warding, Genasi Air and Earth, Gnome (Deep), Halfling Mark of Hospitality, Hexblood, Human Marks of Making, Passage and Sentinel)
**When** read
**Then** each spell's level gate and uses match its trait text. A wrong one is corrected by a reviewed scraper override, not an app rule, and a test pins each.

### AC-9: Drow Descent gate

**Given** a Half-Elf
**When** Drow Descent's option is not picked
**Then** its spell grant is absent; when picked, present. The gate is data in the reviewed overrides.

### AC-10: List change

**Given** a Magic Initiate whose picks and counters belong to list A
**When** the player picks list B
**Then** A's picks and counters are released with a notice.

### AC-11: Unhydrated catalog

**Given** a transition runs while the catalog is not loaded
**When** it completes
**Then** no counter, pick or notice is dropped or lost.

### AC-12: Notices name the spell

**Given** a released pick
**When** the notice shows
**Then** it names the spell and the source.

### AC-13: Race card title

**Given** a High Elf
**When** its card shows
**Then** the title is "High Elf", not "High".

### AC-14: No false warning

**Given** a background-claimed feat
**When** active books are checked
**Then** no "disabled sourcebook 'Background'" warning appears.

### AC-15: Duplicate feat names

**Given** a catalog holding the same feat in two books
**When** a background claims it
**Then** the record is chosen deterministically (an active book first, then the background's own book, then catalog order) and the picks stay stable across loads.

### AC-16: Race picks across catalogs

**Given** a High Elf cantrip picked on the SRD Baseline
**When** the integrated catalog is synced
**Then** the pick still stands, with no release and no notice.

### AC-17: Gate stays honest

**Given** feats the reader now models
**When** the coverage gate runs
**Then** their reviewed "not modelled" marks are removed (a stale mark throws), and `check:live` stays green.

### AC-18: Prepared groups with their own ability or uses are Innate Magic

**Given** a feat or race whose `prepared` group names its own casting ability (fixed, chosen or inherited from the feat's increase) or gives at-will or daily casts (Mark of Detection, Vampire Touched, Boon of Siberys, Magic Connoisseur shapes)
**When** the Spells tab opens
**Then** the source has its own card with that ability's save DC and attack bonus, its at-will spells and its daily spells with Long Rest counters, and its spells are not in the class list. A prepared group with neither (Adept feats, plain lists) stays in the class list under AC-1.

## Architecture Constraints

- ADR 0017 stands, as amended. `prepared` grants of feats and races are Always-Prepared Spells, shown in class lists and never stored or counted. No feat, race or background name enters app code; wrong data is fixed in the scraper's reviewed overrides.
- A `prepared` group that names its own ability or gives uses is Innate Magic (AC-18); only plain prepared groups use the class's ability and the class list. Slot casting stays in the feat text.
- If the scraped record shape changes, the Catalog Format rises to 10, because format 9 is pushed before this work lands.
- The class list reader reads its data from the evaluation's supplied Catalog, not the process-wide compendium.
- No explanatory UI copy beyond the badge and notice texts. Layout rules follow CODING_STANDARDS §7.

## Verification Map

| Criterion or risk | Seam | Oracle and evidence |
| --- | --- | --- |
| AC-1 to AC-5 | `evaluateCharacter` and `getClassSpellProfiles`, invented catalog in `checks/` | Listed or absent entries, stored spells unchanged, counts unchanged; `npm run check:all` |
| AC-1, AC-4 UI | Spells tab | New `layout:check` scenarios, SRD and `-- --integrated`, four widths, screenshots viewed |
| AC-6 | Spell availability and background-release path, invented catalog | Offered or absent, released with notice; `check:all` |
| AC-18 | `grantedSpellSources` and class profiles, invented catalog | Red-then-green tests: card with ability and counters, absent from the class list; plain groups unchanged |
| AC-7 | `grantedSpellSources` | Card has spells and counters, no ability row |
| AC-8, AC-9, AC-17 | Scraper enrich and gate tests, live build | `check:live`, each of the 9 grants pinned |
| AC-10 to AC-12, AC-14 to AC-16 | Reconciler and `migrateCharacter`, invented catalog | Counters, picks and notices asserted; `check:all` |
| AC-13 | Spells tab | Layout scenario screenshot |

## Out of Scope

Splitting `featSpells.ts`, merging the scraper's `apply*Spells` functions, unused exports that predate the branch, slot casting of granted spells, ritual-only feats, a pre-add pick UI.

## Open Risks

- Prepared groups exist only in the live catalog (the tracked snapshot has none), so the first real check is `check:live`. Owner: the implementer of the first ticket.
- AC-8 needs the real trait text. The implementer reads it from the live catalog's prose, not memory.
