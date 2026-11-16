# 04: `npm run android:roll` checks a Roll on the emulator

**What to build:** Checking that the native dice work (labels equal to the chips, no crash) took about 130 hand-written adb calls with hard-coded screen coordinates. `npm run layout:android` only takes screenshots and evaluates no assertion. Add `scripts/android-roll.mjs` (npm script `android:roll`), with its pure helpers in `scripts/lib/android-roll.mjs`:

`npm run android:roll -- [--mode throw|tumble|off] [--shots <dir>] [--record] <expression>...`

- **Device.** Needs exactly one running emulator (serial `emulator-*`, use `parseAdbDevices` and `isEmulatorSerial` from `scripts/lib/android-runner.mjs`) with the app `io.github.klr2002.cb5e` installed, release or E2E build. The script boots, builds and installs nothing. `adb` comes from `sdkPaths` in the same file. No emulator, two devices, or no app installed: exit 2 with a message.
- **Mode.** `--mode` opens the Options screen by deep link (`deepLinkForRoute("/options")`), swipes until the node with resource-id `dice-animation-<mode>` is visible (swipes 96 px clear of every edge, as `scripts/lib/native-steps.mjs` does), taps it, and returns home by deep link. Without `--mode` the current setting is kept.
- **Each expression.** Clear logcat; tap the node with resource-id `dice-button`; tap the field whose content-desc is `Roll Expression`; type the expression with `adb shell input text`, escaping the characters the device shell treats specially (`(` and `)` failed unescaped; a pure helper does this); close the keyboard; tap the button whose content-desc starts with `Roll ` (not the field). Then poll `uiautomator dump` until the node `result-card` exists and the die labels stop changing between two dumps, with a timeout of about 40 s. Find every node through `scripts/lib/uiautomator.mjs`, never by fixed coordinates.
- **Assertion.** The die labels are the nodes with resource-id `throw-die-<n>` (Throw) or `die-solid-<n>` (Tumble); their content-desc reads `d20 showing 14`, `d20 showing 3, dropped`, `d100 showing 40` (`src/components/dice/dieLabel.ts`). The chips are the `die-chip` nodes inside `result-card`; their text (in a child node) reads like `14d20`, with a leading minus for a subtracted die. Labels are capped (20 Throw, 10 Tumble), chips are not: label n is compared with chip n. With `--mode off` there are no labels and that is a pass. `adb logcat -d` is searched for `FATAL EXCEPTION`.
- **Evidence.** One screenshot per expression after it settles (`screencap -p` on the device, then `adb pull`, never through a pipe) into `--shots` (default a fresh folder under the system temp dir, printed). `--record` also records the Roll with `screenrecord` (about 12 s) and pulls the mp4.
- **Output.** One line per expression, for example `20d20 [throw]: 20 labels = 20 chips, FATAL 0, shot /tmp/…/1-20d20.png`, and on a mismatch the label and chip that differ. Exit 0 when every expression passes, 1 when any label differs from its chip, a FATAL appears or the wait times out, 2 on a refusal or bad argument. `--help` prints the usage.

**Blocked by:** 03 (both run Gradle; one heavy Android job at a time on this machine)

**Status:** done

**Landed:** chore/retro-canvas-dice @ 064ee58 (head 20e01fa). On the emulator with a release build: `--mode throw d20 20d20 'a(d20)+d100+d6+d4+d8+d10+d12'` gave 1/20/8 labels equal to the chips, FATAL 0, exit 0; `--mode tumble 10d20,d6` gave 10 labels against the first 10 of 11 chips, exit 0. 29 unit tests in `checks/androidRoll.test.ts` on full emulator dumps (not trimmed). Not covered: the settle loop (no unit test), a first-run app (the doc says to open the app once by hand). The emulator needs `-memory 3072` for this check (documented); the Roll button's content-desc starts with an icon glyph before `Roll`.

- [x] Unit tests in `checks/androidRoll.test.ts` cover the pure helpers: the `input text` escaping, the label/chip comparison (match, a face mismatch, a dropped die, the cap with more chips than labels, a subtracted chip, no labels in Off), and the settle rule, using dump XML recorded from the real emulator (stored under `checks/fixtures/`, trimmed). Red first.
- [x] On the emulator with a release build (`CI=1 EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android --no-install`, then in `android/` `./gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64`, then `adb install -r android/app/build/outputs/apk/release/app-release.apk`): `npm run android:roll -- --mode throw d20 20d20 'a(d20)+d100+d6+d4+d8+d10+d12'` and `npm run android:roll -- --mode tumble 10d20,d6` both exit 0; the report pastes their output and opens at least two of the screenshots.
- [x] `docs/agents/driving-the-android-emulator.md` gains a short section on `npm run android:roll` (what it needs, what it checks, its exit codes) next to the runner's description, and `.scratch/canvas-dice/spec.md` is not changed.
- [x] Everything started is stopped at the end: emulator, adb server, Gradle daemon (`scripts/stop-dev.sh` if ticket 02 has landed on the integration branch).

## Constraints

- Follow `docs/agents/subagent-tiering.md`, section "Implementer Rules". The release build and the emulator boot take minutes: start them with `run_in_background: true` and wait with `t3_background_wait` in the same turn. Boot the emulator as `docs/agents/driving-the-android-emulator.md` describes (`env -u LD_LIBRARY_PATH`, `-gpu angle_indirect -no-window`).
- Reuse `scripts/lib/android-runner.mjs`, `scripts/lib/uiautomator.mjs` and `scripts/lib/native-steps.mjs`; do not change the behaviour of `npm run layout:android`.
- Do not commit the generated `android/` project, APKs, screenshots or videos.
