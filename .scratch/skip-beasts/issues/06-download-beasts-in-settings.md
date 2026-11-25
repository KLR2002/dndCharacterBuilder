# 06: "Download beasts" in Settings, with a shared progress window

**Status:** done
**Landed:** fe364bdd, 38758900. check:all passed; scoped layout runs (SRD 320 and 768, integrated 320) passed; screenshots of the button, progress and error windows opened. Integration gate (final tree 54f74f4e): check:all, check:live, full layout:check (SRD, all widths) and layout:check --integrated at 320 passed.

## What to build

In the 5eTools Sourcebook Integration card, a "Download beasts" button shows only when an Integrated Catalog holds no beasts. Tapping it starts the download operation (ticket 04) at once, with no second disclaimer, and shows the sync progress window (one step, "Beasts") and its error state. The progress window is extracted from the Settings screen into one shared component so the character UI (tickets 07, 08) reuses it. On success the button disappears and Skip beasts is unchecked. This ticket also adds the layout seed for an Integrated Catalog without beasts, which tickets 07 and 08 reuse.

Spec: `.scratch/skip-beasts/spec.md`.

## Owns

- AC-10: Settings offers the download only for a catalog without beasts

## Acceptance Criteria

- [x] AC-10: with an Integrated Catalog that holds no beasts, the card shows a "Download beasts" button that starts the download with the progress window and no disclaimer; with an Integrated Catalog that holds beasts, and with the SRD Baseline, there is no such button. After a successful download the button is gone and Skip beasts is unchecked; after a failed one the error shows and the button stays.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-10 | Settings screen in a browser | `npm run layout:check` scoped with `ONLY` to three states (SRD Baseline, Integrated with beasts, Integrated without beasts) at 320 and 768, plus a step that taps the button against a stubbed bestiary and sees the button disappear; a failed-download state shows the error; screenshots opened and described |
| Wiring | the button's handler and the progress window | mutation check: delete the handler's call to the operation and the tap step fails; the existing sync progress window still works from Settings (the same scenario that syncs) |

`npm run check:all` passes.

## Constraints

- The progress window is one shared component used by the sync and the download; the sync's behaviour and look are unchanged.
- Show the button by asking the Compendium (ticket 02), never the saved bundle.
- The download changes the Compendium without changing any React state the screens depend on (`skipBeasts` may already be off). The character context exposes a catalog revision (or an equivalent piece of state) that the download bumps, and every screen that lists beasts or asks whether the catalog lacks beasts depends on it, so the button, the notices and the Wild Shape list update at once.
- Copy per CODING_STANDARDS section 8; use the Skill `ui-discipline`.
- The layout scenarios need an Integrated Catalog with an empty `beasts` collection; find how the scenario seeds and the browser driver choose a catalog (`docs/agents/driving-the-app.md`) and add that variant without changing the existing SRD and integrated runs.

## Blocked by

02, 04, 05
