# Driving the app on the Android emulator

`npm run layout:android` runs the layout scenarios of `layout:check` (the shared list in `scripts/lib/scenarios.mjs`) on an Android emulator and saves one screenshot per scenario and width, named like the web ones (`<Scenario-name>-<width>.png`), so web and native shots of a scenario pair up. Run it for native-only changes (inputs, `Platform.OS` branches, Android-only styles, text clipping) and when a review asks for native evidence. It produces evidence for a reviewer and measures nothing: `expect` is not evaluated, and a run fails only when a scenario cannot reach its screen. The extra checks of `layout:check` (the HP modals and Wild Shape checks, `EXTRA_CHECKS` in `scripts/layout-check.mjs`) have no native form: they are not in the native scenario list and `ONLY=HP` exits 2. Layout rules are in `CODING_STANDARDS.md` section 7; driving the web build is in `docs/agents/driving-the-app.md`.

The runner's flags, environment variables and exit codes are documented in the header of `scripts/layout-android.mjs`; read them there. The two variables you set most are `ONLY` (comma-separated substrings of scenario names; a term that matches nothing exits 2 and lists the names) and `WIDTHS` (default 393,360,320,412 dp). A full SRD list at one width takes about 19 minutes and all four widths about 75, so scope the run with `ONLY`.

## Prerequisites

- The Android SDK at `~/Android/Sdk` (`ANDROID_HOME` overrides it); `adb` and `emulator` are not on `PATH`, the runner finds them itself.
- The AVD `Small_Phone`.
- A generated `android/` project (gitignored): `npx expo prebuild --platform android --no-install`, run once. The tracked config plugin `plugins/e2e-build.mjs` wires the E2E build into it. The first build takes about 6 minutes, later ones are incremental; `--no-build` installs the APK already built.

## What the runner does

- Boots `Small_Phone` headless and stops it at the end only when it started it; a running emulator is reused and never stopped. It refuses any device whose serial is not `emulator-*`, because a run clears app data and changes screen density.
- Sets each width through `wm density` and restores the original density at the end, also after a failure.
- Builds the E2E APK with Gradle `-Pe2e` and installs it. The screenshotted APK is not the shipped one: it is debuggable, has Expo Updates off, and only it (`EXPO_PUBLIC_E2E=1`, set by the runner) reads a seed file `dnd5e_e2e_seed.json` from the app's private files folder on launch and deletes it. The seed is `buildSeed()` from the shared scenario module, the same shape as the web seed. Installing the E2E build replaces a normal install on the emulator (ADR 0020).
- Plays each scenario's tabs, open steps, modal title wait and scrolls from `uiautomator dump`s; a dump takes about 2 s and dominates the run time. Scenarios the native player cannot play (a step with no text, pattern or label to tap, today the New Character modal) are skipped and listed as web-only.
- A failed scenario saves `<name>-<width>-FAILED.png` of the stuck screen, the run continues and exits non-zero. A lost emulator is rebooted (up to twice per run) when the runner started it; on a reused one the run stops at that scenario with a message.
- Per-scenario isolation mirrors the web check: the first scenario of a width and every `fresh` one clear the app and re-seed, a `modal` one relaunches it, others jump by deep link or stay on the route; each scenario logs its mode.

## Gotchas

- Emulator renderer: boot with `-gpu angle_indirect -no-window`. The default software renderer segfaults on a cold boot, and `-gpu host` loses its GL context and kills the emulator after a few minutes; the runner uses `angle_indirect` itself.
- A shell with `LD_LIBRARY_PATH` set can break the emulator's Vulkan loader. The runner strips it for the emulator it starts; strip it yourself (`env -u LD_LIBRARY_PATH`) when you start one by hand.
- Ctrl-C or SIGTERM ends a run between adb calls, usually within a few seconds, and cleans up (density restored, an emulator the run started stopped). A long adb call (install, up to 180 s) or the Gradle build holds the signal until it returns; Ctrl-C during the build ends Gradle too and the run exits 1 after cleaning up.
- Metro's transform cache is not keyed on `EXPO_PUBLIC_E2E`, so the runner builds with a separate cache per flag value. When you bundle by hand, clear the Metro cache when you switch the flag. Gradle's bundle step likewise has no input for the flag unless the plugin's wiring (`E2E_BUNDLE_INPUTS_MARKER` in `plugins/lib/e2e-build-transforms.mjs`) is in `app/build.gradle`, so a project generated before that wiring needs `npx expo prebuild --platform android --no-install` again.
- A swipe that starts within about 60 px of a side edge triggers Android's back gesture, and within about 80 px of the bottom the home gesture; the runner keeps its swipes 96 px clear of every edge.
- `uiautomator dump` lists nodes scrolled out of the viewport with inverted bounds (top below bottom): they are not on screen. Never run two dumps at the same time; they can crash the service.
- Screenshots are binary: take them on the device (`screencap -p <file>`) and `adb pull` them. Piping `adb exec-out screencap -p` through a text decoder corrupts the PNG.

## Manual steps for ad-hoc work

- Export the SDK tools: `export ANDROID_HOME=~/Android/Sdk ANDROID_SDK_ROOT=~/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH`.
- Start the emulator detached: `nohup env -u LD_LIBRARY_PATH emulator -avd Small_Phone -no-snapshot-save -no-audio -gpu angle_indirect -no-window > <log> 2>&1 &`. It is ready when `adb shell getprop sys.boot_completed` prints `1`; stop what you started with `adb emu kill`.
- Install and launch: `adb install -r <apk>`, then `adb shell monkey -p com.anonymous.dnd5e2014CharacterBuilder -c android.intent.category.LAUNCHER 1`.
- `adb shell pm clear com.anonymous.dnd5e2014CharacterBuilder` resets the app to first run.
- `adb shell run-as com.anonymous.dnd5e2014CharacterBuilder ls files` lists the app's private folder; it works only on the E2E (debuggable) APK.
- The `androidMCP` server, project-scoped in `~/.claude.json` (`uv --directory /home/krzysztof/mcp/Android-MCP run android-mcp-beta`), drives the UI by hand. Its first start can pass Claude Code's 30 s connect limit: run the command once in a terminal, then reconnect with `/mcp`.
