# 07: Native step player

**Status:** done
**Landed:** e5b1c4e (player), fab8181 (clipped dump nodes are off-screen), 07167cf (reveal by swipe count, absent scrollTo warns), 5997174 (emulator on ANGLE). Tests: `checks/nativeSteps.test.ts`, `checks/androidRunner.test.ts` and `checks/uiautomator.test.ts` pass, red-green and mutation checks by the implementers; real dump fixtures from the emulator. `npm run check:all` exit 0 on each merge (1858 app tests, 305 scraper tests). Main session, real run of every SRD scenario at 360 dp on an `angle_indirect` emulator: 48 screenshots written, 2 warnings (a `scrollTo` needle absent from the page, as the web check's `scrollTo` does nothing then), 1 web-only skip (`New Character modal`), 1 failure (`Review notices dismiss rows apart`: a transient `am start` exit 255; it passes when run alone); the emulator stayed up for the whole 18 minutes. Screenshots checked by eye: `Builder Class` is scrolled to `Starting Equipment & Gold:`, `Builder Class equipment picker open` shows the picker with `Greatsword`, `Rest modal` shows the dialog. Findings: the emulator's host GL renderer (`-gpu host`) lost its GL context and died after 8 and 29 scenarios in two full runs (a null `glGetString` in its render thread); the default software renderer segfaults on a cold boot; `angle_indirect` finished the whole list. The runner now boots with `-gpu angle_indirect`. Open: a transient `am start` failure should be retried (ticket 08); a lost emulator is ticket 10.

## What to build

The runner plays a scenario's `tabs`, `open`, `modal` and `scrollTo` fields on the emulator: `tabs` and the `open` steps as taps on the text, pattern or label found in the dump, `modal` (the dialog's title) as the text waited for before the screenshot, `scrollTo` as swipes until the text shows. `expect` is not evaluated. Scenarios marked web-only are skipped and listed.

## Owns

- AC-13: Native steps play the shared fields

## Acceptance Criteria

- [x] AC-13: `tabs` and the `open` steps are carried out as taps on the text, pattern or label found in the dump, reaching a target that starts off the screen by swiping within a bounded number of swipes that does not depend on how long a dump takes; `modal` is the text waited for before the screenshot and the ready text counts as shown when it is on the screen at any scroll position; `scrollTo` is carried out as swipes until the text shows, and when no scroll position shows it the runner says so and takes the screenshot where it is; `expect` is not evaluated, and web-only scenarios are skipped and listed in the run's output.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-13 | Step player on fixture dump XML, with a fake `adb` recording taps and swipes | Red-green tests: the right coordinates are tapped; swipes repeat until the text appears and stop after a bounded number of tries. |
| AC-13 | Full run on the emulator | A real run of one scenario that uses `tabs`, `open` and `scrollTo`, with its screenshots attached. |

## Constraints

- Spec: `.scratch/native-screenshot-runner/spec.md`.
- Out of scope: the failure report and the isolation rules between scenarios (ticket 08).

## Blocked by

04, 06
