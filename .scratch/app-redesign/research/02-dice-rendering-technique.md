# Dice rendering technique (web + Android)

Question: which technique draws rolling dice in this Expo app on react-native-web and Android at the lowest bundle, CPU, GPU and battery cost, with runtime accent tinting, a predetermined result shown immediately, an off switch (setting and OS reduced motion), and several dice rolling at once.

## Project facts

- `package.json`: expo `^57.0.25`, react-native `0.86.3`, react `19.2.3`, react-native-web `~0.21.0`, react-native-reanimated `4.5.1`, react-native-worklets `0.10.1`. No three.js, expo-gl, Skia or react-native-svg in dependencies.
- The roll is already decided in code. `src/rules/hitDice.ts` line 62 computes `options?.roll ?? (Math.floor(Math.random() * faces) + 1)`, so the animation only has to display a value the app passes in.
- Accent colours come from the theme (`theme.accent`, defined in `src/constants/theme.ts`). Nothing in `src/` or `checks/` reads reduced motion yet.
- Reanimated 4.5.1 peers: `react-native` `0.83 - 0.86` and `react-native-worklets` `0.10.x` (npm `react-native-reanimated@4.5.1`). The project is inside both ranges.

## Platform constraints shared by all options

- New Architecture: Expo's docs say "The New Architecture is always enabled and cannot be disabled" from SDK 55 on, and SDK 55 uses React Native 0.83 (https://docs.expo.dev/guides/new-architecture/). Any native module must therefore support the New Architecture. Reanimated 4.x and Worklets "support only the New React Native architecture" (https://raw.githubusercontent.com/software-mansion/react-native-reanimated/main/README.md).
- Reanimated is listed by Expo as supporting "Android, iOS, tvOS, Web, Included in Expo Go" (https://docs.expo.dev/versions/latest/sdk/reanimated/). That page documents SDK 58 and recommends Reanimated 4.7.1, while this project pins 4.5.1. Expect the same web and Android support on 4.5.1, but check that version against the SDK 57 bundled-library list.
- Reduced motion, native: `AccessibilityInfo.isReduceMotionEnabled()` returns a promise, and `reduceMotionChanged` fires when the toggle changes (https://reactnative.dev/docs/accessibilityinfo). The page does not state Android or web support explicitly.
- Reduced motion, web: `@media (prefers-reduced-motion: reduce)` is "Baseline: Widely available" (https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).
- Predetermined result: all options share one rule. The app passes the RNG result in, and the animation only chooses how to get there. In the 2.5D and scripted-3D options the end pose is set directly from the chosen face. In the physics option a physics engine cannot be told the answer; the only lever is initial conditions, which makes forcing a face fragile.

Bundle figures below are npm `dist.unpackedSize` (uncompressed tarball contents), not minified or gzipped bundle sizes. I did not measure the real bundle delta. Measure it with `npx expo export` before deciding.

## Candidate 1: real 3D with physics (three.js / R3F + rapier or cannon-es)

- Added dependencies and size (unpacked): `three` 0.187.0, 21.0 MB (https://registry.npmjs.org/three/-/three-0.187.0.tgz); `@react-three/fiber` 9.8.2, 2.4 MB (https://registry.npmjs.org/@react-three/fiber/-/fiber-9.8.2.tgz); `@dimforge/rapier3d-compat` 0.21.0, 15.0 MB (https://registry.npmjs.org/@dimforge/rapier3d-compat/-/rapier3d-compat-0.21.0.tgz); `expo-gl` 58.0.4, 1.6 MB (https://registry.npmjs.org/expo-gl/-/expo-gl-58.0.4.tgz). `cannon-es` 0.20.0 is the lighter physics option, but its last publish is 2022-08-12 (npm registry metadata).
- Peer ranges: `@react-three/fiber` 9 requires `react` `>=19 <19.4` (matches 19.2.3), `react-native` `>=0.78`, `expo-gl` `>=11.0`, `three` `>=0.156`, and `expo` `>=43.0` (npm `@react-three/fiber` peerDependencies). The R3F docs say "@react-three/fiber@9 pairs with react@19" (https://r3f.docs.pmnd.rs/getting-started/introduction).
- Web: R3F's web renderer is `createRoot` from `react-dom/client` with a `<Canvas>` (same R3F introduction page). The app's react-native-web tree needs a web-only file that renders the react-dom Canvas. This is an inference from the docs, not something I tested.
- Android: `expo-gl` "provides a `View` that acts as an OpenGL ES render target" and its header lists "Android, iOS, Web" (https://docs.expo.dev/versions/latest/sdk/gl-view/). The page does not mention the New Architecture, so check it on device.
- Predetermined face: not supported directly. Physics chooses where the die lands. Forcing a face means tuning initial impulses per roll, which is brittle and costs CPU for the simulation.
- Theming: a material colour uniform. Runtime change is cheap.
- Runtime cost: a GL context per view and a continuous render loop plus a physics step while rolling. Battery and CPU are the highest of the options. It needs `frameloop="demand"` and an idle stop to avoid drain.
- Maintenance: three (2026-10-30), R3F (2026-10-21), expo-gl (2026-11-05), rapier (2026-09-25) are all recently published. cannon-es is not.
- Verdict: the most realistic and the most expensive. It does not meet the "lightest" requirement.

## Candidate 2: 3D without runtime physics (scripted tween to target orientation)

- Same rendering stack as candidate 1 without the physics engine: three.js with `@react-three/fiber` on native (via expo-gl) and react-dom on web. Dropping rapier saves 15.0 MB unpacked. `three` (21.0 MB unpacked) and `expo-gl` stay.
- Predetermined face: exact. Compute the target quaternion for the chosen face, tween to it, and set the number texture on the face. This is the standard approach and it is deterministic.
- Theming: same material-colour approach as candidate 1.
- Runtime cost: a GL context and a render loop for the tween duration only. Lower than candidate 1, still well above a 2D approach. The app is still paying for a WebGL canvas per dice view, and several dice at once multiply that.
- Verdict: a good "more realistic" upgrade path if the 2.5D look is judged too flat later. Still heavier than the user's stated priority.

## Candidate 3: 2.5D (Reanimated transforms over Views or SVG faces)

- Added dependencies: none strictly required. `react-native-reanimated` and `react-native-worklets` are already installed. For faces drawn as polygons (d4, d8, d12, d20 outlines with numbers), add `react-native-svg`, which is `15.16.1` and 3.8 MB unpacked (npm metadata). Plain Views can do d6 pips without it.
- Web: react-native-svg has "a compatibility layer for the web" (https://raw.githubusercontent.com/software-mansion/react-native-svg/main/README.md). Reanimated lists Web in the Expo docs (see above).
- Android: Reanimated supports Android, and `react-native-svg` supports iOS and Android (same README).
- Predetermined face: exact. Animate `rotateX`/`rotateY`/`rotateZ` and `scale` to a pose that shows the already-decided face. The number is rendered on the face, so the displayed value is the app's RNG result by construction.
- Theming: the face fill and stroke are props driven by `theme.accent`. A runtime change is a re-render with no GPU cost.
- Runtime cost: transforms run on the UI thread through Reanimated worklets, and each die is a few composited layers with no WebGL context. This is the cheapest option on CPU, GPU and battery.
- Several dice: N small animated Views. Cost scales linearly with dice count, but each die is trivial.
- Off switch: `isReduceMotionEnabled` (native) and `prefers-reduced-motion` (web) both gate it, and the same settings flag skips the animation and shows the result at once.
- Trade-off: no real lighting, shadows or physics. Dice tumble as flat faces. The user has said they prefer lighter over realistic, so this is the trade they chose.
- Verdict: recommended.

## Candidate 4: Skia (@shopify/react-native-skia) as a 2.5D renderer

- Added size: `@shopify/react-native-skia` 2.14.0 is 10.1 MB unpacked, and it depends on `canvaskit-wasm` 0.41.0 (npm metadata). Skia requires `react-native-reanimated` `>=4.0.0` and `react-native-worklets` `>=0.7.0` (npm peerDependencies). It also needs a native build for Android (`react-native-skia-android` 154.0.0 in its dependencies).
- Web size: secondary sources only. A GitHub issue reports CanvasKit at about 2.9 MB gzipped and about 6 MB added on iOS and 4 MB on Android (https://github.com/Shopify/react-native-skia/issues/1629 and linked threads; figures are anecdotal and not from official docs). I could not open the official Skia web docs (the URL 404'd), so treat these numbers as unverified.
- Web setup: GitHub issues record blank-screen and wasm-path problems on Expo web (https://github.com/wcandillon/react-native-skia/issues/3247). These are reports, not docs.
- Predetermined face: same as candidate 3, but drawing is manual.
- Verdict: heavier than candidate 3 for no gain unless shading or particles are wanted. Reject for this app.

## Candidate 5: existing dice libraries

- `@3d-dice/dice-box` 1.1.4, last published 2024-08-24, 11.4 MB unpacked (npm metadata). Its README describes it as "3D Game Dice for any JavaScript App" and says it "uses web workers and offscreenCanvas" (https://github.com/3d-dice/dice-box). It uses BabylonJS and AmmoJS (`@babylonjs/core` 5.57.1 as a dependency). It targets the browser and does not mention React Native or Android. Its README does not document forced results. Verdict: does not run on Android and would not give predetermined results. Reject.
- `dice-box-threejs`: not found on npm (404). Reject.

## Ranking

1. Candidate 3, 2.5D with Reanimated transforms and SVG or View faces. Cheapest, exact predetermined face, runtime accent tinting, works on web and Android, and needs no WebGL. Adds only `react-native-svg` if polygon faces are wanted.
2. Candidate 2, scripted 3D tween with three.js and expo-gl. Realistic and exact on the result, but a WebGL context per dice view and a much larger install.
3. Candidate 1, 3D with physics. Most realistic, highest CPU, GPU and battery, forcing the result is fragile.
4. Candidate 4, Skia. Heavier than candidate 3 with no advantage for this brief.
5. Candidate 5, existing libraries. Not usable on Android and not fit for predetermined results.

## Recommendation

Pick candidate 3: draw each die as a View or SVG face, tween it with Reanimated transforms to a pose that shows the value the app's RNG already chose, tint the faces from `theme.accent`, and gate it behind the settings flag plus `AccessibilityInfo.isReduceMotionEnabled` on native and `prefers-reduced-motion` on web. It adds almost nothing to the bundle, uses the UI thread instead of a GL context, and works on both targets. The trade-off is plain: the dice look like flat tumbling faces with no lighting, shadows or physics, which is the realism the user has said they are willing to give up.

## Open items

- Bundle delta for each option is not measured. Run `npx expo export` for the chosen option.
- The Reanimated docs page documents SDK 58 and recommends 4.7.1; the project pins 4.5.1. Confirm 4.5.1 against the SDK 57 bundled-library list.
- `AccessibilityInfo` web support in react-native-web is not verified. Use `matchMedia` directly on web.
- Skia web size figures are secondary sources only.
