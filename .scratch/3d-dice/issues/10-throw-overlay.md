# 10: Throw over the whole screen

**What to build:** The Throw Dice Animation. `DiceOverlay` mounts a full-screen layer that plays back the recorded throw (`pendingThrow`, ticket 09) with `SolidDie` (ticket 06): dice fly from the floating dice button, with a soft shadow on the floor that grows apart from the die as it rises, sorted by height, each in its Roll's accent. While the dice move the layer takes the first tap: it ends the throw at once and shows the result card. When the last die stops, `revealResult()` shows the result card, dropped dice turn grey, the layer stops taking touches (the screen works normally) and the dice fade out about 1.5 s later over about 0.5 s; a new Roll replaces a throw in progress and clears the dice. The screen reader announcement (and the web live region) fire when the card appears, not when the throw starts. Options gets the third segment, Throw (testID `dice-animation-throw`), after Tumble. With reduced motion and no saved choice the setting stays Off as before. For E2E, the physics random source is `Math.random` unless the E2E hook sets a seed, so a scenario can make a throw repeatable.

**Blocked by:** 02, 06, 09

**Status:** ready-for-agent

- [ ] `ONLY=dice WIDTHS=320 npm run layout:check` (and 393, 768, 1280) passes with a Throw scenario in `scripts/layout-check.mjs`: with Throw selected and a seeded physics source, `d6,d8` leaves two dice inside the viewport after the throw, the result card is absent while the dice fly and present after they stop, its totals equal the faces the dice show (read from the dice's accessible labels), the first Roll's dice use the selected accent and the second's the next, a tap during flight shows the card at once, a second Roll mid-flight leaves only the second's dice, after the fade no dice remain, and the screen under the layer is tappable after the throw stops
- [ ] `checks/diceOverlayAnnounceGuard.test.ts` passes (one live region, announce on Android and iOS only, web region always mounted)
- [ ] `npm run layout:android` with `ONLY` set to a Throw scenario shows dice thrown from the button and settled on the emulator; screenshots named in the review
- [ ] `npm run check:all` passes
