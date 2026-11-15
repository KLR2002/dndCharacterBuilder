# 06: Remove SVG and the prototypes

**Status:** ready-for-agent

## What to build

Remove the old renderer now that web and Android draw on canvases: `SolidDie`, the projection code that only it used, and every import of `react-native-svg`; remove `react-native-svg` from `package.json`, the lockfile and the F-Droid recipe in `docs/fdroid/`, and any package that recipe names but the project no longer uses. Remove any prototype leftover (`PrototypeDiceHud`, `prototypeRenderer`). Guard tests that covered removed code (the worklet and label-matrix guards for the SVG die) are removed with it, not left failing. Add a guard test that lists the files under `modules/` and fails when one is not text (no `.so`, `.a`, `.aar`, `.jar`, image or class file).

## Owns

- AC-8: The module is source only and F-Droid has nothing prebuilt to refuse
- AC-10: The SVG renderer and the prototypes are gone

## Acceptance Criteria

- [ ] AC-8: Every file under `modules/` is text; a probe file `modules/dice-canvas/x.so` makes the guard fail (then removed); `docs/fdroid/` names no package the project no longer uses.
- [ ] AC-10: `grep -r "react-native-svg\|SolidDie\|Prototype" src package.json docs/fdroid` prints nothing; lint, typecheck and tests pass; the lockfile no longer holds `react-native-svg`.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-8 | Guard test under `checks/`, `npm test` | Red with the probe file, green on the final tree; the recipe's package list read and compared with `package.json`. |
| AC-10 | `npm run check:all` and the grep | Output of both. Also `ONLY=Dice WIDTHS=393 npm run layout:check` still passes. |

## Constraints

- Spec `.scratch/canvas-dice/spec.md`, ADR 0022. Do not change behaviour; any dependency still importing `react-native-svg` (a transitive one) is reported.
- Follow `docs/agents/subagent-tiering.md`, section "Implementer Rules".

## Blocked by

05
