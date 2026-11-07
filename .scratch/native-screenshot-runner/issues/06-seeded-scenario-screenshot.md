# 06: Seeded scenario screenshot

**Status:** done
**Landed:** 3da5226. `checks/androidRunner.test.ts` and `checks/uiautomator.test.ts` 46/46, red-green and three mutation checks by the implementer (the `run-as` copy, the ready wait, the screenshot pull). The parser is tested on a real Settings dump captured from the emulator. Main session on the merged tree: `npm run check:all` exit 0 (1818 app tests, 305 scraper tests). Real run against the running emulator with `--no-build`, `ONLY=Settings,Home WIDTHS=360,412`: four PNGs written (720 x 1280, valid PNG signature, sizes differ per width), exit 0; the Home screenshot shows the seeded characters (Rendar, Mossa, Elowen, Seren), so the app imported the seed on launch; `run-as <app id> ls files` no longer lists the seed; `wm density` shows no override afterwards; the emulator is still online. The seed copy goes through `adb push` to `/data/local/tmp` and `run-as cp`, which works on API 36 because pushed files are world-readable. Open: the 10 s ready timeout is sized for the SRD seed and may be tight for the multi-MB integrated catalog, which has not run natively yet.

## What to build

One scenario of the shared list runs end to end on the emulator: the runner copies the seed into the app's private folder with `run-as`, launches the scenario's route by deep link, waits for its `ready` text by polling `uiautomator dump`, and writes `<scenario>-<width>.png` into the run's screenshot folder.

## Owns

- AC-12: A seeded scenario produces a screenshot

## Acceptance Criteria

- [x] AC-12: For a scenario at one width, the runner copies the seed in with `run-as`, launches the route by deep link, waits for `ready` in the dump, and writes `<scenario>-<width>.png` into `SHOTS`, or into a new folder outside the repo when `SHOTS` is unset.

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
