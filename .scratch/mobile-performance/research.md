# Tap-to-update latency on Android (Expo SDK 57, RN 0.86, New Architecture)

Researched 2026-11-11. Sources were read through search excerpts and mirrors, not full fetches, unless noted. Where a claim rests on memory or an unreached page, it is marked **[unsourced]**. Verify version-specific details before acting.

Repo facts checked (`package.json`, `app.json`, `src/`):
- `expo ~57.0.32`, `react-native 0.86.3`, `react 19.2.3`, `react-native-reanimated 4.5.1`, `@react-native-async-storage/async-storage 2.2.0`. No MMKV, no FlashList, no Zustand/Jotai/Legend State in `package.json`.
- `app.json` `experiments.reactCompiler: true`.
- `src/services/storage.ts`: one AsyncStorage key per collection (`@dnd5e_characters`, `@dnd5e_folders`, `@dnd5e_settings`), a process-wide write queue (`enqueue`), and reads/parses the whole value before writing.
- `src/context/CharacterContext.tsx`: `usePersistedCollection` runs a `useEffect` on every `snapshot` change that calls `save(snapshot.items)` for the whole collection (around lines 80-100).
- `src/rules/characterEvaluation.ts`: `evaluateCharacter` is exported at line 96. It has 12 call sites under `src/**/*.tsx`.
- 37 files under `src/` reference `TouchableOpacity`. 0 files reference `FlatList` or `FlashList`, so lists are ScrollView+map as stated.

---

## Ranked summary (highest expected payoff for this app first)

1. **Measure a release build first, with a fixed tap script.** Every number below is meaningless without it; dev mode is much slower and distorts the ranking. (Section 1.)
2. **Take the whole-collection save off the tap path.** Every change re-serializes all characters, and the context effect runs it right after each commit. Coalesce writes and move to per-record keys so a tap writes one character (Section 3). This is likely the largest JS-thread cost per tap.
3. **Stop re-running `evaluateCharacter()` for characters that did not change.** Key a memo on the character object's identity and keep identity stable across updates (structural sharing for untouched records). The React Compiler does not do this across components or for values it cannot prove stable (Section 2).
4. **Split the context so a tap re-renders only the subscribers of the changed data.** Use an external store with selectors (`useSyncExternalStore`, Zustand with `useShallow`, or Legend State) or split context by slice (Section 2).
5. **Wrap only the genuinely expensive derived computation, not whole screens.** The Compiler already memoizes components and hooks; `React.memo` and `useMemo` are needed only where it cannot prove stability (Section 2).
6. **Use `useTransition` / `startTransition` for heavy non-urgent updates, never for the press feedback itself.** It keeps the press responsive; it does not reduce work (Section 2).
7. **Swap AsyncStorage for MMKV or expo-sqlite kv-store** if persistence still dominates after step 2. MMKV is synchronous and fast, but it is a new native dependency (Section 3).
8. **Keep lists as ScrollView+map for short lists; switch long lists to FlashList.** Not a tap-latency fix for buttons on screen; it matters for scroll and mount cost (Section 4).
9. **Replace `TouchableOpacity` with `Pressable` only as cleanup, not for speed.** The speed claim is not supported by a source I could reach (Section 4).
10. **Remove `console.log` calls from release paths and check no debug code runs on press.** Small but cheap (Section 5).

---

## 1. Measuring

### 1a. What to measure
- Tap-to-update latency has three parts: input dispatch to JS (touch handling), JS work (event handler + React render + commit), and native paint of the new frame. Only the first two are visible from JS. The RN performance overview frames the budget as about 16.67 ms per frame at 60 fps. Work that runs past it drops frames. Source: https://reactnative.dev/docs/performance (also https://reactnative.dev/docs/0.86/performance for the 0.86 copy).
- The RN docs describe three threads (JS, main/UI, native modules) and note that touch handling and JS-driven animation depend on the JS thread, while native scrolling runs on the main thread. Source: https://reactnative.dev/docs/performance.
- Time from press to paint is the metric that matters. Measure it end to end with a video or a screen-capture timestamp (see the Measurement recipe), and use JS-side marks to attribute it.

