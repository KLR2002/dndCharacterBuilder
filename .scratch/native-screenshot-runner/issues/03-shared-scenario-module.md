# 03: Move scenarios into a shared module

**Status:** done
**Landed:** 29c568a. `checks/scenariosModule.test.ts` 3/3, red-green with a swapped pair (implementer). Independent oracle (main session): the original script at `4d29c3f`, run in both modes, gives the same 50 (SRD) and 67 (integrated) names in the same order as the committed fixtures. `npm run check:all` exit 0 (1766 app tests, 305 scraper tests). `ONLY="Builder Abilities,Home" WIDTHS=393 npm run layout:check` in the main checkout: GREEN, both screenshots written. The implementer's full runs failed only because Metro cannot resolve a symlinked `node_modules` in a worktree. Open: the full-width run in the main checkout comes with ticket 04's evidence. `EXTRA_CHECKS` stays in `layout-check.mjs`, so the fixtures hold the SCREENS lists only.

## What to build

The scenario list and the seed builder move out of the web layout check into a module both runners can import. `npm run layout:check` visits the same scenarios in the same order, in both the SRD Baseline and `--integrated` modes, and the seed keeps the shape `{ characters, folders, settings, integrated }`.

## Owns

- AC-6: The web and native runners share one scenario list

## Acceptance Criteria

- [x] AC-6: With `SCREENS` and `buildSeed()` moved to `scripts/lib/scenarios.mjs`, `layout:check` lists the same scenario names in the same order as before the move, with and without `--integrated`, and `buildSeed()` returns `{ characters, folders, settings, integrated }`.

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
