# 03: Kotlin math and the shared fixture

**Status:** ready-for-agent

## What to build

Create the Android module `modules/dice-canvas` (local Expo module, Android only: `expo-module.config.json`, `android/build.gradle` on `com.android.library` and `expo-module-gradle-plugin`, namespace `expo.modules.dicecanvas`, and a module class that only has `Name("DiceCanvas")`; the view comes in ticket 04). In it, put the dice pose and shading math in a plain Kotlin file with no Android imports: vector rotation, quaternion multiply, axis-angle, the nlerp sampling of recorded Throw frames (stride 7: x, y, z, qw, qx, qy, qz), the Tumble pose and pop, pip marks, the face shade and the label matrix. A fixture file of fixed inputs and the expected values produced by the TypeScript modules in `src/rules/` (`diceProjection`, `diceAnimation`, `diceThrow`, `diceSolids`) is read by a TypeScript test and by a Kotlin unit test. Both must pass within 1e-4.

The reference Kotlin is on branch `prototype/canvas-dice` (`git show prototype/canvas-dice:modules/dice-canvas/android/src/main/java/expo/modules/dicecanvas/DiceCanvasView.kt`); do not copy anything under `modules/dice-canvas/android/build/` from that branch (it holds build output).

## Owns

- AC-7: The Kotlin and TypeScript math agree

## Acceptance Criteria

- [ ] AC-7: The fixture covers sampled Throw poses at several times, Tumble poses of each die type at several times, face shades and pip positions; the TypeScript test and the Kotlin unit test both read it and pass within 1e-4.
- [ ] The TypeScript test fails when one stored value in the fixture is edited (a probe, then reverted).
- [ ] The fixture is written only by a recorder switch (an environment variable, like the repo's other fixtures), never by hand.
- [ ] `modules/` is ignored for `build/` and `.cxx/`; no build output is committed.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-7 | `npm test` and the Kotlin unit test (`cd android && ./gradlew :dice-canvas:testDebugUnitTest`; the worktree has no `android/` project, so run `CI=1 EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android --no-install` first, with `ANDROID_HOME=~/Android/Sdk`; check the module's project name with `./gradlew projects`) | Both green. Red first: the TypeScript test fails with no fixture, and the Kotlin test fails with the math stubbed. The probe: edit one stored value, `npm test` fails; revert it. Start Gradle in the background with its output in a file and wait for the completion notice; stop the Gradle daemon (`./gradlew --stop`) before reporting. |

## Constraints

- Spec `.scratch/canvas-dice/spec.md`, ADR 0022. The Kotlin math file has no `android.*` imports so a plain JVM test runs it.
- Do not change the TypeScript math; if a function cannot be matched, report it.
- Do not commit the generated `android/` project or any build output.
- Follow `docs/agents/subagent-tiering.md`, section "Implementer Rules".

## Blocked by

None.
