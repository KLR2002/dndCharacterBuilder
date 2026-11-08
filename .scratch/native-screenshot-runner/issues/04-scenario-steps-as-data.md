# 04: Scenario steps as data

**Status:** done
**Landed:** 04b7500. `checks/scenarioSteps.test.ts` 6/6 and `checks/scenariosModule.test.ts` 3/3, red-green (implementer). Main session on the merged tree: `layout-check.mjs --list` equals both fixtures (50 SRD, 67 integrated); full `npm run layout:check` GREEN in SRD mode (224 screenshots) and with `--integrated` (292 screenshots); `npm run check:all` exit 0 (1772 app tests, 305 scraper tests). Web-only scenarios: 1 of 50 (SRD) and 1 of 67 (integrated), `New Character modal`. Open: the native reading of `index` and `pattern` is ticket 07's seam.

## What to build

Every scenario's `open` and `modal` step becomes data (tap the text, with an optional index) that the web runner plays as clicks, so the native runner can play the same steps later. A step that has no native form marks its scenario web-only. The ticket reports how many scenarios stay web-only.

## Owns

- AC-7: Scenario steps are data

## Acceptance Criteria

- [x] AC-7: Each `open` and `modal` step in the shared module is data, the web runner plays it with the same outcome as today, a step with no native form marks its scenario web-only, and the number of web-only scenarios is reported under `## Comments` at the bottom of this ticket.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-7 | Scenario module plus the web runner | Full `npm run layout:check` (SRD) is green and visits the same scenarios as before; the same for `-- --integrated`. A test over the module: no scenario holds a function-valued `open` or `modal`. Red-green: the test fails against the module as it was before this ticket. |

## Constraints

- Spec: `.scratch/native-screenshot-runner/spec.md`.
- Playwright code stays in the web runner. The shared module holds data only.
- Out of scope: playing steps natively (ticket 07).

## Blocked by

03

## Comments

AC-7 web-only counts: SRD Baseline mode 1 of 50 scenarios, integrated mode 1 of 67 scenarios — in both modes the only web-only scenario is `New Character modal`. Its single step is the named step `home-header-add` (the home header's round add button has no text or label, so only the web runner's coordinate tap can play it); every other `open` step is a `tap` by text, pattern or label that a native runner can play from the same data.