### 1b. React DevTools Profiler
- Shows which components rendered and why, with commit durations, for development builds of React. It does not run against a release build.
- Use it to answer "which components re-render on this tap", not "how long does the tap take on the device".
- Source: https://react.dev/reference/react/Profiler (not fetched; **[unsourced]** for this exact URL; the Profiler docs exist at react.dev).
- Fixes: nothing directly. It diagnoses steps 3 and 4 above.
- Does not help: release-build timing. Dev-only warnings and StrictMode double-renders inflate render counts.

### 1c. React Native DevTools performance panel
- RN DevTools is the current debugger. The official docs say the Dev Menu, LogBox and React Native DevTools are disabled in release builds. Source: https://reactnative.dev/docs/0.79/debugging (cited via search; check the 0.86 debugging page).
- I could not find an official source for the panel's workflow in RN 0.86. **[unsourced]** on the details.
- Use it in development to find JS hot spots. Do not use it for release numbers.

### 1d. Hermes sampling profiler
- The official guide covers recording a sampling profile from the Dev Menu and loading it into Chrome DevTools' Performance tab, using `hermes-profile-transformer` to convert the profile. Source: https://reactnative.dev/docs/profile-hermes (and the archive copy https://archive.reactnative.dev/docs/next/profile-hermes). The archive copy also mentions a `bundleInDebug` setting for running a bundled app; that is a debug-oriented setup, not a release build.
- Fixes: finds the JS functions that dominate a tap (for example, `evaluateCharacter`, `JSON.parse` in the storage path).
- Does not help: native-side time (rendering, paint, the Android main thread).
- Cost: moderate; the profile is large; needs a conversion step.

### 1e. Release build profiling
- For release builds, the common third-party option is `react-native-release-profiler` (Margelo). It records a Hermes profile in production or release builds through `startProfiling()`/`stopProfiling()`, and the CLI can pull the trace from Android. Source: https://github.com/margelo/react-native-release-profiler and https://www.npmjs.com/package/react-native-release-profiler. It is third-party; check its version against RN 0.86.
- Official RN docs do not give a supported release-build profile path in the pages I reached. **[unsourced]** that none exists; treat it as unverified.
- Cost: adds a dependency; use it on a branch, not in the app.

### 1f. Development build vs release build vs Expo Go
- Dev builds run unminified JS with extra checks (React dev warnings, StrictMode double-invokes effects and renders, the dev menu, LogBox). Render work and effects run more often than in production. The RN performance page says performance should be measured in release builds because dev mode is much slower. Source: https://reactnative.dev/docs/performance (the search excerpt of the newer page). Also https://reactnative.dev/docs/0.86/performance.
- Expo Go is a dev-style runtime with extra overhead and its own native module set. Do not measure latency in Expo Go.
- The size of the gap is app-specific. I did not find an official number. **[unsourced]** for any specific multiplier. Measure both to quantify it on this app.
- Why it misleads: the dev build exercises `evaluateCharacter` and effects twice, so a 3x dev-vs-release gap is plausible but must be measured here.

### 1g. Perfetto / systrace
- Android's system trace (Perfetto, with `atrace` categories) records the main thread, RenderThread and input events. Use it to see whether the press reached the app, whether the frame was delayed by JS or by the UI thread, and how long the `Choreographer` frame took.
- Official Android docs: https://developer.android.com/topic/performance/tracing (not fetched; **[unsourced]** for the exact URL). Perfetto UI: https://ui.perfetto.dev.
- Fixes: nothing directly; it attributes the latency to thread and phase.
- Cost: low to capture, moderate to read. Works on a release build.

### 1h. Flashlight / similar
- Flashlight measures app performance on device with a CLI and reports a score; it is a third-party tool. Source: https://www.flashlight.dev (not fetched; **[unsourced]** on its current API).
- Use it for repeatable, aggregated numbers across runs.
- Cost: a tool dependency and some setup.

### 1i. Marks in code
- `performance.now()` and `performance.mark()`/`measure()` are available in RN's JS runtime. Use them in press handlers and in a `useEffect` that runs after commit to bracket one tap. Source: https://reactnative.dev/docs/performance (for the general approach) and https://developer.mozilla.org/en-US/docs/Web/API/Performance/now (not fetched; **[unsourced]** for the RN runtime specifics).
- Log with `console.log` only in development; stripping `console.log` is in Section 5.
- Does not help: it does not see native paint time.

