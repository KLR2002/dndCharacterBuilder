# 05: Look review, web and Android

**Status:** ready-for-agent

## What to build

Compare the canvas dice with the SVG dice they replace and fix any difference in the drawing. Take screenshots of every solid (d4, d6 with pips, d8, d10, d12, d20, d100 as tens and units) at rest and mid-motion, in Tumble and in Throw, on the web build and on the Android emulator, and put them next to the SVG ones (render the SVG ones from commit `d1226ac` in a throwaway worktree, or use the shots kept from it). Open every image. A difference in shape, shading, outline, numerals, pips, shadows, accent or dropped grey is fixed in the TypeScript or the Kotlin drawing, and the fixture of ticket 03 is re-recorded only through its recorder switch when the math had to change.

## Owns

- AC-6: The look is unchanged

## Acceptance Criteria

- [ ] AC-6: For every die type, at rest and mid-motion, on web and on Android, the shapes, flat shading, outlines, numerals, pips, shadows, accents and the dropped grey match the SVG dice; the report names each screenshot opened and any difference left, with why.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-6 | Screenshots on web and the Android emulator | Paths of the screenshots, a statement per die type of what was compared. A green check is not evidence of a look. |

## Constraints

- Spec `.scratch/canvas-dice/spec.md`, ADR 0022. Same look only: no gradients, no new highlights.
- Leave the SVG code in place; ticket 06 removes it.
- Follow `docs/agents/subagent-tiering.md`, section "Implementer Rules".

## Blocked by

02, 04
