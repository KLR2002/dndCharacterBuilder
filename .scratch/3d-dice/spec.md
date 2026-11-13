# Spec: Solid 3D dice, Tumble and Throw, and the Roll Expression

**Status:** ready-for-agent

Settled in a grilling session; the throwaway prototype is on the local branch `prototype/3d-dice` (`git show prototype/3d-dice:.scratch/3d-dice/prototype-dice.html`). Its three script modules (`m-expr`, `m-geo`, `m-phys`) are pure and meant to be lifted. Vocabulary: **Roll**, **Roll Expression**, **Dice Animation** in `GLOSSARY.md`. Architecture: `docs/adr/0021-dice-throws-are-simulated-before-they-are-drawn.md`.

## Goal
Replace the flat 2D dice in the result card with solid dice, offer two animations (Tumble, Throw), and replace the tray's pool builder with a text field that takes a Roll Expression.

## Decisions
- **Drawing:** plain polygons with `react-native-svg`, driven by Reanimated. No 3D library, no physics library.
- **Solids:** d4, d6 (pips), d8, d10, d12, d20, and d100 as two d10s (tens 00-90, units 0-9). A units "0" counts as 10, so tens + units reaches 1-100 once each. A lone d10 prints 1-10. Every other die is digital: a number chip, never drawn.
- **Setting:** Dice Animation = Off / Tumble / Throw. A saved "3D dice" on becomes Tumble, off stays Off. No saved value: Tumble, or Off under reduced motion.
- **Tumble:** dice turn in the result card (up to 10 solids) and stop on the face the generator drew.
- **Throw:** up to 20 solids fly over the whole screen from the floating dice button; the face on top is the result. The result card appears when they stop. Pressing Roll again replaces a throw in progress. A tap during flight ends it and shows the result. After they stop the screen works normally and the dice fade after about 1.5 s. Every Roll that reaches the Roll Log follows the mode (tray, badges, attacks, "Roll damage", Hit Points); Rolled Abilities in the builder does not.
- **Past the cap:** the rest of the dice are decided by the generator and show only as number chips, with no note.
- **Roll Expression:** `NdX` (N optional, X any whole number 1-1000), whole numbers, `+` and `-` (never a sign first), `a(...)` and `d(...)` (case ignored; `d(` is the function, `d6` is a die). Arguments of a function are one d20 plus optional whole numbers (`d20`, `d20+5`, `d20-1`), two or more of them; a single argument is rolled twice (`a(d20)` = `a(d20,d20)`). A Roll needs at least one die. Dice may be subtracted outside functions (`d20-d4`).
- **Several Rolls:** a comma outside parentheses separates independent Rolls, each with its own total (`d20,d20`). A count before a function repeats the whole Roll: `2a(d20,d20)+5` is `a(d20,d20)+5,a(d20,d20)+5`, `d4+2a(d20,d20)` is `d4+a(d20,d20),d4+a(d20,d20)`. A Roll may have one counted function. At most 10 Rolls and 100 dice per expression. Ties keep the first argument.
- **Advantage and disadvantage results:** the kept result shows normally; the others show greyed out (the dice, and each argument's subtotal).
- **Roll Log and card:** each Roll is its own Roll Log entry (expression order within the batch, batches newest first), headed by its own expression text instead of "Dice tray". The card stacks the Rolls, each with its own total and no grand total.
- **Colours:** a Roll's dice take an accent. The first Roll of an expression wears the selected accent, the next ones the next accents in the Options order (wrapping), Shadow Silver skipped for later Rolls, repeating when they run out. The colour appears on the dice, on a bar and the chips of the Roll's block in the card, and on a dot in the Roll Log for Rolls from multi-Roll batches. A Roll made anywhere else is a single Roll in the selected accent.
- **Tray:** the text field is the pool. The die buttons (d4, d6, d8, d10, d12, d20, d100) and the modifier stepper edit its text, the removable chips go, the Disadvantage / Normal / Advantage control shows only when the text is a lone d20 with an optional modifier. The text stays between openings until a Roll from the tray empties it, and is never saved.

## Open
- **Frame rate on a phone.** Drawing about 20 solids with `react-native-svg` at 60 fps on a low-end Android is unmeasured; the user tests it on a device (ticket 11). Fallbacks, cheapest first: draw numerals only on the top face while a die moves; draw only the faces that are visible and skip shading steps; play the Throw back at 30 fps; lower the Throw cap; sprite frames; Skia.

## Tickets
01 roll-expression-module, 02 roll-batches-and-colours, 03 tray-expression-field, 04 dice-animation-setting, 05 dice-solids-geometry, 06 solid-die-svg-renderer, 07 tumble-animation, 08 throw-physics, 09 two-pass-roll-seam, 10 throw-overlay, 11 check-animation-speed-on-a-phone.