---

## 2. Render work

### 2a. What the React Compiler does and does not memoize
- The React docs say the compiler memoizes components and hooks, not every function, and the memoization is not shared across components or hooks. It is a build-time tool that replaces manual `useMemo`, `useCallback` and `React.memo` in most cases. Source: https://react.dev/learn/react-compiler and https://react.dev/learn/react-compiler/introduction.
- It memoizes only what it can prove correct. Values that change identity on every update (like a new array after `setCharacters`) still cause consumers to re-run.
- Context consumers re-render whenever the context value changes identity, whether or not the component reads the changed field. The compiler does not change that. **[unsourced]** for the exact docs URL; verify on https://react.dev/reference/react/useContext.
- Fixes: the compiler removes most hand-written memoization; it does not fix whole-array replacement.
- Does not help: `evaluateCharacter` called inside a render function with a new object each time. The compiler cannot memoize across renders when inputs are new objects.
- Cost: none beyond the build step already enabled.

### 2b. Context splitting and selectors
- The context in `src/context/CharacterContext.tsx` holds every character in one value. Any update changes the value identity, so every consumer re-renders. This is the most important structural cost.
- Fixes: split context by slice (one context per character or per collection), or move to an external store where components subscribe to a selected slice.
- `useSyncExternalStore` is the React primitive for external mutable stores. Its reference is https://react.dev/reference/react/useSyncExternalStore (the search did not return the page; **[unsourced]** for the exact docs URL; verify before use).
- Zustand: the README and docs say object or array selectors should be wrapped in `useShallow` so the component re-renders only when its picked values change. Since v5 the default equality is `Object.is`, so selectors that return new objects each call can loop. Sources: https://zustand.docs.pmnd.rs/hooks/use-shallow and https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow. The README copy is at https://cdn.jsdelivr.net/npm/zustand@5.0.15/README.md.
- Legend State: components render once, and individual elements re-render through `Memo` or `Reactive`. The docs recommend these over wrapping whole components in `observer`. Source: https://legendapp.com/open-source/state/v3/react/fine-grained-reactivity/ (the search excerpt is from v3 docs; check the version you choose).
- Fixes: the context-wide re-render; keeps the tapped row's neighbors from re-rendering.
- Does not help: when the expensive work is in the tapped component's own render (`evaluateCharacter`), a store alone does not reduce that cost. Pair it with step 3 below.
- Cost: a new dependency or a refactor of every consumer. Context splitting costs little but takes some work. An external store changes testing and the provider structure.

### 2c. Memoize `evaluateCharacter()` by input identity
- `evaluateCharacter` (`src/rules/characterEvaluation.ts:96`) is pure, and 12 call sites run it during render. Its cost is paid whenever a component renders, not only when its character changes.
- Fix: memoize the result per character object identity, and make sure untouched characters keep their object identity across updates (the context update must not clone every record). This is a standard React pattern. Source for `useMemo` semantics: https://react.dev/reference/react/useMemo (not fetched; **[unsourced]** for exact wording).
- The compiler may already memoize the call if it can prove the inputs are stable. It cannot prove it when the input is a fresh array or object each update. Verify by checking whether the call sites receive new objects.
- Does not help: when the evaluation is genuinely needed on every tap (the tapped character changed). Then it is the work to speed up, not to skip.
- Cost: low; needs care with identity.

### 2d. `React.memo` and `useMemo` after the compiler
- The compiler replaces most of these. Keep manual `React.memo` only on list rows or components that take stable props and are rendered many times. Source for the compiler replacing them: https://react.dev/learn/react-compiler.
- Does not help: components that receive new props every render (for example, inline `() => ...` handlers the compiler cannot stabilize). Check with the Profiler.
- Cost: none; removing manual memo reduces code.

