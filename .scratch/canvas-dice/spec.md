# Spec: Draw the solid dice on a canvas

**Status:** ready-for-human

Follow-up to `.scratch/3d-dice/spec.md`. The solid dice built there are drawn with `react-native-svg`; on a phone they are too slow and tear. This spec changes the drawing engine and nothing else. Architecture: `docs/adr/0022-dice-are-drawn-on-a-canvas.md` (replaces the drawing part of ADR 0021). Vocabulary: **Dice Animation**, **Roll** in `GLOSSARY.md`; no glossary change.

## Problem

On the user's high-end phone the frame rate drops sharply from 5 dice, and dice that have just stopped show torn faces for about a second. Two throwaway prototypes drew the same dice on one canvas each. The Skia one ran well on the phone but links prebuilt Skia libraries that F-Droid cannot accept, and F-Droid is a release target. The Android Canvas one (a small local module, built from source) was tested by the user: "i checked canvas version, it works well". The outcome needed: Tumble with up to 10 solids and Throw with up to 20 solids run smoothly on a phone, stopped dice are never torn, and nothing in the build is a prebuilt binary.

## Decisions (verbatim)

- Answering "Q2 - Tumble moves to the new engine too … Each one draws on its own canvas: Tumble inside the result card, Throw on the full-screen layer": "yes to all".
- Answering "Q3 - Same look, only a new drawing engine … Better looks (gradients, edge highlights) are left for later": "yes to all".
- Answering "Q4 - Prototype on your phone before any real build … The pass bar: a 20-dice Throw looks smooth on your high-end phone, 10 dice on the weakest phone you care about, and stopped dice never show torn faces": "yes to all".
- Answering "Q5 - ADR … 0022 … replace the drawing part of 0021, including its list of fallbacks. Nothing changes in the glossary": "yes to all".
- Earlier, on the extra native size and the caps (10 for Tumble, 20 for Throw): "i can yes to this 3 questions already".
- On the phone: "On even my high spec phone, from 5 dices at time there is huge drop in fps" and "it looks ugly you must find alternative solution".
- On F-Droid: "f-droid release in future is important to me so check this out".
- Answering the F-Droid question (Skia cannot be built from source there): "Own Android Canvas module (Recommended)". This replaces the earlier "yes to all" on Q1 (Skia everywhere with CanvasKit on web, and the first animated Roll playing as Off); Skia, CanvasKit and the lazy load are gone.
- After the Canvas prototype: "i checked canvas version, it works well, you can rewrite spec".
- Tray: "after throw i want tray to be cleared" (done on `feature/3d-dice`, `ba739ae`; not part of this spec).

## Acceptance Criteria

### AC-1: On the web, a Throw is drawn on one canvas, one label per die

**Given** the web build with the Dice Animation on Throw
**When** a Roll with several dice is made, for example `d20,d20` or `a(d20,d20)+d100`
**Then** one `<canvas>` covers the screen and shows every thrown die, in its Roll's accent and grey when dropped; next to the canvas there is one hidden label element per thrown die, named like today (`d20 showing 14`, `d20 showing 3, dropped`, `d100 showing 40`); and the face each label names equals the die's chip in the result card.

### AC-2: Throw behaviour is unchanged on the web

**Given** a Throw in flight
**When** the dice stop, or the user taps, or presses Roll again
**Then** the result card appears when the dice stop; a tap during the flight shows the card and clears the dice at once; a Roll during the flight replaces the dice; the screen takes taps right after the dice stop; the dice fade after about 1.5 s and the canvas is gone after the fade.

**Given** an expression of more than 20 solids
**When** it is thrown
**Then** 20 solids are drawn and the rest show as number chips only.

### AC-3: On the web, Tumble is drawn on one canvas inside the result card

**Given** the web build with the Dice Animation on Tumble
**When** a Roll is made
**Then** one `<canvas>` inside the result card shows its solids (up to 10), each turning and stopping on the generator's face, with the same label elements as AC-1 next to the canvas; a dropped die turns grey when it stops; the row is hidden from assistive technology; solids past 10 show as number chips only.

