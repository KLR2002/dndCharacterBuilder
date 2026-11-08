# 17: Rolls from the Stats tab

**Status:** ready-for-agent

## What to build

On the Stats tab the player rolls each ability check, saving throw and skill with its bonus and the chosen advantage or disadvantage, each logged.

## Owns

- AC-31: The Stats tab rolls checks, saves and skills

## Acceptance Criteria

- [ ] AC-31: The Stats tab rolls checks, saves and skills (spec, AC-31)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-31 | `layout | check` scenario: a check, a save and a skill roll with the expected bonus; advantage shows two d20s. Mutation check: delete the roll wiring and see it fail |

## Constraints

Read bonuses from the Evaluated Character Engine and the Proficiency Sheet.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

15
