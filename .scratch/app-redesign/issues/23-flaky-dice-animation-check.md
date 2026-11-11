# 23: Flaky dice animation check under load

**Status:** folded into ticket 24

## What to build

The "dice animation" check in `scripts/layout-check.mjs` (about line 1348-1370) takes two samples of the die's transform 120ms apart and fails if they match. In the full five-width `npm run layout:check -- --integrated` run it failed at two widths in both runs on ticket 22: 320/393 in one run, 360/412 in the other. The message was "the die pose did not change between samples 120ms apart". Run alone (`ONLY="dice animation"`), it passes at every width. Under load the browser can drop frames between the two samples. Make the check prove that an animation ran without depending on frame timing in one 120ms window. For example, sample over a longer window until the pose changes, or read the animation's own state. A die that never animates must still fail.

## Acceptance Criteria

- [ ] With the 3D dice animation stubbed out, the check fails
- [ ] Three full `npm run layout:check -- --integrated` runs in a row are GREEN

## Constraints

No assertion is weakened: a die that never animates must still fail.

## Blocked by

None
