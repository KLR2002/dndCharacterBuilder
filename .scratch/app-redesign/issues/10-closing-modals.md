# 10: Closing modals

**Status:** ready-for-agent

## What to build

Every modal closes when the player taps the visible background outside it or presses Escape on the web. A modal whose closing would throw away unsaved work asks before closing.

## Owns

- AC-28: Tapping outside a modal closes it, and Escape closes it on web

## Acceptance Criteria

- [ ] AC-28: Tapping outside a modal closes it, and Escape closes it on web (spec, AC-28)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-28 | `layout | check`: backdrop tap and Escape close each modal; a work-discarding modal asks first. Mutation check: delete the Escape handler and the confirm guard in turn and see the check fail |

## Constraints

Change the shared modal shell, not each modal. The bottom-sheet shape on phones belongs to ticket 14.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

None
