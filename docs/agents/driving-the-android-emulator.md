# Driving the app on the Android emulator

How to start the emulator, build and install the app, and take a screenshot. Use it for native-only evidence the web check cannot give (`CODING_STANDARDS.md` section 7, such as Android text clipping). Browser work is in `docs/agents/driving-the-app.md`.

## Environment

- The Android SDK is at `~/Android/Sdk`. `ANDROID_HOME` is unset and `adb` and `emulator` are not on `PATH`, so export both before any command:
  `export ANDROID_HOME=~/Android/Sdk ANDROID_SDK_ROOT=~/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH`
- The AVD is `Small_Phone`: API 36 x86_64, 720 by 1280 at 320 dpi, hardware-accelerated through `/dev/kvm`. `emulator -list-avds` lists what exists.
- The app id is `com.anonymous.dnd5e2014CharacterBuilder`.

## Start the emulator

- Detach it: `nohup emulator -avd Small_Phone -no-snapshot-save -no-audio > <log> 2>&1 &`. It opens a window and keeps running until you stop it.
- `adb devices` lists `emulator-5554` as `offline` while it boots. It is ready when `adb shell getprop sys.boot_completed` prints `1`.
- Stop what you started: `adb emu kill`.

## Build and install

- Build a release APK, not a debug one. Release bundles the JavaScript, so no Metro server or `adb reverse` is needed. A debug APK loads its JavaScript from Metro at runtime.
- From `android/` (gitignored, so nothing reaches the repo): `./gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64 --console=plain`. The emulator is x86_64, and one architecture keeps the native compile short.
- A cold build took 5m 38s, almost all of it native C++ compile. Gradle's cache shortens later builds. Run it in the background and wait on it.
- Release is signed with the debug keystore (`android/app/build.gradle`), so it installs without extra setup.
- The APK lands in `android/app/build/outputs/apk/release/app-release.apk`.
- Install and launch: `adb install -r <apk>`, then `adb shell monkey -p com.anonymous.dnd5e2014CharacterBuilder -c android.intent.category.LAUNCHER 1`. Allow about five seconds for the first render.

## Take a screenshot

- For a script or a file you keep: `adb exec-out screencap -p > <folder>/<name>.png`. It writes a 720 by 1280 PNG where you point it.
- The `androidMCP` server's `Snapshot` tool returns the screenshot and the tappable elements together. Use `use_vision=true` for the image and `use_annotation=false` for a clean one. It saves its images under `~/.claude/projects/`, so copy one out of there to keep it.
- Give each run its own screenshot folder.

## Drive the UI

- `androidMCP` taps by selector (`ClickBySelector` with `text`, `resourceId` or `description`) or by coordinates (`Click`). Prefer the selector. After a tap, `Snapshot` again to confirm it did something: the tap result warns when nothing at that point is marked tappable, even when it worked.
- The app starts on a first-run welcome modal. Its button is "Start Building Characters", and tapping it saves the first-run flag in the app's data.
- `adb shell pm clear com.anonymous.dnd5e2014CharacterBuilder` resets the app to first run.
- There is no seed step yet. The web driver writes characters and the catalog into `localStorage` and IndexedDB, and the native app keeps them in `AsyncStorage` where no script has written them. Until one exists, build state by tapping through the UI.

## `androidMCP` setup

- It is configured per project in `~/.claude.json` (the entry under this project's path), not at user scope: `uv --directory /home/krzysztof/mcp/Android-MCP run android-mcp-beta`.
- Its first start installs dependencies and can pass Claude Code's 30 second connect limit, which reports `CONNECT_TIMEOUT`. Run the command once in a terminal so the environment is cached, then reconnect with `/mcp` or start a new session.
- It reports `No devices found` until the emulator is up and `adb devices` lists it.
