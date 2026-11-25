# 09: Repairs from the integrated review

**Status:** done
**Landed:** 54f74f4e. Open advisory: when the settings write fails after the catalog is saved, the Features and Wild Shape notices unmount with their error window (only Settings keeps it). check:all and check:live passed; mutation checks failed tests; the full sync's error window wording unchanged (probe screenshot). Integration gate (final tree 54f74f4e): check:all, check:live, full layout:check (SRD, all widths) and layout:check --integrated at 320 passed.

## What to build

Fixes for the confirmed findings of the code review of the integrated branch. No new behaviour beyond what the spec already says.

## Owns

No new acceptance criteria. This ticket repairs the verification and constraints of AC-4, AC-8, AC-9, AC-12 and the spec's Architecture Constraints ("read once, when a sync starts"; a failed download "changes nothing").

## Acceptance Criteria

- [x] A download whose write to storage could not be persisted (every backend failed) throws; the saved catalog, the saved setting and the Compendium are unchanged, and the player sees an error. A sync's best-effort save keeps its behaviour.
- [x] The Settings screen no longer reads the saved setting itself when a sync starts: it seeds the progress total from the context's `skipBeasts` state, synchronously, as before the feature; only the sync reads the saved setting.
- [x] The progress window shows wording that fits what the player started: the full sync keeps "Syncing Compendium", "Category N of M", "Integration Error" and "Failed to complete integration: <message>"; a beasts-only download shows a title that says so, no "Category 1 of 1" subtitle, and on failure its own error title and the plain message. The sentence about IndexedDB is gone from both.
- [x] A second press of Download beasts, while a download runs, starts nothing.
- [x] After a download whose settings write fails once the catalog is saved, the screens still update to the new beasts (the catalog revision is bumped), and the error shows.
- [x] An SRD-sourced Wild Shape form stays when the active books exclude the books the beasts come from (Active Books restricted to the Player's Handbook): the release never reads Active Books.
- [x] Every SRD beast name exists in the live catalog's beasts, so an SRD-sourced form resolves after a sync.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| Failed write | the download operation with a native-file fake whose write throws and no AsyncStorage | red-green test: it rejects, saved catalog and setting unchanged, Compendium lists the SRD beasts; the same test pins that the setting is cleared only after the catalog is saved |
| Setting read once | Settings screen in a browser | `layout:check` scoped, the Settings scenario still green; no import of `readIncludeBeasts` in `src/app`; the first progress frame of a sync shows the right total (10 with Skip beasts checked) |
| Wording | progress window in a browser | scoped layout checks for the Settings download, the Features notice and the browser; screenshots opened: the full sync's error window (existing probe or check) is unchanged in wording, the beasts download's windows show the new wording |
| Re-entrancy | `BeastsNotice` and Settings | mutation check: remove each guard, and a unit or browser check shows a second download starts |
| Revision on settings failure | the context's download | red-green test through `providerHarness` |
| SRD form, restricted books | reconcile | red-green test (the form stays, no notice) |
| Live invariant | live catalog check | `npm run check:live` passes with the new assertion; the assertion fails when a name is removed (show by a temporary edit) |

## Constraints

- Test names and source comments carry no spec ids, ticket numbers or `.scratch` paths.
- Do not change: the `eslint-disable` for the Wild Shape list memo, the three copies of the progress state, `holdsBeast` versus `findBeast`, the Monster Manual reminder, the notice wording agreed in the spec.

## Blocked by

None
