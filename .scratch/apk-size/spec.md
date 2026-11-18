# Spec: Smaller APK

**Status:** in progress

The 2.2 APKs are 52 MB (arm64-v8a), 45 MB (armeabi-v7a), 53 MB (x86, x86_64) and 113 MB (universal). Measured with `apkanalyzer` on `CB5E-2.2-arm64-v8a.apk`:

| Part | In the APK | Cause |
| --- | --- | --- |
| Dex (5 files, 26.4 MB of code) | 18.0 MB compressed | R8 is off (`android.enableMinifyInReleaseBuilds` unset) |
| of which Jetpack Compose + `expo.modules.ui` | 8.4 MB of dex | `@expo/ui`, not imported anywhere |
| of which BouncyCastle + Room + `expo.modules.updates` | 4.5 MB of dex, plus 1.1 MB of BouncyCastle data files | `expo-updates`; F-Droid builds already turn it off, nobody publishes OTA updates |
| Native libraries | 20 MB stored uncompressed | `expo.useLegacyPackaging=false` |
| Fonts | 21 files, 2.6 MB | `import { Ionicons } from "@expo/vector-icons"` pulls all 19 icon fonts; only Ionicons is used |
| JS bundle | 5.8 MB | SRD data and app code; not in scope |

Decisions (user, 2026-11-18):

- Remove `expo-updates` entirely. F-Droid and GitHub APKs are the only release channels.
- Compress the native libraries (legacy packaging): smaller download, larger installed size.

Unused modules also removed: `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-web-browser`, `expo-device`. `expo-linking`, `expo-constants` (expo-router) and `expo-system-ui` (`userInterfaceStyle` on Android) stay.

Expected result for arm64-v8a: roughly 15-20 MB.

## Tickets

1. `01-ionicons-only.md`: import only the Ionicons font.
2. `02-remove-unused-modules.md`: remove `expo-updates` and the unused modules.
3. `03-release-build-size-settings.md`: R8, resource shrinking and compressed native libraries, verified on the emulator.
