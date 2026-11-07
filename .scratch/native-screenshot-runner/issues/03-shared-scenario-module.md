# 03: Move scenarios into a shared module

**Status:** ready-for-agent

## What to build

The scenario list and the seed builder move out of the web layout check into a module both runners can import. `npm run layout:check` visits the same scenarios in the same order, in both the SRD Baseline and `--integrated` modes, and the seed keeps the shape `{ characters, folders, settings, integrated }`.

## Owns

- AC-6: The web and native runners share one scenario list

## Acceptance Criteria

- [ ] AC-6: With `SCREENS` and `buildSeed()` moved to `scripts/lib/scenarios.mjs`, `layout:check` lists the same scenario names in the same order as before the move, with and without `--integrated`, and `buildSeed()` returns `{ characters, folders, settings, integrated }`.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-6 | Scenario module exports | Capture the scenario names (SRD, then `--integrated`) from the unchanged `layout:check` first, commit that list as a fixture, and add a test that the module's names and order equal it. Red-green: the test fails when two names are swapped. A smoke run `ONLY=Home npm run layout:check` passes. |

## Constraints

- Spec: `.scratch/native-screenshot-runner/spec.md`.
- The module lives in `scripts/lib/`. The web runner depends on it and it depends on neither runner.
- A pure move: no scenario is added, removed or reworded, and `open` and `modal` stay as they are (ticket 04 changes them).
- Out of scope: any native code.

## Blocked by

None
