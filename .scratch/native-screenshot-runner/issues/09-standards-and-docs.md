# 09: Standards and docs

**Status:** done
**Landed:** the merge of `t3/native-layout-android-docs` (see the log). `grep -n 'layout:android'` prints a line from `AGENTS.md`, `CODING_STANDARDS.md` and `docs/agents/driving-the-android-emulator.md`. The Android doc is 38 lines, built around the command, with the flag list left to the header of `scripts/layout-android.mjs`, the gotchas and the manual steps kept. The implementer checked every command, flag, variable and path it names against `package.json`, the runner and the repository; the main session read all three files against the facts established in the run.

## What to build

The project standards name `npm run layout:android` as the check for native-only changes, and the Android emulator doc is rewritten around the runner. The manual steps stay for ad-hoc work.

## Owns

- AC-17: The standards name the command

## Acceptance Criteria

- [x] AC-17: `AGENTS.md` (Verification) and `CODING_STANDARDS.md` section 7 name `npm run layout:android` for native-only changes, and `docs/agents/driving-the-android-emulator.md` is built around the command, with the manual steps kept and the seed-hook and E2E build stated as they are after tickets 01 to 08.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-17 | The three docs | `grep -n 'layout:android' AGENTS.md CODING_STANDARDS.md docs/agents/driving-the-android-emulator.md` prints a line from each file. Every command and variable the doc names exists in `package.json` or the runner. |

## Constraints

- Spec: `.scratch/native-screenshot-runner/spec.md`. Follow the `writing-for-agents` skill: one source of truth, no sediment, positive instructions.
- Out of scope: code.

## Blocked by

08, 10
