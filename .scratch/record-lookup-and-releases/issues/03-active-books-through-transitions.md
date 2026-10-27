# 03: Active books threaded through the remaining transitions

**Status:** ready-for-agent

Spec: `.scratch/record-lookup-and-releases/spec.md`.

## What to build

A used Long Rest counter of a background-claimed feat held in two active books survives the class and subclass transitions, setting a custom background, clearing an ancestry choice, and a pick made from the rest modal, as it already does for the feat, ASI, race, ancestry and background transitions. Thread the active books through each remaining reconcile and release call, from the catalogs the callers already hold, with no new process-wide compendium reads.

## Owns

- AC-6: Active books everywhere

## Acceptance Criteria

- [ ] For each remaining transition (class change, subclass change and teardown, custom background, ancestry clear, rest-modal rule-choice pick), a counter of the picked list of a feat held in two active books is kept (AC-6).
- [ ] No new `currentCompendium()` read is introduced by the change.
- [ ] `npm run check:all` passes.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-6 | Each transition with an invented two-book catalog (see `checks/grantedFeatRecords.test.ts`) | Red-then-green test per transition: counter kept, no notice |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names in tests except where real data is the point (SRD and live-catalog tests). No non-SRD name in app code. The saved source of a character is never rewritten. Notices read "X removed from Y: reason"; no new explanatory copy; layout per CODING_STANDARDS §7.

## Blocked by

None
