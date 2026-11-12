# 01: F-Droid build flag and dependency-info opt-out in the build plugin

**What to build:** Extend the pure transforms in `plugins/lib/e2e-build-transforms.mjs` (applied by `plugins/e2e-build.mjs` at prebuild time) with two settings. (1) A second Gradle property, `fdroid` (passed as `-Pfdroid`), that turns Expo Updates off exactly like `-Pe2e` does, but does not make the release build debuggable. The manifest placeholder line in `defaultConfig` becomes: updates off when either property is present, on otherwise. Presence is the test, as for `e2e` (`findProperty('fdroid') != null`). (2) A `dependenciesInfo { includeInApk = false; includeInBundle = false }` block inside the top-level `android { }` block of `app/build.gradle`, for every build (no flag). It must be idempotent on re-prebuild (keyed on `dependenciesInfo` already present in the `android` block), and it must throw if the `android` block is missing.

**Blocked by:** None (can start immediately)

**Status:** done
**Landed:** a80a8f8, check:all green; arm64 release build with -Pfdroid and no local-maven-repo AARs: updates ENABLED=false, no dependency-info signing block

- [x] `updatesEnabledValue` and `resolveUpdatesEnabledPlaceholder` take the fdroid flag as an extra trailing argument defaulting to `false`; existing callers keep working. Updates are off when e2e or fdroid is set.
- [x] `releaseDebuggable` is unchanged: only e2e makes the release build debuggable.
- [x] Export `FDROID_PROPERTY = "fdroid"` and update `plugins/lib/e2e-build-transforms.d.mts` to match.
- [x] The generated `app/build.gradle` contains the `dependenciesInfo` block inside `android { }` exactly once, also after applying `withE2eBuildSettings` twice.
- [x] Tests in `checks/e2eBuildPlugin.test.ts` cover: the placeholder expression resolving to `false` for fdroid only, e2e only, both, and to `true` for neither; `dependenciesInfo` inserted once and idempotent; throw when there is no `android` block.
- [x] Update the header comment of `plugins/lib/e2e-build-transforms.mjs` so it describes both flags and the dependency-info block. Keep it short.
- [x] `npm run check:all` passes.
