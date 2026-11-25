# 08: Beasts notice in the Wild Shape browser

**Status:** done
**Landed:** 3434b060. check:all passed; scoped layout runs (integrated 320, 768) passed; list read after a stubbed download. Nested progress window inside the browser's modal not checked on a device. Integration gate (final tree 54f74f4e): check:all, check:live, full layout:check (SRD, all widths) and layout:check --integrated at 320 passed.

## What to build

The Wild Shape browser (the modal a Druid opens to pick a form) shows the same beasts notice and "Download beasts" button as the Features tab, replacing the Monster Manual reminder under the same rules. After a successful download the list shows the catalog's beasts without leaving the screen.

Spec: `.scratch/skip-beasts/spec.md`.

## Owns

- AC-12: The Wild Shape browser does the same

## Acceptance Criteria

- [x] AC-12: in the browser, with an Integrated Catalog that holds no beasts, the notice and button show and there is no Monster Manual reminder; with beasts and the Monster Manual inactive only the reminder shows; with the SRD Baseline neither shows. After a successful download from the browser, the list shows the catalog's beasts at once.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-12 | Wild Shape browser in a browser | `npm run layout:check` scoped with `ONLY` to the three states at 320 and 768; a step opens the browser, taps the button against a stubbed bestiary, and reads the list (the beast count is larger than the SRD's 92 for the stubbed catalog, or a named beast from the stub appears); screenshots opened and described |
| Wiring | the button's handler and the list's source | mutation check: delete the call to the operation and the step fails |

`npm run check:all` passes.

## Constraints

- Reuse the notice component from ticket 07; do not copy it.
- The browser's compact layout stacks the notice and button; both must wrap at 320.
- Copy per CODING_STANDARDS section 8; use the Skill `ui-discipline`.

## Blocked by

07
