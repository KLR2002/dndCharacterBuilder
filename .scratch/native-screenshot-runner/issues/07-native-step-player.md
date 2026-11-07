# 07: Native step player

**Status:** ready-for-agent

## What to build

The runner plays a scenario's `tabs`, `open`, `modal` and `scrollTo` fields on the emulator: the first three as taps on the text found in the dump, `scrollTo` as swipes until the text shows. `expect` is not evaluated. Scenarios marked web-only are skipped and listed.

## Owns

- AC-13: Native steps play the shared fields

## Acceptance Criteria

- [ ] AC-13: `tabs`, `open` and `modal` are carried out as taps on the text found in the dump, `scrollTo` as swipes until the text shows, `expect` is not evaluated, and web-only scenarios are skipped and listed in the run's output.

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
