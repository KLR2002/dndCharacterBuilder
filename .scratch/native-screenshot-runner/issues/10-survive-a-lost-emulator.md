# 10: Survive a lost emulator

**Status:** ready-for-agent

## What to build

A run that loses its emulator does not report every remaining scenario as failed. When the runner started the emulator, it boots it again (at most twice per run), installs the APK, sets the width's density again and repeats the scenario that was running. When the emulator was not started by the run, the runner stops at the scenario where the device was lost, says so, and exits non-zero without running the rest.

## Owns

- AC-18: A lost emulator is survived or reported

## Acceptance Criteria

- [ ] AC-18: When the emulator goes offline or disappears during a run, a runner-started emulator is booted again (at most twice per run), the APK installed, the density set again, and the running scenario repeated; a reused emulator stops the run at that scenario with a message naming it and a non-zero exit, without running the remaining scenarios.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-18 | Runner scenario loop, with a fake `adb` that drops the device at a chosen scenario | Red-green tests for both branches. Mutation check: delete the retry limit and the offline check and see a test fail each time. |
| AC-18 | Full run on the emulator | A run with a runner-started emulator, killed from outside during a scenario (`adb emu kill`): the run reboots it and finishes, with every scenario's screenshot present. |

## Constraints

- Spec: `.scratch/native-screenshot-runner/spec.md`. The failure was seen in a long run: the emulator died about 10 minutes in (host GPU context loss), and every later scenario reported `adb: device offline`.
- Headless emulators start with `-gpu host`; the default software renderer segfaults on a cold boot here.
- Out of scope: finding why the emulator dies.

## Blocked by

08
