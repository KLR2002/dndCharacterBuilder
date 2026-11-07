# 08: Failure handling and isolation

**Status:** ready-for-agent

## What to build

A scenario whose `ready` text never appears is reported and does not stop the run. Between scenarios the app is reset by the scenario's own flags: `fresh` clears the data and reseeds, `modal` force-stops and relaunches by deep link without clearing, and every other scenario only jumps to its route by deep link.

## Owns

- AC-14: A stuck scenario is reported and does not stop the run
- AC-15: Isolation follows `fresh`, `modal` and route

## Acceptance Criteria

- [ ] AC-14: When a scenario's `ready` text does not appear within its timeout, the runner saves the stuck screen as `<scenario>-<width>-FAILED.png`, runs the remaining scenarios, and exits non-zero.
- [ ] AC-15: A `fresh` scenario clears the app's data and copies the seed in again; a `modal` scenario force-stops and relaunches by deep link without clearing; any other scenario only jumps to its route by deep link.

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
