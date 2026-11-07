# 05: Runner core

**Status:** ready-for-agent

## What to build

`npm run layout:android` exists and runs the device side of a run: it refuses anything that is not an emulator, reuses a running emulator or boots `Small_Phone` headless (windowed with `--window`) and stops only one it started, builds the E2E APK incrementally (or skips the build with `--no-build`) and installs it, sets each of the four widths through the screen density and restores the original density at the end, and rejects an `ONLY` term that matches no scenario.

## Owns

- AC-8: The runner refuses anything that is not an emulator
- AC-9: Widths map to densities and are always restored
- AC-10: The emulator is reused or started and stopped by the runner
- AC-11: The runner builds the E2E APK incrementally
- AC-16: A term that matches nothing is an error

## Acceptance Criteria

- [ ] AC-8: A device whose serial does not start with `emulator-` makes the runner exit non-zero before it clears, installs or launches anything.
- [ ] AC-9: Widths 320, 360, 393 and 412 use density 360, 320, 293 and 280, and the original density is restored at the end of the run, also after a failure.
- [ ] AC-10: A running emulator is reused and never stopped. With none running, the runner boots `Small_Phone` headless, waits until `sys.boot_completed` is `1`, and stops that emulator when the run ends.
- [ ] AC-11: Without `--no-build` the runner calls the incremental Gradle release build with `-Pe2e` and installs with `adb install -r`, and the JavaScript bundle in that APK carries the live seed hook whichever flag value the previous build used (Metro's cache is not keyed on `EXPO_PUBLIC_E2E`, so the bundle step must not reuse a cache transformed under another value); with `--no-build` it skips Gradle and installs the APK already built.
- [ ] AC-16: An `ONLY` term that no scenario name contains exits with 2 and lists the scenario names of the run.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-8, AC-9, AC-16 | Pure functions of the runner | Red-green tests in `checks/`. Mutation check: delete the serial check, and the density restore, and see a test fail each time. |
| AC-10, AC-11 | Runner lifecycle and build step | Red-green tests against a fake `adb` and `emulator` that record their calls. Mutation check: delete the stop-only-if-started condition and see a test fail. One real run: boot, `--no-build` install, launch, stop. |
| AC-11 | Bundle for an E2E build, built right after a plain build | `EXPO_PUBLIC_E2E=1 npx expo export --platform android --no-bytecode --output-dir <dir>` right after the same export without the flag, using the cache handling the runner uses (no manual `--clear` by the tester): the bundle holds the hook body that imports the seed importer, `grep -o 'runE2eSeedHook=[^}]\{0,260\}'` on the bundle shows `importE2eSeed`; a plain export right after an E2E one shows `async function(){return}`. Red-green: the check fails when the runner's cache handling is removed. |

## Constraints

- Spec: `.scratch/native-screenshot-runner/spec.md`. Decision record: `docs/adr/0020-native-e2e-build-seeds-through-the-apps-own-storage.md`.
- A plain `scripts/` program, no `androidMCP`. The Android SDK is at `~/Android/Sdk` and neither `adb` nor `emulator` is on `PATH`; see `docs/agents/driving-the-android-emulator.md`.
- The same `ONLY`, `WIDTHS` and `SHOTS` variables and `--integrated` flag as `layout:check`; `--integrated` is accepted but its first native run is out of scope.
- Out of scope: seeding, scenarios, screenshots (tickets 06 to 08).

## Blocked by

01
