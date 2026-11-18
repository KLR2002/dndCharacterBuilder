# 02: Remove expo-updates and the unused native modules

**What to build:** Remove the dependencies that are linked into every APK but never used: `@expo/ui` (pulls Jetpack Compose, 8.4 MB of dex), `expo-updates` (BouncyCastle and Room, 4.5 MB of dex), `expo-glass-effect`, `expo-symbols`, `expo-web-browser`, `expo-device`. Use `npm uninstall`, so `package-lock.json` follows. Keep `expo-linking`, `expo-constants` and `expo-system-ui`.

Then remove what referenced them:

- `app.json`: the `expo-web-browser` plugin entry, `runtimeVersion` and `updates`.
- `plugins/lib/e2e-build-transforms.mjs` and `plugins/e2e-build.mjs`: the Updates meta-data placeholder (`withUpdatesEnabledPlaceholder`, `resolveUpdatesEnabledPlaceholder`, `updatesEnabledValue`, the `manifestPlaceholders` line). `withUpdatesEnabledPlaceholder` throws when the manifest has no Updates meta-data, so without this the prebuild fails. Keep the debuggable `-Pe2e` release, the bundle-input block and the `dependenciesInfo` opt-out. `-Pfdroid` then changes nothing; leave the property name exported so an old recipe that passes it still builds. Update the header comment of the transforms file to describe what remains.
- The unit tests of those transforms in `checks/` (find them with `grep -rln e2e-build-transforms checks`): drop the Updates cases, keep the rest.
- Docs: `docs/fdroid/README.md` ("Build flags"), `docs/adr/0020-native-e2e-build-seeds-through-the-apps-own-storage.md` (the "no OTA updates" difference), `docs/agents/driving-the-android-emulator.md` if it mentions Updates. Describe the current state; no history notes.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** 1755bda. Transform tests red then green; prebuild succeeds; check:all passed. The manifest still has four `expo.modules.updates` meta-data lines: Expo's core prebuild (`withUpdates` in @expo/config-plugins) writes them for every app, and nothing reads them without the package.

- [x] `grep -rn "expo-updates\|expo-web-browser\|@expo/ui\|expo-glass-effect\|expo-symbols\|expo-device" package.json app.json src plugins checks docs/fdroid` lists nothing.
- [ ] `CI=1 EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android --no-install --clean` succeeds in the worktree; `grep -c "expo.modules.updates" android/app/src/main/AndroidManifest.xml` prints 0, and `android/app/build.gradle` still carries `debuggable findProperty('e2e') != null` and `dependenciesInfo`. Paste the three outputs. `android/` is not tracked; do not commit it.
- [x] `npm run check:all` passes.
