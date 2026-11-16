# 07: Phone test

**Status:** ready-for-human

## What to build

Nothing to code. The user builds with EAS (`eas build -p android --profile preview-arm64-v8a`) from the integration branch and tries the dice on the phones. High-end phone: Throw with `5d20`, `10d20` and `20d20`, and Tumble with `10d20`. Weakest phone they care about: `10d20` in Throw and in Tumble.

## Owns

- AC-9: Smooth on phones, never torn

## Acceptance Criteria

- [ ] AC-9: The motion is reported smooth on both phones, no stopped die shows torn faces, and a Throw starts without a visible stall; the devices are named in the report.
- [ ] If a Throw starts with a stall, a follow-up ticket moves the scene parse off the UI thread; if the weakest phone is not smooth, a follow-up lowers the Throw cap with the user's numbers.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-9 | The user's phones, EAS build with no debug overlay | The user's report. |

## Constraints

- Spec `.scratch/canvas-dice/spec.md`. Nothing is pushed or opened as a pull request without the user's word.

## Blocked by

06
