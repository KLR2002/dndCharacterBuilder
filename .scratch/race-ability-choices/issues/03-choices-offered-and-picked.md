# 03: Increase Choices are offered and picked from the catalog

**Status:** ready-for-agent

Spec: `.scratch/race-ability-choices/spec.md`. ADR 0019. GLOSSARY: *Increase Choice*, *Flexible Increases*, *Origin Swap*, *Origin Customization*.

## What to build

The held ancestry offers each Increase Choice from the catalog, with its own persisted id, pool, count and amount. With Origin Customization available, the pool is all six scores. A score already raised by another racial increase, or that the increase would take above 20, is never offered. Flexible Increases apply only to an ancestry with neither Fixed Increases nor choices. A pick is saved with its choice id, and a pick over the count or on a blocked score is refused. No race is recognised by name for its increases.

## Owns

- AC-9: Choices come from the catalog, not from names
- AC-10: Origin Customization widens the pool
- AC-11: No two racial increases share a score, and none passes 20
- AC-12: Flexible Increases only without fixed increases or choices
- AC-13: A pick is saved under its choice

## Acceptance Criteria

- [ ] AC-9: each choice is offered with its id, pool (`from`), count and amount; a replacing subrace offers only its own; an invented race with a choice is offered without any name check. `CHOICE_ASI_RACES` and the `"Variant"` / `"Custom Lineage"` increase checks are gone.
- [ ] AC-10: with Origin Customization available, a SCAG-like choice's pool is all six minus AC-11's blocked scores; without it, its `from`.
- [ ] AC-11: with a Fixed Increase on INT (at its swap target when swapped), a pick on DEX, and base WIS 20, the second pick of a 2-at-+1 choice is not offered INT, DEX or WIS. Flexible Increases picks obey the same blocking.
- [ ] AC-12: an ancestry with neither fixed nor choice offers Flexible Increases; a Variant-Human-like choice-only race offers its 2-at-+1 choice; a Custom-Lineage-like race offers its 1-at-+2 choice; neither is flexible.
- [ ] AC-13: picks are saved with `choiceId`; a pick over the count or on a blocked score is refused and returns the character unchanged.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-9 – AC-12 | `resolveAncestryState` (or the offer function exported by `ancestryIncreases.ts`) | Red-green test output |
| AC-13 | `setChoiceRacialBonus` (builder transition) | Red-green test output |
| Mutation check | Offer blocking and pool widening | Delete each blocking/widening line in turn and show a test fail |

## Constraints

- Choice id format and `racialChoiceBonus` `choiceId?` field: spec Architecture Constraints. Ids are persisted and never change once shipped.
- Choices are not offered while `compendium.stale` (AC-16 is ticket 04, but the offer side must already hide the picker then).
- The UI rows and card text are ticket 05; this ticket may keep the existing picker rendering working off the new offers, with no copy change.
- Releasing invalid saved picks is ticket 04.
- The Variant Human origin-feat check in `feats.ts` stays.

## Blocked by

02
