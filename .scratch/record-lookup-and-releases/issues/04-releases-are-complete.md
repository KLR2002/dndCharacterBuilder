# 04: Releases are complete

**Status:** ready-for-agent

Spec: `.scratch/record-lookup-and-releases/spec.md`.

## What to build

The remaining paths that leave state behind release it with a notice. `changeRace` names each dropped race pick with the spell and the race. When a character loses Spellcasting or Pact Magic, or the class that gave it, a spell known only from an expanded list of a held feat, race or background is released with a notice, while a spell a class lists itself stays. A lineage swap releases the spell its old lineage's expanded list alone gave. A legacy racial pick whose new key already holds an empty entry moves into that entry. Use the existing expanded-list release and the notice wording of the earlier work.

## Owns

- AC-7: Race change names what it drops
- AC-8: Losing spellcasting or a class
- AC-9: Lineage swap
- AC-10: Empty entry

## Acceptance Criteria

- [ ] `changeRace` leaves a notice for each dropped race pick naming the spell and the race (AC-7).
- [ ] Losing Spellcasting or Pact Magic, or the casting class, releases a spell known only from a held source's expanded list, with a notice; a spell a class lists itself stays (AC-8).
- [ ] A lineage swap releases the spell only the old lineage's expanded list gave, with a notice (AC-9).
- [ ] A legacy racial pick moves into an empty entry under its new key (AC-10).
- [ ] `npm run check:all` passes.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-7, 8, 9 | Transitions with an invented catalog (see `checks/expandedSpellSources.test.ts`) | Red-then-green tests: entries and notice text asserted |
| AC-10 | `migrateCharacter` and the legacy pick move, invented catalog | Red-then-green test: the entry takes the pick |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names in tests except where real data is the point (SRD and live-catalog tests). No non-SRD name in app code. The saved source of a character is never rewritten. Notices read "X removed from Y: reason"; no new explanatory copy; layout per CODING_STANDARDS §7. Reuse the one expanded-list release; do not copy it.

## Blocked by

03
