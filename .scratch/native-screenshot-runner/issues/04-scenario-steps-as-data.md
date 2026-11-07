# 04: Scenario steps as data

**Status:** ready-for-agent

## What to build

Every scenario's `open` and `modal` step becomes data (tap the text, with an optional index) that the web runner plays as clicks, so the native runner can play the same steps later. A step that has no native form marks its scenario web-only. The ticket reports how many scenarios stay web-only.

## Owns

- AC-7: Scenario steps are data

## Acceptance Criteria

- [ ] AC-7: Each `open` and `modal` step in the shared module is data, the web runner plays it with the same outcome as today, a step with no native form marks its scenario web-only, and the number of web-only scenarios is reported under `## Comments` at the bottom of this ticket.

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
