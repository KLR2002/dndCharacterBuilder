# 04: Android module draws Tumble and Throw

**Status:** ready-for-agent

## What to build

On Android, Tumble and Throw are drawn by the `dice-canvas` module on `android.graphics.Canvas`. The module's view takes a JSON `scene` prop (geometry, colours, the recorded Throw frames or the Tumble motion) and a separate `dropped` string prop (`"0101…"`); an unchanged string is not sent again, and a change of `dropped` alone does not replay the animation. The view runs its own `Choreographer` clock, started when `scene` is set, and uses the math of ticket 03. The drawing is the one in the prototype (flat shading, culling, outline, numerals in the system bold sans, pips, Throw shadows first and dice sorted by depth at their lifted size, the Tumble round-rect shadow, dropped dice grey `[104,108,116]` with ink `[210,210,210]`). On the JavaScript side the animation components choose the native view on Android, the web canvas on web, and play as Off on any other platform. One hidden label per drawn die, named like today and equal to the chips, is reachable in the Android accessibility tree beside the native view.

The reference is the branch `prototype/canvas-dice` (`modules/dice-canvas/...` and `src/components/dice/CanvasDice.tsx`; the user tested it on the phone and it works). Take its source files only: its `modules/dice-canvas/android/build/` output and its `PrototypeDiceHud` and `prototypeRenderer` are not wanted.

## Owns

- AC-5: On Android, Throw and Tumble are drawn by the module and do not crash

## Acceptance Criteria

- [ ] AC-5: In the Android release build, a Throw of one die, of `20d20` and of `a(d20)+d100+d6+d4+d8+d10+d12`, and a Tumble of `10d20,d6`, each play, settle and show their card; in the third Throw the dropped die is grey; `uiautomator dump` lists one label per drawn die with the old names and the faces equal the chips; the log has no `FATAL EXCEPTION`.
- [ ] A re-render that changes only which die is dropped does not restart the animation.
- [ ] On iOS no native view is requested and the Roll plays as Off.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-5 | Android emulator, release build, per `docs/agents/driving-the-android-emulator.md` | The four animations: UI dump showing the labels and chips, logcat without `FATAL EXCEPTION`, a screenshot of each result opened and described. Builds and emulator runs go in the background with output files; stop the emulator, adb server and Gradle daemon before reporting. |
| Dropped prop | A TypeScript test of the scene builder | A changed `dropped` with the same scene leaves the scene string identical (red first). |

## Constraints

- Spec `.scratch/canvas-dice/spec.md`, ADR 0022. No Skia, no new npm package, no downloaded library, no committed build output.
- Module code reuses the math of ticket 03 and its fixture; do not re-derive it.
- The simulation, the two-pass roll seam and the caps (10 and 20) do not change. The SVG dice stay in the tree until ticket 06.
- Follow `docs/agents/subagent-tiering.md`, section "Implementer Rules".

## Blocked by

03
