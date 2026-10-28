# 02: Lineage change reconciles

**Status:** done

**Landed:** `changeLineage` releases the old lineage's race picks (with a notice) and reconciles with the active books in the same step; a held lineage's picks are no longer dropped by `changeRace`; Custom Lineage, none and swap are tested. check:all and check:live green. Open: switching Custom Lineage to none leaves the race as "Custom Lineage" (handled in the final repair).

Spec: `.scratch/spells-wrap-up/spec.md`.

## What to build

`changeLineage` (swap to another lineage, to Custom Lineage, or to none) reconciles in the same step with the active books, so the old lineage's race picks are released with a notice immediately, not on the next reconcile. Custom Lineage gets its own test, including the race it sets; the Custom Lineage race record is not a catalog record, so the reconcile must not release picks of the new custom race by mistake.

## Owns

- AC-5: Lineage change reconciles

## Acceptance Criteria

- [x] After a lineage swap the old lineage's race picks are released with a notice in the same step (AC-5).
- [x] Swapping to Custom Lineage and to none is covered by tests, and picks of the new race are not released by mistake (AC-5).
- [x] `npm run check:all` passes.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-5 | `changeLineage` with invented lineages, including a Custom Lineage | Red-then-green tests; the component call passes the active books |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invented names in tests except where real data is the point. No non-SRD name in app code. Notices read "X removed from Y: reason". Layout per CODING_STANDARDS §7; design must be responsive. The SRD carve-out constant is `SRD_SOURCE` in `src/constants/books.ts`.

## Blocked by

None
