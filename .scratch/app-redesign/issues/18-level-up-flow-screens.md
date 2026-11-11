# 18: Level-Up Flow screens

**Status:** done

**Landed:** feat/app-redesign at cf714f8 (with review repairs R5a, R5b, R6-R9). Gate PASS: check:all, check:live, layout:check (SRD and integrated), layout:android (dice, modal, Actions, Stats, Level-Up Flow scenarios). Evidence: `.scratch/app-redesign/evidence.md`, "Tickets 15-19". Open items: see its advisory dispositions.

## What to build

Level up on the character header opens the Level-Up Flow driven by the level-up plan: only the steps the level brings, Hit Points rolled (logged as "Hit Points") or averaged, Review confirming everything at once, Cancel discarding it. The Spells tab keeps learning, forgetting and swapping spells. It uses the Creation Flow's layout: step chips on phones; at 768px and up a step list, the step, and an identity panel with level and hit points before → after. Class rows show only the level change ("4 → 5", "1") or the missing multiclass score ("Int 13"). Design: ticket 05, "Answer".

## Owns

- AC-16: The Spells tab still learns and swaps spells
- AC-30: A level-up Hit Points roll is logged

## Acceptance Criteria

- [x] AC-16: The Spells tab still learns and swaps spells (spec, AC-16)
- [x] AC-30: A level-up Hit Points roll is logged (spec, AC-30)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-16 | `layout | check` Spells scenario after a seeded level-up: learn and swap work |
| AC-30 | `layout | check` level-up scenario: rolling Hit Points adds a "Hit Points" entry to the Roll Log |

## Constraints

Components read steps from the plan; nothing applies before Review.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

08, 12, 15, 05
