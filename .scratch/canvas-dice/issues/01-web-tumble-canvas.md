# 01: Web Tumble on a canvas

**Status:** done

**Landed:** feature/3d-dice @ 7f6ed57. Layout check "Dice animation" green at 393 and 768, red against the SVG code (9 violations); canvas and label checks, pixel sampling and screenshots done. Open item: the animation-frame cancel on unmount is not seen by any check (no scenario unmounts mid-turn); looked at in review.

## What to build

On the web, the Tumble animation in the result card draws all its solids on one `<canvas>` (2D context) instead of one SVG per die. A new 2D drawing routine takes a die's geometry, pose, accent and size and draws it with the same flat shading, outlines, numerals, pips and dropped grey as the SVG die; ticket 02 reuses it for the Throw, so keep it a pure module with a small interface (a context, a die, a pose, a colour, a size). The canvas is redrawn from `requestAnimationFrame` using the existing pose functions and timing constants (`tumbleQuaternion`, `tumblePop`, the stagger). Next to the canvas there is one hidden label element per drawn die, named like today (`d20 showing 14`, `d20 showing 3, dropped`), inside the row that stays hidden from assistive technology. Native keeps the SVG dice until ticket 04.

Reference for the look: `SolidDie.tsx` and `diceProjection.ts` (commit `d1226ac` for the SVG version), and the Kotlin drawing in the branch `prototype/canvas-dice` (`git show prototype/canvas-dice:modules/dice-canvas/android/src/main/java/expo/modules/dicecanvas/DiceCanvasView.kt`) for the algorithm: culling at normal z ≤ 0.004, shade 0.3 + 0.7·max(0, n·L) with L = normalize(-0.35, 0.5, 0.8), stroke max(1, 0.035·size), numerals in the system bold sans.

## Owns

- AC-3: On the web, Tumble is drawn on one canvas inside the result card

## Acceptance Criteria

- [x] AC-3: With the Dice Animation on Tumble, a Roll shows one `<canvas>` inside the result card with up to 10 solids, each turning and stopping on the generator's face; a hidden label element per die has the name from the old SVG die and its face equals the die's chip in the card; a dropped die is grey after it stops; the row stays `aria-hidden`; solids past 10 show as number chips only; the canvas draws nothing after unmount and a new Roll replaces the old dice.
- [x] No `<svg>` is created for Tumble on the web; reduced motion and the Off setting behave as before.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-3 | Web layout check, scenario "Dice animation" (`ONLY="Dice animation" WIDTHS=393 npm run layout:check`, plus 768) | The scenario is rewritten to read the label elements and the card's chips, count labels (11 dice give 10), check `aria-hidden`, and sample the canvas pixels at a die's centre for the accent and for the grey after the stop. Show it failing before the change and passing after. Mutation check: remove the cleanup of the animation frame on unmount (and the clear on a new Roll) and see a check fail, or say why no check can see it. |
| Look | Screenshot | Open a screenshot of each die type mid-turn and at rest and compare with the SVG dice; say what differs. |

## Constraints

- Spec `.scratch/canvas-dice/spec.md`, ADR 0022. Pose and shading math stays in the existing `src/rules/` modules; no new npm package, no WebGL.
- Keep the test IDs `dice-solids` for the row; label test IDs may keep the old `die-solid-N` names so the layout check changes are small.
- Do not touch the Throw (ticket 02) or the native build.
- Follow `docs/agents/subagent-tiering.md`, section "Implementer Rules".

## Blocked by

None.
