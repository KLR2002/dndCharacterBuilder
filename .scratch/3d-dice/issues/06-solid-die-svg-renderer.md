# 06: Draw a solid die with react-native-svg

**What to build:** A pure projection `src/rules/diceProjection.ts` and a component `src/components/dice/SolidDie.tsx`, lifted from `drawDie` in the prototype. `projectDie(geo, quaternion, size, ...)` returns what to draw for one die: the faces that face the viewer, far to near, each with its screen polygon, a shade from a fixed light, and its labels as 2D affine matrices (text) or pips (d6), all from plain numbers so it can run inside a Reanimated worklet (functions marked `'worklet'`, no closures over non-serialisable values; the directive is a no-op for the Node tests). `SolidDie` takes `{ geo, quaternion, size, accent, dropped }` and draws that list with `Svg`, `Polygon`, `Text` (with the matrix as its transform) and `Circle`; the body takes the accent's `primary`, the numerals its `text`, a dropped die turns grey and muted. The component is lazy-loaded behind the existing `DiceRenderer` slot like the current renderer, so nothing of it loads while the animation is Off. It is not mounted anywhere yet; the next ticket uses it. If an SVG `Text` matrix transform does not render on Android, wrap the label in a `G` with the transform and say so in the report.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] `checks/diceProjection.test.ts`, written first: with `poseShowing(geo, value)` the face that reads `value` is the nearest face and its label matrix has no shear and a uniform scale; a die showing a face to the viewer lists only faces whose normal points toward it; the faces come far to near; a dropped die changes only the colours, not the geometry
- [ ] `npm run typecheck`, `npm run lint` and `npm run check:all` pass (the visual check happens in the Tumble ticket, which mounts the component)
