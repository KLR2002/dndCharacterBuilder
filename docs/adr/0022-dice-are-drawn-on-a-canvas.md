# 0022 Dice Are Drawn On A Canvas

## Context
ADR 0021 drew the solid dice as projected polygons with `react-native-svg`, one SVG element per face and per numeral. On the user's high-end phone the frame rate fell sharply from 5 dice, and dice that had just stopped showed torn faces for about a second.

Two throwaway prototypes drew the same dice on one canvas each. A Skia prototype (`prototype/skia-dice`, `@shopify/react-native-skia`) ran Tumble and Throw smoothly on the phone. It was rejected because Skia's native build links prebuilt static libraries (about 700 MB in `node_modules`, fetched by a postinstall script, no source beside them), and the app is to be released on F-Droid, whose scanner removes prebuilt binaries from `node_modules`. A Canvas prototype (`prototype/canvas-dice`) did the same drawing in a small Android module on `android.graphics.Canvas`, built from source, and the user reported that it "works well" on the phone. The Skia prototype also showed that a callback (`map`, `sort`) inside a per-frame worklet crashes a release build on Android; the Canvas module has no worklets.

## Decision
- On Android the solid dice are drawn by a local Expo module, `modules/dice-canvas`, in Kotlin on `android.graphics.Canvas`. It builds from source with the app and adds no npm package. One native view per animation: a Throw has one full-screen view for all its bodies and shadows, Tumble has one view for the result card's row.
- On the web the same dice are drawn on one `<canvas>` with the 2D context, from the same pure TypeScript geometry and pose modules. Nothing is downloaded and the first animated Roll plays the chosen animation.
- The JavaScript side sends the native view one JSON scene (geometry, colours and the recorded Throw frames or the Tumble motion) and the view then runs its own frame clock. Which dice are dropped is a separate prop, so it does not restart the animation.
- The look does not change: the same flat-shaded polygons, outlines, numerals, pips, shadows, accents and grey for dropped dice.
- The drawing code exists twice, in Kotlin (native) and in TypeScript (web). The pose and shading math in the module is plain Kotlin with no Android imports, and a shared fixture of expected values, checked by a test on each side, keeps the two equal.
- The simulation, the two-pass roll seam and the caps of ADR 0021 stay as they are: 10 solids for Tumble, 20 for a Throw.
- The SVG renderer and the projection code only it used are removed, not kept as a fallback. `react-native-svg` leaves the project if nothing else needs it.
- A platform without the module (iOS, which has no build in this project) plays the Roll as Off.

## Considered Options
- Skia (`@shopify/react-native-skia`) everywhere, with CanvasKit on the web: works on the phone, but cannot be built from source for F-Droid, and costs about 11 MB per ABI plus a wasm download on web. Rejected.
- Skia built from source for F-Droid: Skia is a very large C++ build; rejected as too heavy for one app.
- Cheaper `react-native-svg` fallbacks from ADR 0021 (numerals on the top face only, fewer shading steps, 30 fps playback, lower caps, sprite frames): rejected. They trade the look or the cap for speed, and the cost of one native view per face remains.
- Canvas on native only, SVG on the web: rejected, two engines to keep identical for no gain.
- A WebView with a `<canvas>` on native, to share one drawing routine: rejected, a WebView per animation costs startup time and memory on weak phones.

## Consequences
- Native size grows by a few hundred KB of Kotlin, not 11 MB per ABI, and the web build downloads nothing extra.
- The dice drawing is written twice. The shared fixture of expected poses and shades catches drift in the math; a difference in looks is judged on screenshots.
- A Throw or Tumble is one canvas, so the dice are no longer separate views: tests and the screen reader reach them through label elements next to the canvas, not through the drawing.
- F-Droid has no prebuilt binary to refuse from this module. The recipe in `docs/fdroid/` has still never been run through `fdroid build`; that check stays open before the next F-Droid release.

## Supersedes
This replaces the drawing part of ADR 0021 (the polygons drawn with `react-native-svg`) and its list of frame-rate fallbacks. Everything else in ADR 0021 stands.
