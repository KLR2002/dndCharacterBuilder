# 07: Beasts notice in the Features tab's Wild Shape section

**Status:** ready-for-agent

## What to build

In a Druid's Wild Shape section on the Features tab, when the Integrated Catalog holds no beasts, a beasts notice with a "Download beasts" button replaces the Monster Manual reminder. The notice is one shared component (the browser in ticket 08 reuses it). The Monster Manual reminder shows as today when the catalog holds beasts and the Monster Manual is inactive. With the SRD Baseline neither shows. Copy, kept to the essentials: "Beasts were not downloaded. Wild Shape shows only the SRD beasts." The button starts the download operation with the shared progress window (ticket 06).

Spec: `.scratch/skip-beasts/spec.md`.

## Owns

- AC-11: The Features tab replaces the Monster Manual reminder

## Acceptance Criteria

- [ ] AC-11: with an Integrated Catalog that holds no beasts, the Wild Shape section shows the beasts notice and its button and no Monster Manual reminder; with beasts and the Monster Manual inactive, only the reminder shows; with the SRD Baseline, neither shows. Tapping the button downloads the beasts, after which the notice is gone and the reminder rule applies.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-11 | Features tab in a browser | `npm run layout:check` scoped with `ONLY` to a Druid in three states (Integrated without beasts, Integrated with beasts and the Monster Manual inactive, SRD Baseline) at 320 and 768; a step taps the button against a stubbed bestiary and sees the notice replaced; screenshots opened and described |
| Wiring | the button's handler | mutation check: delete the call to the operation and the tap step fails |

`npm run check:all` passes.

## Constraints

- Ask the Compendium, never the saved bundle. The notice component takes its action as a prop so the browser can reuse it.
- Rows wrap or shrink (CODING_STANDARDS section 7); copy per section 8; use the Skill `ui-discipline`.
- Use the layout seed ticket 06 added; do not add a second one.

## Blocked by

02, 04, 06
