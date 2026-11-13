# 0022 Dice Are Drawn With Skia

## Context
ADR 0021 drew the solid dice as projected polygons with `react-native-svg`, one SVG element per face and per numeral. On the user's high-end phone the frame rate fell sharply from 5 dice, and dice that had just stopped showed torn faces for about a second. A throwaway Skia prototype (branch `prototype/skia-dice`) drew the same dice on one canvas and ran Tumble and Throw smoothly on the same phone. The prototype also showed that a callback (`map`, `sort`) inside a per-frame drawing worklet crashes a release build on Android.

## Decision
- The solid dice are drawn with `@shopify/react-native-skia` on native and on the web. Each animation is one `Canvas` with one `Picture`, recorded on the UI thread every frame straight from the die geometry: a Throw has one full-screen canvas for all its bodies and shadows, Tumble has one canvas for the result card's row.
- The look does not change: the same flat-shaded polygons, outlines, numerals, pips, shadows, accents and grey for dropped dice.
- A per-frame drawing worklet uses plain loops. No `map`, `sort`, `forEach` or other callback runs inside it. A guard test enforces this.
- On the web, CanvasKit (the wasm build of Skia) loads lazily, the first time an animated Roll is made. That Roll plays as Off; later Rolls play the chosen animation. Native needs no loading step.
- The simulation, the two-pass roll seam and the caps of ADR 0021 stay as they are: 10 solids for Tumble, 20 for a Throw.
- The SVG renderer and the projection code only it used are removed, not kept as a fallback.

## Considered Options
- Cheaper `react-native-svg` fallbacks from ADR 0021 (numerals on the top face only, fewer shading steps, 30 fps playback, lower caps, sprite frames): rejected. They trade the look or the cap for speed, and the cost of one native view per face remains.
- Skia on native only, SVG on the web: rejected, two renderers to keep identical.
- Skia for Throw only, SVG for Tumble: rejected, Tumble showed the same cost at 10 dice and two engines draw the same die.

## Consequences
- The native build grows by about 11 MB per ABI (`librnskia.so`), and the web build downloads CanvasKit (`canvaskit.wasm`) on first use.
- A Throw or Tumble is one canvas, so the dice are no longer separate views: tests and the screen reader reach them through label elements next to the canvas, not through the drawing.
- The Skia package ships prebuilt Skia static libraries. The F-Droid build (`docs/fdroid/`) may refuse them (its scanner removes prebuilt binaries from `node_modules`), so F-Droid buildability must be checked before the next F-Droid release.

## Supersedes
This replaces the drawing part of ADR 0021 (the polygons drawn with `react-native-svg`) and its list of frame-rate fallbacks. Everything else in ADR 0021 stands.
