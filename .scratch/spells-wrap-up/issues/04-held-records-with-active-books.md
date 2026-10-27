# 04: Held records resolved with the active books

**Status:** ready-for-agent

Spec: `.scratch/spells-wrap-up/spec.md`.

## What to build

The remaining readers that resolve a held record where the active books are known take them: the Journal tab's race lookup (pass the subrace too), the legacy cantrip migration's `raceGrantsOf` call, `resolveCharacterBackground` (a custom background named like a catalog one never resolves to the catalog record), and the Fighting Style choice ids (the source comes from the class record, not a fixed book). Re-grep the spell and race path for any other `findHeldRace`, `findHeldRecord`, `findRace`, `findBackground`, `findClassData` or `heldClass` call that has the books available and does not pass them, and fix each; report any that cannot get the books and why.

## Owns

- AC-7: Held records resolved with the active books

## Acceptance Criteria

- [ ] The Journal tab, the legacy cantrip migration and `resolveCharacterBackground` scope the held record by the active books (AC-7).
- [ ] A custom background named like a catalog background does not resolve to the catalog record (AC-7).
- [ ] The Fighting Style choice id takes its source from the class record, so an active-book set without the PHB still offers the choice for a class from another book (AC-7).
- [ ] The re-grep finds no remaining unscoped call with the books available, and the report lists each fix.
- [ ] `npm run check:all` and `npm run check:live` pass.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-7 | Each reader with an invented two-book catalog | Red-then-green test per reader; the Fighting Style test with a class from a non-PHB book |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invented names in tests except where real data is the point. No non-SRD name in app code. Notices read "X removed from Y: reason". Layout per CODING_STANDARDS §7; design must be responsive. The SRD carve-out constant is `SRD_SOURCE` in `src/constants/books.ts`. Saved rule-choice ids must keep working: the Fighting Style id change must still read ids saved under the old scheme.

## Blocked by

01
