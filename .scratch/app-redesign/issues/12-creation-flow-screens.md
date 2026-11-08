# 12: Creation Flow screens

**Status:** ready-for-agent

## What to build

New characters are built through the Creation Flow on screen: a step rail driven by the step model, each step holding the existing builder section it covers, drafts shown in the character list with their step and opening into the flow with no sheet tabs, and Review finishing the character into its sheet whose header offers Level up and Edit Build in place of the Builder tab. Layout: variant B of map ticket 03 (step chips across the top, the choice list filling the screen, a one-line identity summary above the primary action that opens the full character panel in a bottom sheet), adapted at wide widths as map ticket 04's answer sets out (vertical step list left, choices centre capped about 640px, identity panel always shown on the right). Choice rows show only what tells the options apart. Built in the visual system ticket 04 records.

## Owns

- AC-6: A draft opens into the flow, not the sheet
- AC-8: Review finishes the character

## Acceptance Criteria

- [ ] AC-6: A draft opens into the flow, not the sheet (spec, AC-6)
- [ ] AC-8: Review finishes the character (spec, AC-8)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-6 | `layout | check` scenario: a seeded draft shows its step in the list and opens on it with no sheet tab reachable, at all four widths |
| AC-8 | `layout | check` scenario: confirming Review opens the sheet with Level up and Edit Build and no Builder tab |

## Constraints

Components read step order and status from the step model; they never decide it. Follow `CODING_STANDARDS.md` section 7 and `DESIGN.md`.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

06, 07, 04