### AC-4: The first animated Roll on the web plays the animation

**Given** a fresh page on the web with the Dice Animation on Tumble or Throw
**When** the first Roll is made
**Then** that Roll shows its solids, and the page requested no file for the dice besides the app's own bundle.

**Given** the Dice Animation is Off
**When** a Roll is made
**Then** no canvas is mounted.

### AC-5: On Android, Throw and Tumble are drawn by the module and do not crash

**Given** the Android release build
**When** a Throw of one die, of `20d20` and of `a(d20)+d100+d6+d4+d8+d10+d12` is made, and a Tumble of `10d20,d6` is made
**Then** every animation plays, settles and shows its card; in the third Throw the dropped die is grey; the screen's accessibility tree has one label per drawn die, with the same names as AC-1, equal to the chips; and the log has no fatal exception.

### AC-6: The look is unchanged

**Given** every solid (d4, d6 with pips, d8, d10, d12, d20, d100 as tens and units) at rest and mid-motion
**When** drawn on the web canvas and on the Android canvas
**Then** shapes, flat shading, outlines, numerals, pips, shadows, accents and the dropped grey match the SVG dice they replace, judged on screenshots of both builds.

### AC-7: The Kotlin and TypeScript math agree

**Given** a fixture file of fixed inputs (poses at several times of a recorded Throw, Tumble poses of each die at several times, face shades, pip positions) with the values the TypeScript modules in `src/rules/` produce
**When** the TypeScript test and the Kotlin unit test of the module each read the fixture
**Then** both pass, each within 1e-4 of the stored values; the test of the TypeScript side fails when the stored value of any entry is changed (shown by a probe).

### AC-8: The module is source only and F-Droid has nothing prebuilt to refuse

**Given** the repository after the change
**When** a test lists the files under `modules/`
**Then** every file is text (Kotlin, Gradle, JSON, Markdown, TypeScript); no `.so`, `.a`, `.aar`, `.jar` or image is there; and the F-Droid recipe in `docs/fdroid/` names no package that the project no longer uses.

### AC-9: Smooth on phones, never torn

**Given** a build with the canvas drawing, from EAS, and no debug overlay
**When** the user throws `5d20`, `10d20` and `20d20` and tumbles `10d20` on the high-end phone, and `10d20` in Throw and Tumble on the weakest phone they care about
**Then** the user reports the motion smooth and no stopped die shows torn faces, and that a Throw starts without a visible stall.

### AC-10: The SVG renderer and the prototypes are gone

**Given** the repository after the change
**When** it is searched
**Then** `SolidDie` and the projection code that only it used are removed, `react-native-svg` has no import left in `src/` and is removed from `package.json`, the lockfile and the F-Droid recipe, no prototype file (`PrototypeDiceHud`, `prototypeRenderer`) is present, and a guard test about a removed file is removed with it rather than left failing.

## Architecture Constraints

- **Native.** A local Expo module `modules/dice-canvas` (Android only, `expo-module.config.json`, Gradle library on `expo-module-gradle-plugin`), Kotlin on `android.graphics.Canvas`, no new npm package. One view per animation. The JavaScript side sends one JSON string `scene` prop (geometry, colours, recorded Throw frames or Tumble motion) and a separate `dropped` string prop (`"0101…"`). An unchanged string is not sent again, and a change of `dropped` alone does not replay the animation. The view runs its own `Choreographer` clock, started when `scene` is set. The prototype on `prototype/canvas-dice` (`c280b99`) is the reference, not code to merge as is.
- **Web.** One `<canvas>` 2D context, drawn from `requestAnimationFrame`, using the pure modules in `src/rules/` (`diceSolids`, `diceThrow`, `diceAnimation`) for geometry and pose. No WebGL, no downloaded library.
- **Shared look.** Flat shading, light direction normalised `(-0.35, 0.5, 0.8)`, face culling, outline width and numeral colour as in the SVG dice and the prototype. The numerals use the system bold sans on both.
- **Duplication.** The pose and shading math in Kotlin lives in a file with no Android imports, so it runs in a plain JVM unit test against the fixture of AC-7.
- **Labels.** The label elements of AC-1, AC-3 and AC-5 sit beside the canvas, one per die, with a `testID` the layout check can read; the exact IDs are the implementer's, and the layout check is changed to match them. The layer and the row keep the test IDs `throw-layer` and `dice-solids`.
- **Unchanged.** The simulation, the two-pass roll seam, the caps (10 and 20), the Dice Animation setting, the accent rules and every behaviour in AC-2 (ADR 0021, `.scratch/3d-dice/spec.md`).
- **No module, no animation.** On a platform that has neither the canvas nor the module (iOS, which has no build in this project), the Roll plays as Off.

