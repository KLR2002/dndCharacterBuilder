# 0020 The Native E2E Build Seeds Through the App's Own Storage

## Context
Screenshots of native-only UI need a known state on the Android emulator: characters, folders, settings and sometimes the Integrated Catalog. On native, characters, folders and settings live in AsyncStorage and the catalog in a file in the app's private folder. A release APK is not debuggable, so nothing outside the app can write either. The app has no import feature. The release build also checks Expo Updates on launch, so it can run the published bundle in place of the tree under test.

## Decision
- A separate E2E build of the Android app is used for screenshot runs. It is debuggable, has Expo Updates turned off, and keeps the normal app id, so the link scheme opens it without a chooser. A tracked config plugin wires both native settings to a Gradle property, so one `expo prebuild` serves the normal build and the E2E build.
- Only in the E2E build (`EXPO_PUBLIC_E2E=1`), the app reads a seed file on launch, imports it through the same `storage.ts` and `compendiumStorage.ts` writers the app uses, and deletes it. The runner copies the file into the app's private folder with `run-as`. A guard test checks that the hook runs only behind the flag.
- The seed has the shape the web seed already has (`{ characters, folders, settings, integrated }`), built by the scenario module both runners share.
- The runner refuses any device that is not an emulator, because it clears the app's data.

## Considered Options
- Writing rows into AsyncStorage's SQLite table with `run-as`: rejected, it ties the runner to the library's internals and skips the app's own write path.
- A user-facing backup import and export feature: rejected for this purpose, it is product scope and would still leave the runner tapping through the UI to use it.
- Building each character by tapping through the UI: rejected, slow and fragile across about 50 scenarios at four widths.
- Cutting the emulator's network instead of turning Expo Updates off: rejected, it hides the problem in the environment rather than the build under test.

## Consequences
The APK that is screenshotted is not the APK users get: it differs by the debuggable flag, the seed hook and having no OTA updates. Installing the E2E build on the emulator replaces any normal install there.