### 2e. `useTransition` / `useDeferredValue` / `startTransition`
- `useDeferredValue` defers a value so the UI can render the urgent update first. Source: https://react.dev/reference/react/useDeferredValue. Its signature takes an optional `initialValue` (React 19).
- `startTransition` marks an update as non-urgent so input stays responsive during it. The react.dev reference page did not come back in search; **[unsourced]** for the exact URL: https://react.dev/reference/react/startTransition.
- Helps: keeps the press feedback and scroll responsive while a heavy re-render runs; good for filtering or switching tabs with large data.
- Does not help: the tap itself. Do not wrap the state update that gives press feedback in a transition; it can delay the visible change. Also does not help if the whole tap path must finish before paint.
- Cost: low, but it changes when the UI shows the update; check the UX.
- New Architecture note: concurrent features apply to updates inside transitions; the react.dev docs say concurrent behavior is opt-in for those APIs. Source: https://react.dev/reference/react/useDeferredValue (the repo's docs excerpt is third-party; treat as **[unsourced]**).

### 2f. Reanimated
- Press animations (scale, opacity) that run on the UI thread stay smooth when JS is busy. This is a feedback technique, not a state fix. Source: https://docs.swmansion.com/react-native-reanimated/ (not fetched; **[unsourced]** for the exact page). The RN performance page notes JS-driven animations depend on the JS thread. Source: https://reactnative.dev/docs/performance.
- Helps: makes the press feel immediate even if the state update is late.
- Does not help: the state change itself.
- Cost: already a dependency (`react-native-reanimated 4.5.1`).

---

## 3. Persistence off the interaction path

### 3a. Debounce / coalesce writes
- The current save runs in a `useEffect` after every snapshot change and rewrites the whole collection (`src/context/CharacterContext.tsx` around lines 80-100; `src/services/storage.ts`). A burst of taps issues many full writes.
- Fix: batch saves with a short delay (for example 300-500 ms) and a flush on app background. This is standard practice; no specific RN source is needed beyond the RN performance page's note that JS-thread work competes with input. Source: https://reactnative.dev/docs/performance.
- Does not help: a single slow write that is awaited on the tap path. Make sure the write is not in the render or handler.
- Cost: risk of losing the last change if the app is killed before the flush. Mitigate with a flush on `AppState` change.

### 3b. Per-record keys instead of one blob
- Store one key per character (for example `@dnd5e_character:<id>`) plus an index. A tap then serializes one record, not the whole array. This removes the `JSON.parse`/`JSON.stringify` over every character in `savePatch`/`saveCharacters`.
- Source for AsyncStorage key semantics: https://react-native-async-storage.github.io/async-storage/docs/api (not fetched; **[unsourced]** for the exact URL).
- Cost: a migration of `storage.ts`, including the existing `@dnd5e_characters` data. Must be careful with the `enqueue` write queue.

### 3c. Faster storage: MMKV
- `react-native-mmkv` (V4) is a Nitro Module; the README gives Expo install commands `npx expo install react-native-mmkv react-native-nitro-modules` then `npx expo prebuild`. Source: https://raw.githubusercontent.com/mrousavy/react-native-mmkv/main/README.md (search excerpt; not fully fetched). Repository: https://github.com/mrousavy/react-native-mmkv.
- MMKV is synchronous. That removes async bridge round-trips per read/write. Source: same README (the search excerpt confirms it is a synchronous key-value store; verify on the README).
- Older blog posts say MMKV does not work in Expo Go. Current docs use prebuild. Treat any Expo Go claim as dated.
- Fixes: lower per-write latency; no await on the tap path.
- Does not help: whole-blob JSON cost. Still serialize the whole value unless step 3b is applied.
- Cost: a native dependency (`prebuild`), a new storage layer, a migration.

### 3d. Expo SQLite kv-store
- Expo's store-data guide lists `expo-sqlite` next to SecureStore and AsyncStorage as local storage. Source: https://docs.expo.dev/develop/user-interface/store-data.
- The kv-store is in `expo-sqlite/kv-store`. Its API reference: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite.md (the search returned the SDK 57 page; method details came from npm type declarations, not the official page).
- Fixes: durable, indexed storage; can store records separately.
- Does not help: if the bottleneck is per-tap JS work, not storage. It can be async, so it does not remove the await.
- Cost: a database dependency; migration.

