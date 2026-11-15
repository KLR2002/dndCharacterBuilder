# 02: Web Throw on a canvas

**Status:** done

**Landed:** feature/3d-dice @ 022bf3a. Layout check `ONLY=Dice` green at 393 and 768, red against the SVG code (11 violations); removing the frame cancel or the clear after the fade makes a check fail; `check:all` green. AC-4 allows same-origin lazy chunks of the app and fails on any other request or a canvaskit, skia or wasm file.

## What to build

On the web, the Throw layer draws all thrown dice and their shadows on one full-screen `<canvas>` using the 2D drawing routine of ticket 01, instead of one SVG per die. It plays the recorded Throw frames (`sampleThrow`) from a `requestAnimationFrame` loop. Throw shadows are drawn first, then dice sorted by depth, each at its lifted size. Next to the canvas there is one hidden label element per thrown die, named like today (`d20 showing 14`, `d20 showing 3, dropped`, `d100 showing 40`). The behaviour of the flight does not change: the card appears when the dice stop, a tap during the flight shows the card and clears the dice, a Roll during the flight replaces them, the layer takes taps right after the stop, the dice fade after about 1.5 s, and more than 20 solids show 20 and number chips for the rest. The first animated Roll on a fresh page plays the animation, and nothing is downloaded for it; with the Off setting no `<canvas>` is mounted. Native keeps the SVG dice until ticket 04.

## Owns

- AC-1: On the web, a Throw is drawn on one canvas, one label per die
- AC-2: Throw behaviour is unchanged on the web
- AC-4: The first animated Roll on the web plays the animation

## Acceptance Criteria

- [x] AC-1: A Roll of `d20,d20` and of `a(d20,d20)+d100` shows one canvas covering the screen and one hidden label per thrown die with the old names; each label's face equals the die's chip in the result card; the canvas pixel at a die's centre has the accent, or grey for a dropped die.
- [x] AC-2: Card on stop, tap during flight, Roll during flight, taps after the stop, fade after about 1.5 s with the canvas gone afterwards, and the 20-solid cap all behave as before.
- [x] AC-4: On a fresh page with Throw (and with Tumble) the first Roll shows its solids and the network log has no request besides the app's own bundle; with Off no `<canvas>` exists after several Rolls.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-1, AC-2 | Web layout check, scenarios "Dice throw animation" and "Dice batch" (`ONLY="Dice" WIDTHS=393 npm run layout:check`, plus 768) | The existing assertions keep passing against the label elements; the old `svg polygon` assertions are replaced by pixel sampling. Show the changed checks failing against the old SVG code or a probe, then passing. Mutation check: remove the layer's cleanup (animation frame cancel, canvas removal after the fade) and see a check fail. |
| AC-4 | Web layout check | Playwright network log on a fresh page for Throw, Tumble and Off, as in the criterion. |
| Look | Screenshot | Open screenshots of a Throw mid-flight and settled, including a dropped die, and compare with the SVG ones. |

## Constraints

- Spec `.scratch/canvas-dice/spec.md`, ADR 0022. Keep the test IDs `throw-layer`; label IDs may keep the old `throw-die-N` names.
- Reuse the drawing routine from ticket 01 rather than copying it. The simulation, the two-pass roll seam and the caps do not change.
- Follow `docs/agents/subagent-tiering.md`, section "Implementer Rules".

## Blocked by

01
