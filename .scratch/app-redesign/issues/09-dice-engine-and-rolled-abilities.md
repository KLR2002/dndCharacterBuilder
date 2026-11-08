# 09: Dice engine and Rolled Abilities

**Status:** ready-for-agent

## What to build

A pure dice module (pools with a flat modifier, advantage and disadvantage on d20s, doubled damage dice on a critical, 4d6 drop lowest) with an injectable random source, and Rolled Abilities as a fourth ability method in the current Abilities section: roll six results with every die shown and the dropped one marked, place each on one Ability Score like Standard Array, reroll as often as wanted (clearing placements). Results are text; no animation.

## Owns

- AC-17: Rolled Abilities rolls six sets of 4d6, dropping the lowest
- AC-18: Rolled results are placed like Standard Array, and rerolls are unlimited
- AC-19: A Roll totals a dice pool and a modifier
- AC-20: Advantage and disadvantage keep the higher or lower d20
- AC-21: A critical hit doubles the damage dice

## Acceptance Criteria

- [ ] AC-17: Rolled Abilities rolls six sets of 4d6, dropping the lowest (spec, AC-17)
- [ ] AC-18: Rolled results are placed like Standard Array, and rerolls are unlimited (spec, AC-18)
- [ ] AC-19: A Roll totals a dice pool and a modifier (spec, AC-19)
- [ ] AC-20: Advantage and disadvantage keep the higher or lower d20 (spec, AC-20)
- [ ] AC-21: A critical hit doubles the damage dice (spec, AC-21)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-17 | `checks/` test with fixed faces | six results, each the top three of four d6, dropped die identified; `layout:check` on the Abilities section shows them |
| AC-18 | `checks/` test | each result placed once; reroll replaces all six and clears placements |
| AC-19 | `checks/` test | `2d6+1d8+3` with fixed faces totals their sum plus 3 |
| AC-20 | `checks/` test | advantage keeps the higher, disadvantage the lower, both d20s reported |
| AC-21 | `checks/` test | a kept natural 20 doubles damage dice, not the modifier |

## Constraints

The ability method union and its migration gain the new method without changing existing saves. The Abilities section keeps its current look; the Creation Flow screens adopt it later.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

None
