# Spec: Skip Beasts

**Status:** ready-for-human

## Problem

The 5e.tools sync spends most of its time on step 8 of 11, Beasts: it fetches 114 bestiary files one at a time (about 12 MB) to keep 274 Beast Statblocks, which only a Druid's Wild Shape reads. A player who will not play a Druid waits for data they never use. They need a setting that leaves the beasts out of the next sync, a way to download them later (from Settings, or from the Wild Shape surfaces of the character UI, where the Monster Manual reminder already lives), and a clean result when the beasts a character's Wild Shape form depends on are no longer in the catalog (revert to SRD, or a re-sync with the setting on).

## Decisions (verbatim)

From the request:
- "I want to have option in the app options that if checked will result in omitting downloading this data. It should be signed with comment like this: "Speeds up integration time. May be worth enabling if you don't plan to play with druid" or something like that correct grammar if its wrong."
- "User should have option to download this part of data later in the options or directly from character ui (the same way like currently there is reminder of enabling monster manual)."
- "disabling option after integrating beasts don't affect data, maybe user just dont wish to have beasts after resync/revert to srd and back."

From the interview (Q1-Q9, answered "agree to all but" the two corrections below):
- Q1-Q9: "agree to all but important notice: "download beasts" appear only if without-beasts catalog is integrated, never in srd version. User can't download only beasts"
- Q12 (stat block button for a missing beast): "i disagree with 12 - if you revert to srd, you should not have non-srd content in any form, agree to rest"
- Q10, Q11, Q13-Q16: covered by "agree to all but important notice" above.
- Q17-Q20 (a form whose beast is gone ends, same as Revert; only a missing beast ends it; same spec): "yes to all, /to-spec"

