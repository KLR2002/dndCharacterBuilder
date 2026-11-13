# 07: Tumble with solid dice in the result card

**What to build:** The Tumble Dice Animation draws the solid dice from tickets 05 and 06 in the result card and replaces the old `AnimatedDiceRoll`. Each die of the latest batch that `planSolidDice` marks as a solid (cap 10 over the batch; a d100 is two dice) sits in a 72dp cell, in a row that wraps, above the Roll blocks, and turns about a random axis for about 950 ms with 45 ms between dice, easing to the orientation that shows the face the Roll already holds (`poseShowing`), with a small lift and scale. One Reanimated shared value drives all dice and the projection runs in a worklet. Each die wears its Roll's accent (ticket 02); dice that were dropped turn grey after they stop. Dice with no solid (d2, d3, d1000, any die past the cap) are not drawn; the number chips below keep listing every die. The old `AnimatedDiceRoll.tsx`, `animatedDice`, `MAX_ANIMATED_DICE` and their tests go.

**Blocked by:** 02, 04, 06

**Status:** ready-for-agent

- [ ] `checks/diceAnimation.test.ts` covers the pure part: the tumble orientation at progress 1 equals `poseShowing` for the die's face, at progress 0 it differs, and `planSolidDice` caps a batch of 14 d6 at 10 solids
- [ ] `ONLY=dice WIDTHS=320 npm run layout:check` (and at 393, 768, 1280) passes with the "3D dice" sections of `scripts/layout-check.mjs` rewritten for the new dice (testIDs `die-solid-N`): a Roll of `d6+d8` mounts two dice, 14 d6 mount 10, `d3+d6` mounts one, a d100 mounts two, a dropped die is muted after it stops, Off mounts none, the dice are inside the card, and the settle budget in the script is met
- [ ] `npm run layout:android` with `ONLY` set to the scenarios that show the result card with dice shows readable numerals on the top faces on the emulator (SVG text on a transform is native-risky); the screenshots are named in the review
- [ ] `npm run check:all` passes
