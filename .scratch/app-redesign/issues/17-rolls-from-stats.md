# 17: Rolls from the Stats tab

**Status:** done

**Landed:** feat/app-redesign at cf714f8 (with review repairs R5a, R5b, R6-R9). Gate PASS: check:all, check:live, layout:check (SRD and integrated), layout:android (dice, modal, Actions, Stats, Level-Up Flow scenarios). Evidence: `.scratch/app-redesign/evidence.md`, "Tickets 15-19". Open items: see its advisory dispositions.

## What to build

On the Stats tab the player rolls each ability check, saving throw and skill with its bonus and the chosen advantage or disadvantage, each logged.

Each bonus badge rolls on a tap with no advantage; holding it opens the roll sheet with Disadvantage, Roll and Advantage, with the same accessibility actions and keyboard path as ticket 16. Design: ticket 05, "Answer".

## Owns

- AC-31: The Stats tab rolls checks, saves and skills

## Acceptance Criteria

- [x] AC-31: The Stats tab rolls checks, saves and skills (spec, AC-31)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-31 | `layout | check` scenario: a check, a save and a skill roll with the expected bonus; advantage shows two d20s. Mutation check: delete the roll wiring and see it fail |

## Constraints

Read bonuses from the Evaluated Character Engine and the Proficiency Sheet.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

15
