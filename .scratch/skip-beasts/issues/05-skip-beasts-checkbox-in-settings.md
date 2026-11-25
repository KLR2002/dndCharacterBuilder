# 05: "Skip beasts" checkbox in Settings

**Status:** ready-for-agent

## What to build

In the 5eTools Sourcebook Integration card of Settings, a "Skip beasts" checkbox with the caption "Speeds up integration. Worth enabling if you don't plan to play a Druid. Wild Shape keeps the SRD beasts." It shows both before the first integration (SRD Baseline) and after it (a re-sync reads it too). Checking it saves the setting; it changes no saved catalog.

Spec: `.scratch/skip-beasts/spec.md`.

## Owns

- AC-4: The setting is offered in both integration states
- AC-5: Changing the setting touches no saved catalog

## Acceptance Criteria

- [ ] AC-4: the integration card shows the checkbox labelled "Skip beasts" with the caption above, with the SRD Baseline and with an Integrated Catalog, at 320, 393, 768 and 1280 px; checking it saves the setting, and the next sync reads it.
- [ ] AC-5: with an Integrated Catalog holding beasts, switching Skip Beasts on and off leaves the saved catalog and the Wild Shape list exactly as before.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-4 | Settings screen in a browser | `npm run layout:check` scoped with `ONLY` to the new scenarios (SRD Baseline, Integrated with beasts), `WIDTHS=320` while iterating; screenshots opened with Read and described in the report; the checkbox is tapped and the saved setting read back |
| AC-5 | storage and Compendium | red-green test: with a saved catalog holding beasts, a settings update leaves `loadCompendiumData()` and `beasts()` unchanged |
| Wiring | the checkbox's press handler | mutation check: delete its `onPress` and the browser step that toggles it fails |

`npm run check:all` passes. The full unscoped layout suite is not run by the implementer.

## Constraints

- CODING_STANDARDS sections 7 and 8: the caption wraps, the row does not overflow at 320; no extra help text beyond the caption.
- Use the Skill `ui-discipline`.
- The settings screen already holds toggles (see how the existing options are drawn) and the shared UI components in `src/components/ui/`; reuse them.
- New layout scenarios go in the shared scenario list and the browser steps in the shared step files.

## Blocked by

01, 04 (04 puts the setting in the character context's state, which this checkbox reads and writes)
