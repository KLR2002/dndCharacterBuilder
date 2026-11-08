# 13: Edit Build

**Status:** ready-for-agent

## What to build

Edit Build reopens a finished Character's Creation Flow at a chosen step with every step reachable, applies the release-and-flag rule to changes, and on the Class step lowers a class's levels (releasing that level's picks) without any way to raise a level or add a class.

## Owns

- AC-10: Edit Build reopens the flow at a chosen step
- AC-11: Edit Build lowers levels but never adds them

## Acceptance Criteria

- [ ] AC-10: Edit Build reopens the flow at a chosen step (spec, AC-10)
- [ ] AC-11: Edit Build lowers levels but never adds them (spec, AC-11)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-10 | `layout | check` scenario: Edit Build on Background opens there with every step reachable; a class change flags later steps |
| AC-11 | `checks/` test | lowering Wizard 2→1 on Fighter 3 / Wizard 2 releases the level's picks; the Edit Build Class offer has no raise or add-class action |

## Constraints

Lower levels through `removeClassLevel` and the Reconciler.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

12
