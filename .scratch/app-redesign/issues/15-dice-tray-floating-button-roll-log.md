# 15: Dice tray, floating button and Roll Log

**Status:** ready-for-agent

## What to build

A floating dice button at the bottom-right of every screen (the sheet and both flows included, covered only by an open modal's overlay) opens a tray that builds and rolls any pool, and a session Roll Log lists every Roll newest first with its character and source, empty after a restart and never saved with the Character. The tray is a pool builder (a row of die buttons that each add one die, the pool as an expression line with removable chips, a modifier stepper, Disadvantage / Normal / Advantage for a lone d20, one primary action labelled with the pool). Each Roll shows a result card above the floating button, offering "Roll damage" or "Roll critical damage" after an attack; tapping it opens the Roll Log, a "Log" segment in the tray. Design: ticket 05, "Answer", and the prototype on branch `prototype/level-up-dice`.

## Owns

- AC-32: The floating dice button opens a tray on every screen
- AC-24: The Roll Log names character and source, for this session only

## Acceptance Criteria

- [ ] AC-32: The floating dice button opens a tray on every screen (spec, AC-32)
- [ ] AC-24: The Roll Log names character and source, for this session only (spec, AC-24)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-32 | `layout | check` scenarios: the button visible on the sheet and in both flows at all four widths; the tray rolls a pool and shows the result |
| AC-24 | `layout | check` scenario: entries read "Kara · Longsword attack" and "Dice tray", newest first; a reload empties the log |

## Constraints

The Roll Log lives in app state only. Rolls come from the dice module.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

09, 05
