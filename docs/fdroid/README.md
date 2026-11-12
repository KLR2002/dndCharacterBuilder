# F-Droid

How the app is prepared for [F-Droid](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide).

## What lives in this repo

- Store listing: `fastlane/metadata/android/en-US/` (title, short and full description, icon, phone screenshots, changelogs).
- Version: `expo.version` and `expo.android.versionCode` in `app.json`. EAS reads them from there (`appVersionSource: local` in `eas.json`).
- Build flags: `-Pfdroid` turns Expo Updates off. F-Droid does not allow an app to download code outside F-Droid. Every release build leaves out Google's dependency metadata blob (`dependenciesInfo`). Both come from `plugins/lib/e2e-build-transforms.mjs`.
- Expo modules build from source (`expo.autolinking.android.buildFromSource` in `package.json`), so the build does not need the prebuilt AARs in `node_modules/*/local-maven-repo`.
- Draft build recipe for fdroiddata: `docs/fdroid/io.github.klr2002.cb5e.yml`.

## Version codes

`versionCode` = major·10000 + minor·100 + patch (2.1.1 → `20101`). F-Droid builds one APK per ABI with versionCode `10 · versionCode + n`. In that formula, n = 1 for armeabi-v7a, 2 for arm64-v8a, 3 for x86 and 4 for x86_64. A changelog file must match the versionCode exactly, so each release needs four files: `changelogs/201011.txt` … `201014.txt` for 2.1.1. Each file holds at most 500 characters.

## Releasing a new version

1. Set `version` and `android.versionCode` in `app.json`, and `version` in `package.json` and `package-lock.json`.
2. Add the four changelog files.
3. Commit, then tag the commit `vX.Y.Z` and push the tag. F-Droid finds new versions by the tag (`UpdateCheckMode: Tags`) and reads the version from `app.json`.

## Submitting (first time only)

1. Fork https://gitlab.com/fdroid/fdroiddata and create a branch named `io.github.klr2002.cb5e`.
2. Copy `docs/fdroid/io.github.klr2002.cb5e.yml` to `metadata/io.github.klr2002.cb5e.yml`. Replace `commit: v2.1.1` with the full commit hash of the tag (`git rev-parse v2.1.1^{commit}`).
3. Run `fdroid lint io.github.klr2002.cb5e`, `fdroid rewritemeta io.github.klr2002.cb5e` and `fdroid build io.github.klr2002.cb5e`. The build needs the fdroidserver Docker image or the CI pipeline of your fork.
4. Commit with the message `New App: io.github.klr2002.cb5e` and open a merge request against fdroiddata.

## Not yet verified

The recipe has not been run through `fdroid build`. These are the risky parts:

- `hermesc`: `node_modules/hermes-compiler` ships a prebuilt Hermes compiler, which the F-Droid scanner removes. The recipe builds `hermesc` from the `hermes` srclib at the tag that matches `hermes-compiler`'s version (`hermes-v250829098.0.17`). Update that tag whenever React Native is upgraded.
- The scanner may flag more binaries in `node_modules`. `scandelete: node_modules` removes them. If the build then fails, reviewers usually help to find the binary that is still needed.
- The optional catalog sync downloads game data that is not freely licensed from a third-party GitHub repository. Reviewers may ask for an anti-feature, such as `NonFreeNet`.