### 3e. InteractionManager and requestIdleCallback
- `InteractionManager.runAfterInteractions` delays callbacks until touches end. The RN docs say the 0.80 page marks it deprecated and recommend `requestIdleCallback` for long-running work; later pages (0.83+) still list it. Source: https://reactnative.dev/docs/interactionmanager (check the 0.86 page; the search returned 0.86 but I did not read it in full).
- Fixes: defers persistence until after the tap's touch ends, which can keep the tap itself quick.
- Does not help: when the work runs as a microtask or in the same tick. Deferring it does not reduce the total.
- Cost: low; check deprecation status before relying on it.

---

## 4. Lists and touchables

### 4a. ScrollView + map vs FlatList vs FlashList
- The RN optimizing-flatlist page explains the list knobs (`initialNumToRender`, `windowSize`, `maxToRenderPerBatch`, `updateCellsBatchingPeriod`, `getItemLayout`) and recommends memoizing rows and keeping `renderItem` stable. Source: https://reactnative.dev/docs/optimizing-flatlist-configuration (also https://reactnative.dev/docs/0.86/optimizing-flatlist-configuration).
- FlashList is a drop-in replacement for FlatList; the docs advise removing explicit `key` props from `renderItem` and passing `getItemType` for mixed items. Source: https://shopify.github.io/flash-list/docs. The npm package is https://www.npmjs.com/package/@shopify/flash-list. Version note: a 2.x line is referenced by some Expo docs; check the current major before installing.
- Expo bundles FlashList as an SDK module; the SDK 57 page: https://docs.expo.dev/versions/v57.0.0/sdk/flash-list.md.
- Fixes: scroll and mount cost on long lists. Does not help: tap latency for a button on a short screen, which is decided by the tapped component's render.
- Cost: a dependency; list item refactor.

### 4b. `removeClippedSubviews`
- Detaches off-screen views from the native hierarchy to reduce main-thread work. The RN docs say the default is `true` on Android in some versions and `false` in others; check the version. Caveats: it can hide content, mainly observed on iOS, and does not free much memory. Source: https://reactnative.dev/docs/optimizing-flatlist-configuration.
- Fixes: can reduce native work for long lists on Android.
- Does not help: JS work per tap. Its caveats make it a late, tuning-only option.
- Cost: possible missing content; test it.

### 4c. `TouchableOpacity` vs `Pressable`
- `TouchableOpacity` is a legacy-style touchable. I could not find the `Pressable` docs in the search results. **[unsourced]** for the exact docs URL: https://reactnative.dev/docs/pressable.
- Expected effect on tap latency: small. The press handler and re-render dominate. Treat the swap as cleanup, not a speed fix, unless a profile shows touchable overhead.
- Cost: refactor across 37 files.

### 4d. Inline heavy children
- Components rendered as inline JSX inside the parent's `.map` re-create their subtree on every parent render. The compiler memoizes what it can prove; heavy children that depend on the whole character should be memoized by the character's identity.
- Source: https://reactnative.dev/docs/optimizing-flatlist-configuration (item-level advice: keep items simple, memoize with `memo()`, keep `renderItem` stable).
- Cost: low.

---

## 5. Other Android-specific tap latency items

### 5a. `console.log` in release
- The RN performance page names `console.log` as a frequent cause of JS-thread bottlenecks in a bundled app. Source: https://reactnative.dev/docs/performance.
- Removal in release: common practice is `babel-plugin-transform-remove-console` under the production env. Source: a third-party post at https://dev.to/neeraj1005/how-to-remove-consolelog-from-react-native-production-builds-2f7d. The RN docs page I reached did not state this; **[unsourced]** for an official RN source.
- Fixes: removes serialization cost of logs in release.
- Does not help: logs that are not on the tap path.
- Cost: a Babel plugin; check it works with Expo's Babel preset.

### 5b. Hermes flags and bytecode
- Hermes is the default JS engine. Hermes docs: https://reactnative.dev/docs/hermes (0.70 page cited); current: https://reactnative.dev/docs/next/hermes.
- Hermes bytecode precompilation (`hermesc`) can reduce startup parse time. It does not change per-tap JS execution. Source: https://reactnative.dev/docs/hermes. Treat as a startup fix, not a tap fix. **[unsourced]** for the exact bytecode flags in SDK 57.

