# 04: The Dice Animation setting

**What to build:** The saved "3D dice" boolean becomes the Dice Animation setting with the values off, tumble and throw. `AppSettings` (`src/services/storage.ts`) gets `diceAnimation?: "off" | "tumble" | "throw"` with validation in `normalizeSettings`; a saved `dice3dEnabled` of true reads as tumble and false as off when `diceAnimation` is absent, and the old field is dropped on the next settings write. `src/rules/diceAnimation.ts` replaces `resolveDiceAnimationEnabled` with `resolveDiceAnimation(saved, reduceMotion)`: the saved value wins, otherwise tumble, or off under reduced motion. `CharacterContext` exposes `diceAnimation` and `setDiceAnimation` in place of `dice3dEnabled` and `setDice3dEnabled`, and `useDiceAnimationEnabled` becomes `useDiceAnimation()` returning the resolved mode (callers that only care whether a renderer mounts test it against "off"). The Options DICE section replaces the checkbox with a segmented choice, Off and Tumble for now (a later ticket adds Throw), with testIDs `dice-animation-off` and `dice-animation-tumble`, minimum 48dp targets, no help text. Nothing else about the animation changes: Tumble still renders the existing 2.5D dice.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `checks/diceAnimation.test.ts` rewritten first: saved values win over reduced motion; no saved value gives tumble, or off under reduced motion; settings saved with `dice3dEnabled: true` load as tumble and `false` as off; a non-string or unknown `diceAnimation` is rejected; the setting survives a round trip and a patch of another field keeps it
- [ ] `scripts/layout-check.mjs` (the sections that read `dice-3d-switch`) uses the new controls: choosing Off removes the animated dice from a new Roll, choosing Tumble brings them back, the selected segment shows the accent border
- [ ] `ONLY=dice,options WIDTHS=320 npm run layout:check` passes at 320 and 393
- [ ] `npm run check:all` passes
