# 06: Creation Flow step model

**Status:** done

**Landed:** feat/app-redesign at a7a1e85 (with review repairs R1-R4). Gate PASS: check:all, check:live, layout:check (SRD and integrated), layout:android modals. Evidence: `.scratch/app-redesign/evidence.md`. Open items: see its advisory dispositions.

## What to build

A pure rules module that lists a Character's Creation Steps in the agreed order, skips the steps it does not qualify for, reports each step's status (finished, current, locked) and the current step of a draft, offers one class with a starting level 1–20 defaulting to 1, requires a name on Details, and treats a saved Character with no creation progress as finished. The Character gains one optional creation-progress record; `migrateCharacter` keeps old saves finished. No UI yet.

## Owns

- AC-1: Steps follow the order and skip what does not apply
- AC-2: The Class step offers one class and a starting level
- AC-3: Later steps stay locked until the current step is valid
- AC-5: A draft resumes at its step
- AC-7: Details asks only for name, gender and alignment
- AC-9: Characters from the old builder count as finished

## Acceptance Criteria

- [x] AC-1: Steps follow the order and skip what does not apply (spec, AC-1)
- [x] AC-2: The Class step offers one class and a starting level (spec, AC-2)
- [x] AC-3: Later steps stay locked until the current step is valid (spec, AC-3)
- [x] AC-5: A draft resumes at its step (spec, AC-5)
- [x] AC-7: Details asks only for name, gender and alignment (spec, AC-7)
- [x] AC-9: Characters from the old builder count as finished (spec, AC-9)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-1 | `checks/` test | Wizard 1, Cleric 1 and Fighter 4 fixtures from `makeChar()` give the spec's step lists |
| AC-2 | `checks/` test | the Class step offer has level 1–20, default 1, no add-class action |
| AC-3 | `checks/` test | with no race picked, Background and later report locked; earlier finished steps open |
| AC-5 | `checks/` test | a draft left on Background reports Background as current |
| AC-7 | `checks/` test | empty name leaves Details invalid and Review locked; empty gender and alignment do not |
| AC-9 | `checks/` test | a save with no creation progress loads as finished through `migrateCharacter`; existing fixtures evaluate unchanged |

## Constraints

Reuse `subclassLevel`, `asiLevels` and the Spellcasting Profile for skipping; do not hard-code class lists.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

None
