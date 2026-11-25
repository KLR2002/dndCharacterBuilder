# 04: The download-beasts operation

**Status:** ready-for-agent

## What to build

One operation that adds the beasts to the saved Integrated Catalog without a re-sync: it fetches only the beasts (the same filtering as the sync), merges them into the saved catalog, makes the Compendium read them at once, and turns Skip Beasts off. The saved catalog's format number and "Last synced" date, and every other collection, stay as they were, so a stale catalog stays stale. A thrown error, or a result of zero beasts, changes nothing (catalog, setting, Compendium) and surfaces an error. It refuses to run on the SRD Baseline. The character context exposes it for the UI (tickets 06 to 08); this ticket has no UI.

Spec: `.scratch/skip-beasts/spec.md`.

## Owns

- AC-7: Downloading beasts adds only the beasts
- AC-8: Downloading beasts turns Skip Beasts off
- AC-9: A failed download changes nothing

## Acceptance Criteria

- [ ] AC-7: against a saved Integrated Catalog with no beasts, Catalog Format 15 (stale) and a "Last synced" date, a client serving the bestiary leaves the saved catalog with the filtered beasts (beasts up to CR 6 and the four Wild Shape elementals, no swarms); every other collection, the format (15) and the date are unchanged; the Compendium lists the catalog's beasts at once.
- [ ] AC-8: with Skip Beasts on and a successful download, the saved setting reads off afterwards.
- [ ] AC-9: when the client throws, or the bestiary yields zero beasts, an error is raised; the saved catalog and the setting are unchanged and the Compendium still lists the SRD beasts. On the SRD Baseline the operation raises an error and saves nothing.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-7 | the download operation with a fake client and the in-memory store | red-green test: stale format 15 stays 15, the date is unchanged, every other collection is deep-equal before and after, the beasts match the expected filtered list (literal names), `beasts()` lists them |
| AC-8 | the same, with the settings store | red-green test: setting `true` before, `false` after success |
| AC-9 | the same, with a throwing fake and a fake serving no beasts | red-green test: catalog, setting and listing unchanged in both; the fake tells the two failures apart; SRD Baseline case refused |
| Wiring | the line that clears the setting | mutation check: delete it and the AC-8 test fails; delete the line that re-integrates the Compendium and the AC-7 test fails |

`npm run check:all` passes.

## Constraints

- The operation must not go through `saveCompendiumData` as it is: that stamps the current Catalog Format. The saved format and `integratedAt` stay.
- The setting is cleared only after the catalog is saved.
- It takes the progress callback the sync takes (one step, named "Beasts") so the progress window of ticket 06 can show it.
- Reuse the existing beast scraper; do not copy its filtering.
- The character context holds the setting as state (the way it holds the dice animation setting) and exposes it with a setter, so the checkbox of ticket 05 reads and writes it; the context's download function also sets that state to off after a successful download, so the state and the saved setting never disagree.
- No UI, no Catalog Format bump.

## Blocked by

01
