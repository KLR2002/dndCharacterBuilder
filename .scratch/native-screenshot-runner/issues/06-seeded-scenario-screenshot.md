# 06: Seeded scenario screenshot

**Status:** ready-for-agent

## What to build

One scenario of the shared list runs end to end on the emulator: the runner copies the seed into the app's private folder with `run-as`, launches the scenario's route by deep link, waits for its `ready` text by polling `uiautomator dump`, and writes `<scenario>-<width>.png` into the run's screenshot folder.

## Owns

- AC-12: A seeded scenario produces a screenshot

## Acceptance Criteria

- [ ] AC-12: For a scenario at one width, the runner copies the seed in with `run-as`, launches the route by deep link, waits for `ready` in the dump, and writes `<scenario>-<width>.png` into `SHOTS`, or into a new folder outside the repo when `SHOTS` is unset.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-12 | Dump parser, on fixture dump XML | Red-green test: the parser finds a text, a regular expression match, and the tap point of an element in a fixture, and reports absence. |
| AC-12 | Full run on the emulator | `npm run layout:android -- --no-build` with `ONLY=Settings`: the PNG exists and shows Settings. Attach the screenshot and the command output. |

## Constraints

- Spec: `.scratch/native-screenshot-runner/spec.md`. Decision record: `docs/adr/0020-native-e2e-build-seeds-through-the-apps-own-storage.md`.
- The seed is built by the shared scenario module and has the shape `{ characters, folders, settings, integrated }`. The app deletes it after import.
- The deep link scheme is `dnd5e2014characterbuilder://`.
- Out of scope: tapping steps, swipes, failure and isolation behavior (tickets 07 and 08).

## Blocked by

02, 03, 05
