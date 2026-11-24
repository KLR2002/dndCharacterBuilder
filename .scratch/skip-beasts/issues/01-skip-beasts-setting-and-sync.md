# 01: Skip Beasts setting and sync

**Status:** ready-for-agent

## What to build

A saved app setting, Skip Beasts (off by default), and a sync that honours it. When the setting is on at the moment a sync starts, the sync never requests the bestiary, saves the catalog with no beasts, and reports 10 steps with no "Beasts" step. With it off, the sync is exactly what it is today (11 steps, Beasts at step 8). The setting is read only when a sync starts; nothing else reads it. The setting has no UI yet (ticket 05).

Spec: `.scratch/skip-beasts/spec.md`. Glossary term: **Skip Beasts**.

## Owns

- AC-1: Skip Beasts is a saved setting, off by default
- AC-2: A sync under Skip Beasts leaves the beasts out
- AC-3: A sync with Skip Beasts off is unchanged

## Acceptance Criteria

- [ ] AC-1: saved settings with no Skip Beasts value read as off; a saved `true` or `false` reads back unchanged; a saved value that is not a boolean is rejected like the other settings.
- [ ] AC-2: with the setting on, a client that records every endpoint it is asked for sees no `data/bestiary/` request; the saved catalog holds no beasts and every other collection; progress reports 10 steps and none is named "Beasts".
- [ ] AC-3: with the setting off, the bestiary is fetched and the beasts are saved; progress reports 11 steps with "Beasts" as step 8.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-1 | settings load/normalize | red-green test with literal cases: absent, `true`, `false`, and a non-boolean (`"yes"`) |
| AC-2, AC-3 | the in-app sync (`runInAppIntegration`) with a recording fake client | red-green test: the recorded endpoint list, the saved beasts, and the progress calls, with literal expected values (the fake serves a small bestiary index) |
| Wiring | the step that reads the saved setting when a sync starts | mutation check: delete the line that passes the saved setting into the sync and a test fails. The read must therefore live in a function a test can call, not only inside a React component |

`npm run check:all` passes. `npm run check:live` passes: the live catalog build keeps its beasts because the default includes them.

## Constraints

- `skipBeasts` is a field of the app settings, absent means off, validated where the other settings are.
- The sync takes the decision as an argument; the default includes beasts, so `scripts/build-live-catalog.mjs` is unchanged.
- The step total comes from the decision, not a literal 11 (the Settings screen also seeds `total: 11`; it must not show a wrong count while syncing).
- No Catalog Format bump: the catalog's shape does not change.
- No UI in this ticket.

## Blocked by

None