### 5c. Inline requires and bundle size
- Inline requires (Metro `inlineRequires`) defer module evaluation until first use, lowering startup time. Source: https://reactnative.dev/docs/performance (the performance page discusses bundle startup); the Metro config option is documented at https://metrobundler.dev/docs/configuration (not fetched; **[unsourced]** for this URL).
- Startup, not tap latency. Skip unless a profile shows module evaluation on the tap path.

### 5d. Release-only crashes and behavior
- Some bugs appear only in release. Always measure on a release build; keep a release variant for profiling (see Section 1e).

### 5e. Dynamic imports on the tap path
- `storage.ts` uses `await import("@react-native-async-storage/async-storage")` per call. A dynamic import on every save adds overhead. Replace with a static import, or import once. This is a small, concrete fix found in the repo, not from a source. **[unsourced]** that it matters; measure it in the Hermes profile.

---

## Measurement recipe (Android emulator or device, release build)

Goal: measure press-to-paint for one tap on one screen, in a release build, and attribute the time.

1. **Build a release APK on a real device or an x86_64 emulator with a release build.** `npx expo run:android --variant release` (or `./gradlew assembleRelease` in `android/`). Confirm `__DEV__` is false. Do not use Expo Go.
2. **Seed a catalog and at least one character** that matches the production data size. A tap on a 1-character store is not representative. Use the seeded app data (`docs/agents/driving-the-app.md` documents seeding for the web build; the Android steps are in `docs/agents/driving-the-android-emulator.md`).
3. **Pick one button** on one screen. Note its label and screen coordinates with `Snapshot` (androidMCP) or `uiautomator dump`.
4. **Add JS marks temporarily** (do not commit): in the press handler call `const t0 = performance.now()`, and in a `useEffect` that runs after the commit that shows the change, log `performance.now() - t0`. Add a `console.log` only for the measurement build, and remove it afterward.
5. **Capture a Perfetto trace** on the release build:
   - `adb shell perfetto -c - --txt -o /data/misc/perfetto-traces/trace.pftrace` with categories `view`, `input`, `gfx`, `sched`, `freq` (or use the Perfetto UI record page at https://ui.perfetto.dev).
   - Start the trace, perform the tap, stop, pull with `adb pull`.
   - Open in https://ui.perfetto.dev. Find the input event, the JS thread slice (`MessageQueue` / Hermes work), and the first frame that shows the change. The gap is press-to-paint.
6. **Measure end to end with video.** Record the screen (`adb shell screenrecord --time-limit 10 /sdcard/tap.mp4`), tap, and count frames between the touch and the frame that shows the change at 30 or 60 fps. Repeat 10 times and take the median.
7. **Attribute the JS time with the Hermes sampling profiler** on the release build (`react-native-release-profiler`, step 1e). Confirm whether `evaluateCharacter`, storage serialization, or context re-render dominates.
8. **Count renders** with the React DevTools Profiler on a development build of the same screen. Use it only to find re-render counts, not timings.
9. **Record the baseline** in a table: run number, JS mark time, frames to visible change, Perfetto gap. Keep the median. Compare after each change in the ranked list, one change at a time.
10. **Remove temporary marks** and profiler code before committing. Stop the emulator and any Metro or Gradle daemons you started.

Notes:
- Expect variance between runs; take at least 10 taps each.
- Keep the device on the same power and thermal state; throttling skews long runs.
- Do not compare dev-build and release-build numbers.

---

## Open items I could not confirm

- The official `startTransition`, `useSyncExternalStore`, `useContext`, `useMemo`, `Pressable` and `Profiler` reference pages did not come back in search; they are linked by URL above but not read.
- RN 0.86 release-build profiling: no official path found; `react-native-release-profiler` is third-party.
- `InteractionManager` deprecation status for 0.86 is not confirmed.
- FlashList major version (1.x vs 2.x) in SDK 57 is not confirmed.
- Expo SQLite kv-store official method list was not read; the API details come from npm types.
- The "dev build vs release" gap size is not quantified by any source found; measure it here.