## Verification Map

| Criterion or risk | Seam | Oracle and evidence |
| --- | --- | --- |
| AC-1 | Web layout check, scenarios "Dice throw animation" and "Dice batch" | Playwright reads the label elements and the card's chips and compares faces; samples the canvas pixels at a die's centre for the accent and the grey. The old `svg polygon` assertions are replaced. `npm run layout:check` with `ONLY=Dice`. |
| AC-2 | Web layout check, scenario "Dice throw animation" | The existing assertions (card after stop, tap during flight, mid-flight Roll, fade, taps after stop, cap of 20) keep passing against the new label elements. |
| AC-3 | Web layout check, scenario "Dice animation" | Label count and faces equal the chips; `dice-solids` stays `aria-hidden`; the dropped die is grey after it stops; 11 dice show 10 solids. |
| AC-4 | Web layout check | A fresh page with Throw: the first Roll has labels, and the network log shows no request besides the bundle. With Off: no `<canvas>` in the page. |
| AC-5 | Android emulator, release build, per `docs/agents/driving-the-android-emulator.md` | The four animations of the criterion: `uiautomator dump` lists the labels and the faces equal the chips, logcat has no `FATAL EXCEPTION`, screenshots of each result. |
| AC-6 | Screenshots on web and the Android emulator | Open the shots of every die type in Tumble and Throw next to the SVG ones from `d1226ac`. A green check is not evidence of a look. |
| AC-7 | `npm test` (TypeScript) and `./gradlew :dice-canvas:testDebugUnitTest` (Kotlin) | Both read the shared fixture; a probe that edits one stored value makes the TypeScript test fail. |
| AC-8 | `checks/` guard test, `npm test` | The guard fails on a probe file `modules/dice-canvas/x.so` and passes on the final tree; the recipe is read by eye and by `grep`. |
| AC-9 | The user's phones, EAS build `eas build -p android --profile preview-arm64-v8a` | The user's report. Ticket stays `ready-for-human`. |
| AC-10 | `npm run check:all` | `grep -r "react-native-svg\|SolidDie\|Prototype" src package.json docs/fdroid` prints nothing; lint, typecheck and tests pass. |

## Out of Scope

- New looks (gradients, edge highlights, textures) and any change to the simulation, the caps or the settings.
- A fallback renderer when the module or the canvas is missing: the Roll plays as Off.
- iOS: no module is written.
- Rolled Abilities in the builder (unchanged, no animation).
- The tray clearing after a Roll (already done).
- Pushing or opening a pull request.

## Open Risks

- **F-Droid has never built this app (owner: user).** The recipe in `docs/fdroid/` has not been run through `fdroid build`, so AC-8 only proves the module adds no prebuilt binary. Run `fdroid build` before the next F-Droid release; it does not block the tickets.
- **The weakest phone is unmeasured (owner: user).** Only the high-end phone has run the prototype. AC-9 covers the weakest phone at the end; if it fails, the Throw cap is lowered by a follow-up ticket, with the user's numbers.
- **A stall at the start of a Throw.** On the emulator the first frames of a 5-dice Throw took about 600 ms once. It may be the JSON scene parsed on the UI thread, the simulation, or the layer mounting; it is not attributed. AC-9 asks the user to look for it, and if it shows, the scene parse moves to a background thread.
