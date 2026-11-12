# Spec: F-Droid release 2.1.1

**Status:** in progress

Prepare the repo for inclusion in F-Droid (https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide) and release it as 2.1.1.

- App id `io.github.klr2002.cb5e`, license GPL-3.0-or-later, version `2.1.1`, versionCode `20101` (major·10000 + minor·100 + patch) in `app.json`. F-Droid builds one APK per ABI with versionCode `10·base + n` (n = 1 armeabi-v7a, 2 arm64-v8a, 3 x86, 4 x86_64).
- F-Droid builds from source: `npm ci`, `npx expo prebuild`, Gradle. Expo modules build from source (`expo.autolinking.android.buildFromSource` in `package.json`), so the prebuilt AARs in `node_modules/*/local-maven-repo` can be deleted before the build.
- F-Droid forbids downloading code outside its own updates, so the F-Droid build (`-Pfdroid`) turns Expo Updates off. Every release build leaves out Google's dependency metadata blob (`dependenciesInfo`), which the F-Droid scanner rejects.
- Store listing: `fastlane/metadata/android/en-US/` (title, short and full description, icon, phone screenshots, changelogs named by versionCode).
- Draft fdroiddata recipe: `docs/fdroid/io.github.klr2002.cb5e.yml`.
