# 06: Releases and notices are exact

**Status:** done

**Landed:** list change releases the old list's counters, an unloaded catalog keeps picks, counters and notices, release notices name the spell and the source. check:all and check:live green. Open: AC-16 (race picks across catalogs) may be partly covered by the per-book keep rule; ticket 08 must verify it end to end.

Spec: `.scratch/granted-spells-followups/spec.md` (ADR 0017 and its amendment, GLOSSARY *Always-Prepared Spells*, *Expanded Spell List*).

## What to build

When a player picks another spell list for a feat, the old list's picks and its Long Rest counters are released with a review notice. A character transition that runs while the catalog is not loaded drops no counter, pick or notice. A release notice names the spell and the source.

## Owns

- AC-10: List change
- AC-11: Unhydrated catalog
- AC-12: Notices name the spell

## Acceptance Criteria

- [x] Picking list B releases list A's picks and counters with a notice (AC-10).
- [x] A transition with an unloaded catalog keeps every counter, pick and notice (AC-11).
- [x] A release notice names the spell and the source (AC-12).
- [x] `npm run check:all` passes.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-10, 11, 12 | Reconciler and `migrateCharacter`, invented catalog | Red-then-green tests asserting counters, picks and notice text |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names and prose in tests. No feat, race or background name in app code. Never hand-edit tracked data; regenerate only with the sanctioned commands. Interface copy is essential mechanics only (CODING_STANDARDS §8); layout per §7.

## Blocked by

None
