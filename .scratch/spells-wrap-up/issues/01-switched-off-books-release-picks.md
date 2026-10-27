# 01: Switched-off books release their picks

**Status:** done

**Landed:** a switched-off owner book (race, lineage, feat) releases its picks and the feat's Long Rest counters with a notice ("book switched off"); a catalog that lacks the owner record still keeps them; the four readers agree; the selection effect in `CharacterContext.tsx` (lines 366-376, deps `selectedCharacterId`, `activeBooks`, `integratedAt`, `isLoading`) runs the reconcile on open; re-enabling offers the choice again, empty. check:all and check:live (134/134) green. Open: a known spell learned from an expanded list is not released on a book switch (ticket 05); race identity is by name by design.

Spec: `.scratch/spells-wrap-up/spec.md`.

## What to build

When the player switches a sourcebook off, every pick that belongs to it goes with a notice naming the spell and the source: spell picks (already released), and now race, lineage and feat picks whose owner record comes from that book. The choice is not offered while the book is off, and the four readers that look at the character (race spell choices, granted-spell cards, expanded-list sources, pick pruning) agree: a hidden choice never keeps a pick. A catalog that does not hold the record at all (not loaded) still keeps the pick, and a record the loaded catalog lost still releases it. Selecting a character runs the same check, so a character saved before its book was switched off is cleaned when opened (the context already reconciles on selection and on book changes: verify it covers a stale character with a test and a line reference, and fix it if not). Switching the book back on offers the choice again, empty, without silently restoring anything. Replace the pinned tests that keep race, lineage or feat picks while their book is off; keep the ones for a catalog that lacks the record entirely.

## Owns

- AC-1: Switched-off book releases picks
- AC-2: Check when a character is opened
- AC-3: Readers agree
- AC-4: Re-enabling

## Acceptance Criteria

- [x] Switching a book off releases a race, lineage or feat pick whose owner comes from it, with a notice naming the spell and the source, and the choice is hidden (AC-1).
- [x] A catalog that lacks the owner record entirely keeps the pick; a loaded catalog that lost the record releases it (AC-1).
- [x] Selecting a character saved before its book was switched off releases the picks with the notice (AC-2).
- [x] The four readers give the same verdict for the same switched-off book (AC-3).
- [x] Switching the book back on offers the choice again, empty (AC-4).
- [x] `npm run check:all` passes.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-1, 3, 4 | `reconcileForActiveBooks`, `pruneInvalidFeatSpellPicks`, `raceSpellRuleChoices`, `grantedSpellSources`, `heldExpandedSources`, invented two-book catalog | Red-then-green tests per reader and per owner kind (race, lineage, feat) |
| AC-2 | The `CharacterContext` selection effect and `reconcileForActiveBooks` on a stale character | A test of the reconcile result and a read of the effect's dependencies, with file and line in the report |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invented names in tests except where real data is the point. No non-SRD name in app code. Notices read "X removed from Y: reason". Layout per CODING_STANDARDS §7; design must be responsive. The SRD carve-out constant is `SRD_SOURCE` in `src/constants/books.ts`. Read how the earlier tickets decided 'keep while the catalog lacks the book' (`bookLoadedFor`/`ownerBookLoaded` in `src/rules/choices/featSpells.ts`, `checks/grantedSpellReleases.test.ts`, `checks/raceLookup.test.ts`) and keep that distinction: a switched-off book is not an unloaded catalog.

## Blocked by

None
