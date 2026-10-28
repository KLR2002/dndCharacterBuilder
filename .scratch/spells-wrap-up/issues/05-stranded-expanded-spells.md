# 05: Expanded-list spells stranded by a book switch, and Custom Lineage to none

**Status:** done

**Landed:** `reconcileForActiveBooks` releases a known spell only a held feat, race, lineage or background expanded list offered once that source's book is off (also when a character is opened), keeping class-listed, other-source and catalog-lacks cases; `changeLineage` clears the custom race when leaving Custom Lineage. check:all and check:live (135/135) green. Open: saves already in the broken Custom Lineage state are not migrated; picking "Custom Lineage" from the race search list sets the race without the lineage flag (both handled in the final repair).

Spec: `.scratch/spells-wrap-up/spec.md` (AC-8, AC-9).

## What to build

A known spell that only a held source's expanded list offered stays in the character's known spells when the player switches that source's book off, because the release runs only on removal transitions (`releaseExpandedOnlySpells(before, after)`); the readers hide the list but the stored copy lingers, and it would reappear when the book returns. Make the reconcile for active books (the one that runs when books change and when a character is selected) release such stranded spells with a notice naming the spell and the source: a known spell is stranded when a class's current list (including expanded lists of sources that are active) no longer offers it AND it is on the expanded list of a source the character still holds by name but whose book is switched off. A spell a class lists itself stays; a spell offered by another active source stays; switching the book back on does not restore it. Also, choosing "None" for a Custom Lineage leaves the race as "Custom Lineage" with the flags cleared (an inconsistent state): make `changeLineage` clear the custom race when moving from Custom Lineage to none, so the player picks a race again and nothing of the custom race stays granted.

## Owns

- AC-8: Expanded-list spells stranded by a book switch
- AC-9: Custom Lineage to none

## Acceptance Criteria

- [x] Switching off the book of a held feat, race, lineage or background releases a known spell only its expanded list offered, with a notice naming the spell and the source; opening a character saved with the book already off does the same (AC-8).
- [x] A spell a class lists itself, or another active source offers, stays; switching the book back on restores nothing (AC-8).
- [x] Custom Lineage to none clears the custom race and leaves a consistent character (AC-9).
- [x] `npm run check:all` passes.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-8 | `reconcileForActiveBooks` with an invented catalog (see `checks/expandedSpellSources.test.ts`, `checks/switchedOffOwnerPicks.test.ts`) | Red-then-green tests per source kind (feat, race, lineage, background), keep cases, re-enable case |
| AC-9 | `changeLineage` (see `checks/lineageChange.test.ts`) | Red-then-green test of the state after Custom to none |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Reuse the existing expanded-list helpers in `src/rules/backgroundSpells.ts` (one reader, one release); do not copy them. No non-SRD name in app code. A catalog that lacks the source record entirely keeps the spell (not loaded). Notice wording "X removed: only on the Y list" as the existing release.

## Blocked by

01 (merged)
