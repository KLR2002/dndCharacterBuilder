# 04: Saved Increase Choice picks are reconciled

**Status:** ready-for-agent

Spec: `.scratch/race-ability-choices/spec.md`. ADR 0019. GLOSSARY: *Increase Choice*, *Catalog Format*.

## What to build

The reconcile pass keeps saved picks in step with the held ancestry's choices: a pick that leaves its pool, belongs to a choice the ancestry no longer has, or goes over the count is released with a review notice; a legacy pick without a choice id is assigned to the first choice it fits; a stale catalog releases nothing. Scores that change only because the catalog was corrected change without a notice.

## Owns

- AC-14: A pick that no longer fits is released with a notice
- AC-15: A legacy pick is assigned to the first fitting choice
- AC-16: A stale catalog releases nothing
- AC-17: Corrected data changes scores silently

## Acceptance Criteria

- [ ] AC-14: with a current catalog, a saved WIS pick outside its pool (or on a choice no longer held, or over the count) is removed and `Ability increase to Wisdom removed: ancestry no longer offers it` is added to the review notices.
- [ ] AC-15: a Half-Elf-like character with legacy picks `{str,1}` and `{dex,1}` keeps both, now under the choice's id, scores unchanged, no notice; a legacy pick fitting no choice is released with the AC-14 notice.
- [ ] AC-16: with a stale compendium, saved picks are kept and applied as stored, no notice is added, and no choice is offered.
- [ ] AC-17: a saved replacing-subrace character with no picks, whose stored racial bonuses were the old stacked ones, reconciles to the subrace's own increases with no notice.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-14 – AC-17 | `reconcile()` (`characterReconciler.ts`) with invented catalogs, including a stale compendium | Red-green test output |
| Mutation check | Release and legacy-assignment lines | Delete each in turn and show a test fail |

## Constraints

- Releasing happens in the same pass that derives `racialAbilityBonuses` (`reconcileOriginAbilities`), deterministic, so a second pass changes nothing.
- Never release while `compendium.stale`, or when the held race or subrace is missing from the catalog.
- Notice copy exactly as AC-14; no other new copy.

## Blocked by

03
