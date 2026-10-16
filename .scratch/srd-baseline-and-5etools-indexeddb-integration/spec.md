# Spec: SRD Baseline & Client-Side IndexedDB 5eTools Integration

**Status:** ready-for-agent
**Tracker:** local markdown (`.scratch/srd-baseline-and-5etools-indexeddb-integration/`).
**Related:** ADR 0013 (SRD Baseline & Client-Side IndexedDB 5eTools Integration), GLOSSARY terms *SRD Baseline*, *Integrated Catalog*, *Sourcebook Gating*, *Dataset Swapping*.

## Problem Statement
The application previously bundled full 2014 sourcebook JSON files (PHB, XGE, TCE, etc.) directly in git, presenting copyright risk with Wizards of the Coast (WotC). The first-run onboarding immediately presented users with a checklist of copyrighted books. Users who legitimately own physical sourcebooks need a way to reference their books in the app without shipping proprietary text in source control or requiring end-users to run Node.js terminal commands.

## Solution
Ship the repository with only open-access 2014 System Reference Document (SRD 5.1) content bundled in `src/data/*.json`. Replace the first-run book selection modal with an informational welcome dialog. In Settings, provide an in-app "5eTools Integration" feature that includes an owned-content disclaimer, downloads full sourcebook data directly inside the browser from the CORS-safe raw mirror into IndexedDB with on-screen progress feedback, swaps out the SRD Baseline in memory, and unlocks the Source Books checklist initialized to the 14 default books.

## User Stories
1. As a new user opening the app for the first time, I want to see an informational welcome modal explaining that the app runs on SRD 5.1 rules and that sourcebooks can be integrated in Settings, so that I understand what content is available without being asked to configure books upfront.
2. As a player building a character with the default app, I want to create characters using standard SRD 5.1 classes, subclasses, races, spells, and items immediately without external setup.
3. As a player navigating to Settings, I want to see the 5eTools Integration section explaining that its purpose is solely to reference sourcebooks I already legally own.
4. As a player who owns sourcebooks, I want to click "Enable Integration", see the confirmation disclaimer, and click "Agree & Download" to begin downloading into IndexedDB.
5. As a player during download, I want to see an on-screen progress indicator tracking each category being fetched and parsed.
6. As a player with an active integration, I want the SRD baseline to be completely disabled in memory and replaced by the Integrated Catalog, so that I see zero duplicate entities.
7. As a player with an active integration, I want the Source Books checklist to appear in Settings with the 14 default books from `default_active_resource_books.txt` pre-selected.
8. As a player in Settings with an active integration, I want options to "Re-sync / Update" or "Revert to SRD" (clearing IndexedDB), so that I can easily manage or reset my local storage.
9. As a developer running terminal utilities, I want `dnd5eToolsScrap/src/index.ts` to include `conditions.ts` in `npm run scrape` and `--only conditions`, ensuring conditions are scraped and synced alongside other catalogs.

## Implementation Decisions
- **SRD Baseline Pruning**: Prune `src/data/*.json` down to the 2014 SRD 5.1 dataset (12 base classes with 1 archetype each, 9 base SRD races/subraces, SRD spells, SRD items/monsters, Grappler feat, and Acolyte background), tagged with `source: "SRD"`.
- **Platform Compendium Storage**: Implement a unified storage adapter (`src/services/compendiumStorage.ts`) using IndexedDB in browser environments and AsyncStorage/in-memory fallback on mobile/testing environments.
- **In-App Scraper Runner**: Implement a browser-compatible scraping module (`src/services/scraper/`) that executes the 10 scrapers against the CORS-enabled 5eTools GitHub raw mirror without `node:child_process` or `curl`.
- **Dynamic Catalog Store & Cutover**: Update `src/services/dataService.ts` to load asynchronously from `CompendiumStorage` at launch into an in-memory cache, completely disabling the SRD Baseline once the Integrated Catalog is active.
- **First-Run Modal Replacement**: Replace the legacy sourcebook checklist in `FirstRunModal` with the informative SRD 5.1 welcome dialog.
- **Settings Gating & Progress UI**: In `src/app/options.tsx`, gate the Source Books list behind the integration status, display download progress during scraping, and provide Re-sync and Revert controls.
- **CLI Scraper Update**: In `dnd5eToolsScrap/src/index.ts`, import `scrapeConditions` from `conditions.ts`, expose `--only conditions`, add it to the default scrape pipeline, and sync output to `src/data/conditions.json`.

## Testing Decisions
- Test public `dataService` getters with both the SRD Baseline and hydrated Integrated Catalog.
- Verify that duplicate entities do not appear after cutover.
- Verify `CompendiumStorage` hydration and cache clearing with an in-memory test hook.
- Verify that `dnd5eToolsScrap` tests pass and `npm run check:all` passes cleanly.

## Out of Scope
- File import/export pickers for manual JSON uploads.
- Changes to character evaluation rules or sheet layouts.
