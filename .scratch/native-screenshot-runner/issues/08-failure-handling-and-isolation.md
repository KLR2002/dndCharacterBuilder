# 08: Failure handling and isolation

**Status:** done
**Landed:** a3d77de, with df37c76 (a tab is reached from any scroll position, which the isolation made necessary). `checks/androidRunner.test.ts` 52/52 and `checks/nativeSteps.test.ts` 40/40, red-green and mutation checks (the clear, the `modal` force-stop, the reseed push, the FAILED pull) by the implementers; `npm run check:all` exit 0 on each merge (1870 app tests, 305 scraper tests). Real runs by the implementer: a deliberately wrong ready text gave `Builder-Class-360-FAILED.png` (a valid PNG), the scenarios after it still wrote their screenshots, exit 1; the edit was reverted. Main session, full SRD list at 360 dp on the merged tree with a runner-booted ANGLE emulator: exit 0, 49 screenshots, 0 FAILED screenshots, 1 web-only skip, 2 expected `scrollTo` warnings, no lost device; the modes used were 4 `reset+seed`, 28 `deep link`, 13 `same route`, 4 `relaunch`; the runner stopped its emulator at the end. Screenshots checked by eye (Conditions modal, Review notices expanded, Spells). Finding: the isolation does not make the run faster. The full list took 19 min 21 s for 49 scenarios, against about 18 min for 48 with a full reset per scenario; playing the steps (a `uiautomator dump` takes about 2 s) dominates. Four widths of the whole list are therefore about 75 minutes, so `ONLY` is the usual way to run it. Open: a lost emulator is ticket 10.

## What to build

A scenario whose `ready` text never appears is reported and does not stop the run. Between scenarios the app is reset by the scenario's own flags: `fresh` clears the data and reseeds, `modal` force-stops and relaunches by deep link without clearing, and every other scenario only jumps to its route by deep link.

## Owns

- AC-14: A stuck scenario is reported and does not stop the run
- AC-15: Isolation follows `fresh`, `modal` and route

## Acceptance Criteria

- [x] AC-14: When a scenario's `ready` text does not appear within its timeout, the runner saves the stuck screen as `<scenario>-<width>-FAILED.png`, runs the remaining scenarios, and exits non-zero.
- [x] AC-15: The first scenario of a width clears the app's data and copies the seed in; a `fresh` scenario clears the app's data and copies the seed in again; a `modal` scenario force-stops and relaunches by deep link without clearing; any other scenario only jumps to its route by deep link.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-14 | Full run with a deliberately wrong `ready` | The run exits non-zero, `-FAILED.png` exists, and scenarios after the stuck one still produced PNGs. |
| AC-15 | Runner scenario loop, with a fake `adb` recording its calls | Red-green test of the call sequence for each kind of scenario. Mutation check: delete each `pm clear`, `force-stop` and reseed line and see a test fail each time. |

## Constraints

- Spec: `.scratch/native-screenshot-runner/spec.md`. The `modal` rule mirrors the web runner, which reloads the page for a `modal` scenario.
- Out of scope: any change to the scenario list or the seed.

## Blocked by

07