The questions as agreed: Q1 the setting is read only when a sync starts and changes no saved catalog. Q2 it sits in the 5eTools Integration card, before and after the first integration. Q3 label "Skip beasts", caption "Speeds up integration. Worth enabling if you don't plan to play a Druid. Wild Shape keeps the SRD beasts." Q4 the download prompt depends on the saved catalog having no beasts, not on the setting. Q5 the download runs the beast step only and adds the result to the saved catalog, with the sync progress window (one step). Q6 it is offered in Settings and in the Wild Shape section of the Features tab and the Wild Shape browser, where the notice replaces the Monster Manual reminder. Q7 downloading beasts unchecks the setting. Q8 no second disclaimer. Q9 faster fetching stays out of this spec. Q10 glossary term **Skip Beasts**. Q11 off by default. Q13 favourite beasts are kept and hidden while unavailable. Q14 the download changes only the beasts (the catalog's format number and "Last synced" date stay). Q15 a failed download, or one that returns zero beasts, shows an error and saves nothing. Q16 the sync window counts 10 steps with the setting on. Q17-Q20 an Active Wild Shape whose beast is not in the active catalog ends like the Revert button, with a `needsReview` notice, in the reconcile step; only a missing beast ends it, never an inactive book.

## Acceptance Criteria

### AC-1: Skip Beasts is a saved setting, off by default

**Given** saved app settings with no Skip Beasts value
**When** the settings are read
**Then** Skip Beasts is off
**And** a saved `true` or `false` is read back unchanged
**And** a saved value that is not a boolean is rejected like the other settings.

### AC-2: A sync under Skip Beasts leaves the beasts out

**Given** Skip Beasts is on and a client that records every endpoint it is asked for
**When** the in-app sync runs
**Then** no `data/bestiary/` endpoint is requested
**And** the saved catalog holds no beasts and every other collection
**And** progress reports 10 steps, none named "Beasts".

### AC-3: A sync with Skip Beasts off is unchanged

**Given** Skip Beasts is off
**When** the in-app sync runs
**Then** the bestiary is fetched and the beasts are saved
**And** progress reports 11 steps with "Beasts" as step 8.

### AC-4: The setting is offered in both integration states

**Given** the Settings screen, first with the SRD Baseline and then with an Integrated Catalog
**When** the 5eTools Integration card is shown
**Then** it has a "Skip beasts" checkbox with the caption "Speeds up integration. Worth enabling if you don't plan to play a Druid. Wild Shape keeps the SRD beasts."
**And** checking it saves the setting.

### AC-5: Changing the setting touches no saved catalog

**Given** an Integrated Catalog holding beasts
**When** Skip Beasts is switched on, or off again
**Then** the saved catalog and the Wild Shape list are exactly as before.

### AC-6: The Compendium knows when the Integrated Catalog has no beasts

**Given** an Integrated Catalog saved with no beasts
**When** the Compendium is built
**Then** it answers that the catalog holds no beasts, and `beasts()` lists the SRD Baseline's 92
**And** for an Integrated Catalog with beasts, and for the SRD Baseline, it answers that it does.

### AC-7: Downloading beasts adds only the beasts

**Given** a saved Integrated Catalog with no beasts, Catalog Format 15 (stale) and a "Last synced" date, and a client serving the bestiary
**When** the beasts are downloaded
**Then** the saved catalog's beasts are the filtered Beast Statblocks (CR 6 or less beasts and the four Wild Shape elementals, no swarms)
**And** every other collection, the Catalog Format and the "Last synced" date are unchanged, so the catalog is still stale
**And** the Compendium lists the catalog's beasts at once.

### AC-8: Downloading beasts turns Skip Beasts off

**Given** Skip Beasts is on and the download of AC-7 succeeds
**When** it completes
**Then** the saved Skip Beasts setting is off.

### AC-9: A failed download changes nothing

**Given** an Integrated Catalog with no beasts and Skip Beasts on
**When** the download throws, or the bestiary yields zero beasts
**Then** an error is shown, the saved catalog and the setting are unchanged, and the Compendium still lists the SRD beasts.

### AC-10: Settings offers the download only for a catalog without beasts

**Given** the Settings screen
**When** the Integrated Catalog holds no beasts
**Then** the integration card shows a "Download beasts" button that starts the download with the sync progress window, no second disclaimer
**And** with an Integrated Catalog that holds beasts, and with the SRD Baseline, there is no such button.

### AC-11: The Features tab replaces the Monster Manual reminder

**Given** a Druid's Features tab with an Integrated Catalog
**When** the catalog holds no beasts
**Then** the Wild Shape section shows a beasts notice with a "Download beasts" button, and no Monster Manual reminder
**And** when it holds beasts and the Monster Manual is inactive, the reminder shows as today
**And** with the SRD Baseline neither shows.

### AC-12: The Wild Shape browser does the same

**Given** the Wild Shape browser with an Integrated Catalog
**When** the catalog holds no beasts
**Then** the same notice and button replace the Monster Manual reminder, under the same rules as AC-11
**And** after a successful download the list shows the catalog's beasts without leaving the screen.

### AC-13: A form whose beast left the catalog ends

**Given** a Druid in the Giant Badger form (source MM) with 5 temporary hit points on the form and a spent Wild Shape use
**When** the catalog changes to the SRD Baseline (revert), or to an Integrated Catalog without beasts, and the character is reconciled
**Then** the form ends like Revert: the form's temporary hit points go back to the character (the larger of the two), the character's hit points and the spent use are untouched
**And** `needsReview` gains a notice naming the beast.

### AC-14: A form whose beast is still there stays

**Given** a Druid in an SRD-sourced Brown Bear form
**When** the catalog changes to an Integrated Catalog that prints Brown Bear under another source, or to one without beasts (the SRD beasts remain)
**Then** the form stays, with no notice
**And** a form of a beast whose book is turned off in Active Books stays too.

### AC-15: Favourite beasts are kept

**Given** a character with a favourite MM beast
**When** the catalog changes to one without that beast
**Then** `favoriteWildShapes` is unchanged and the beast is not listed
**And** after the beasts are downloaded it is listed again.

## Architecture Constraints

- **Setting**: `skipBeasts` in `AppSettings` (`src/services/storage.ts`), absent means off, validated in `normalizeSettings`. It is read once, when a sync starts. No other code reads it.
- **Sync**: `collectIntegratedCatalog` / `runInAppIntegration` take the decision as an argument; the default includes beasts, so `scripts/build-live-catalog.mjs` and the live catalog are unchanged. The step total is computed from the decision, not a literal 11 (`src/app/options.tsx` also seeds `total: 11`). No Catalog Format bump: the catalog's shape does not change.
- **No beasts is the empty collection**: the saved catalog's `beasts` is empty or absent; no separate flag is stored. That is also what a sync that lost every bestiary file saves, so the download is its recovery. `resolve` keeps its SRD fallback; the Compendium gains one read-only answer for "the Integrated Catalog holds no beasts" and the UI asks it, never the bundle.
- **Download operation**: one operation fetches the beasts only (reusing `scrapeBeasts`), merges them into the saved catalog, and re-integrates the Compendium. It must not go through `saveCompendiumData` as it is, which stamps the current Catalog Format; the saved format and `integratedAt` stay. It clears Skip Beasts only after the catalog is saved. It refuses to run on the SRD Baseline. Failure leaves both untouched.
- **Release in the reconciler**: ending the form lives in `reconcile` (`src/rules/characterReconciler.ts`, CODING_STANDARDS section 3), reuses `revertWildShape`, and appends its notice with `withNotices`; no transition calls it. `reconcileForActiveBooks` already runs on a catalog change and when a character is opened.
- **"The beast is gone"**: no beast of that name and source in the active catalog's listing, or, when the saved source is `SRD`, no beast of that name (the Integrated Catalog drops SRD-sourced records and prints them under another book; today `findBeast(name, "SRD")` fails on one). It never reads Active Books.
- **Progress window**: the sync progress window used in Settings is one shared component, reused for the download from the character UI.
- **UI copy and code**: CODING_STANDARDS sections 7 and 8; no non-SRD rule text in `src/` (ADR 0014); the glossary term is **Skip Beasts** (`GLOSSARY.md`, already written together with the Active Wild Shape sentence).
- **Tests**: both modes (SRD Baseline and Integrated Catalog, section 4); the catalog-shape facts go through the live catalog check.

## Verification Map

| Criterion or risk | Seam | Oracle and evidence |
| --- | --- | --- |
| AC-1 | `storage.ts` settings load/normalize | `checks/storage.test.ts`: literal absent, `true`, `false` and `"yes"` cases. `npm run check:all` |
| AC-2, AC-3 | `runInAppIntegration` with a recording fake client | `checks/browserScraper.test.ts`: the recorded endpoint list (literal expectation: no `data/bestiary/` with the setting on, 114-file index served with it off), the saved beasts, the progress calls (10 steps without "Beasts", 11 with it at step 8). `npm run check:all` |
| AC-5 | Storage plus Compendium | `checks/integrationLifecycle.test.ts`: the saved catalog and `beasts()` before and after the setting changes |
| AC-6 | `createCompendium` | `checks/compendium.test.ts`: three bundles (no beasts: 92 SRD beasts and the answer; with beasts; SRD Baseline) |
| AC-7, AC-8, AC-9 | The download operation with a fake client and the in-memory store | new test beside `checks/compendiumStorage.test.ts`: stale format 15 stays 15, `integratedAt` unchanged, other collections deep-equal before and after; throwing client and zero-beast client change nothing; the settings store reads off after success and unchanged after failure. The fake can serve the 114-file index and fail by file |
| AC-4, AC-10 | Settings screen in a browser | `npm run layout:check` with new scenarios (SRD, Integrated without beasts, Integrated with beasts), screenshots opened and read, at 320, 393, 768 and 1280 |
| AC-11, AC-12 | Features tab and Wild Shape browser in a browser | the same, with a Druid seeded in an Integrated Catalog without beasts, then with beasts and MM inactive, then the SRD Baseline; one run taps Download beasts against a stubbed bestiary and sees the list fill |
| AC-13, AC-14 | `reconcileForActiveBooks` | `checks/characterReconciler.test.ts` and `checks/wildShapeHp.test.ts` style cases: literal HP and counters before and after; negative cases for SRD-sourced Brown Bear and for MM off in Active Books (section 4) |
| AC-15 | Reconcile and `for(books).beasts()` | one test: the favourite is in the save, not in the list, in the list again with the beasts |
| Live catalog still builds with beasts | `scripts/build-live-catalog.mjs` | `npm run check:live` |
| Everything | whole repo | `npm run check:all`; for the UI, `npm run layout:check`. No part is native-only, so `layout:android` is not required |

## Out of Scope

- Fetching the bestiary files in parallel, or any other speed-up of the beast step (a follow-up idea).
- Downloading beasts on the SRD Baseline, or downloading any other collection on its own.
- A choice of which beasts to download (a CR or book filter).
- Hiding the stat block button for a missing beast (superseded: such a form ends).

## Open Risks

- A sync that loses only some bestiary files saves a partial list of beasts, and the catalog then counts as having beasts, so no download is offered. Owner: the user. Recommendation: a follow-up that fails the beast step when a file is missing, kept apart from this spec.
- A Wild Shape form can end without a tap, on a catalog change, with only a `needsReview` notice. This follows the user's decision (no non-SRD content after a revert) and the existing reconcile pattern.
