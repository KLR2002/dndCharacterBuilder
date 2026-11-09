# 16: Rolls from the Actions tab

**Status:** ready-for-agent

## What to build

On the Actions tab the player rolls an attack (its bonus, with advantage or disadvantage) and its damage (its dice and modifier, dice doubled after a natural 20), each logged, and no roll spends a slot, use or ammunition.

A tap on the "to hit" badge rolls at once with no advantage; holding it opens a roll sheet with Disadvantage, Roll and Advantage; no extra control sits beside the badge. A tap on the damage badge rolls the damage, and the result card offers critical damage after a natural 20. The badge also exposes "Roll with advantage" and "Roll with disadvantage" as accessibility actions and a keyboard path on web. Design: ticket 05, "Answer".

## Owns

- AC-22: The Actions tab rolls attacks and damage
- AC-23: Rolls spend nothing

## Acceptance Criteria

- [ ] AC-22: The Actions tab rolls attacks and damage (spec, AC-22)
- [ ] AC-23: Rolls spend nothing (spec, AC-23)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-22 | `layout | check` scenario: attack and damage Rolls use the expected bonus and dice; advantage shows two d20s |
| AC-23 | `checks/` test | rolling an attack and its damage leaves slots, uses and ammunition unchanged. Mutation check: delete the roll wiring and see the browser scenario fail |

## Constraints

Read bonuses and damage from the Tactical Action Ledger and attack rules; do not recompute them.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

15
