# 01: E2E build through a config plugin (spike)

**Status:** ready-for-agent

## What to build

A Gradle build run with `-Pe2e` produces an Android APK that is debuggable and has Expo Updates turned off. A build run without `-Pe2e` is the same as today's release build. One tracked config plugin wires both settings to the Gradle property, so one `expo prebuild` serves both builds, and `EXPO_PUBLIC_E2E=1` is what the JavaScript bundle reads in the E2E build. The ticket first answers whether a Gradle property can drive the Expo Updates setting at all, and records the answer.

## Owns

- AC-1: The E2E build is debuggable with updates off, only when asked

## Acceptance Criteria

- [ ] AC-1: With the plugin applied, the generated Android project builds a debuggable APK with Expo Updates disabled when Gradle runs with `-Pe2e`, and the same project without `-Pe2e` differs from today's release build in neither setting.
- [ ] The result of the spike (can a Gradle property set the Updates flag, and how) is appended under `## Comments` at the bottom of this ticket. If it cannot, stop and report instead of choosing another approach.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-1 | Config plugin function on fixture manifest and Gradle input | Red-green unit test in `checks/`: the `-Pe2e` output is debuggable with Updates off, and the output for a build without the property equals the unchanged input. Mutation check: delete each line that sets one of the two settings and see a test fail. |
| AC-1 | A built APK | Evidence produced by the integrator after merge (needs a 5 to 6 minute Gradle build and the running emulator): `adb shell run-as <app id> ls files` succeeds on the `-Pe2e` APK and fails on the normal one. |

## Constraints

- Spec: `.scratch/native-screenshot-runner/spec.md`. Decision record: `docs/adr/0020-native-e2e-build-seeds-through-the-apps-own-storage.md`.
- `android/` is gitignored. Everything native comes from tracked config (a config plugin, `app.config.js`, `app.json`).
- The E2E build keeps the app id `com.anonymous.dnd5e2014CharacterBuilder`.
- Do not run the Gradle APK build. Prebuild and the unit test are enough for this ticket.

## Blocked by

None

## Comments

**Spike result: yes, a Gradle property can drive the Expo Updates flag.** Established from source and confirmed by a prebuild in this worktree:

- expo-updates' config plugin writes the flag as manifest meta-data (`addMetaDataItemToMainApplication` in `node_modules/@expo/config-plugins/build/android/Updates.js`, value from `getUpdatesEnabled`), and at runtime `UpdatesConfiguration.getIsEnabled` reads exactly that meta-data from the merged manifest (`context.getMetadataValue("expo.modules.updates.ENABLED")` in `expo-updates/android/src/main/java/expo/modules/updates/UpdatesConfiguration.kt`). Whatever the merged manifest carries at build time is what the app reads.
- The bridge is an Android manifest placeholder: AGP substitutes `manifestPlaceholders` from `app/build.gradle` `defaultConfig` into `${...}` references anywhere in the manifest, meta-data values included. The tracked plugin (`plugins/e2e-build.mjs`) points the flag at `${expoUpdatesEnabled}` and defines the placeholder as `findProperty('e2e') != null ? 'false' : 'true'`; the release `debuggable` line reads the same property.
- `npx expo prebuild --platform android --no-install --clean` with the plugin registered in `app.json` generated `android/app/src/main/AndroidManifest.xml` with `android:value="${expoUpdatesEnabled}"` and `android/app/build.gradle` with both Gradle lines, so a `-Pe2e` build resolves the flag to `false` (updates off, debuggable) and a build without the property to `true` (updates on, not debuggable). The plugin runs in the android `finalized` mod so it lands after expo-updates' manifest mod, which would otherwise overwrite the value; re-prebuild without `--clean` is idempotent.
