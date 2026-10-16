# 0013: SRD Baseline & Client-Side IndexedDB 5eTools Integration

## Context

The application previously shipped with proprietary 2014 D&D sourcebook data (PHB, XGE, TCE, etc.) bundled directly in git under `src/data/*.json`. To strictly respect Wizards of the Coast (WotC) intellectual property and OGL/CC-BY terms:

1. **Zero Proprietary Data Bundled Out-of-the-Box**:
   The shipped repository and default application build must contain only the unencumbered 2014 System Reference Document (SRD 5.1) content.

2. **Personal Reference Integration**:
   Users who own sourcebooks must be able to integrate 5eTools data directly in the application for personal reference without manually moving files or running CLI commands.

3. **Sourcebook Selection Gating**:
   Sourcebook filters and checklists must remain hidden until the user has performed the integration, ensuring players only see books after they have been loaded locally.

4. **Synchronous Rules Engine Preservation**:
   All 480+ character leveling, spell slot, action economy, and AC rules rely on synchronous data lookups in `dataService.ts`. Storage operations cannot disrupt this synchronous design.

---

## Decision

1. **Prune Bundled Files to SRD Baseline**:
   - Filter `src/data/*.json` to strictly include SRD 5.1 content (1 subclass per class, SRD base races/subraces, SRD spells, SRD items/monsters, Grappler feat, and Acolyte background).
   - Tag all bundled baseline records with `source: "SRD"`.

2. **Client-Side Scraping & Storage in IndexedDB**:
   - Implement an in-app scraper runner in `src/services/scraper/` that runs the existing parser logic in the browser via standard CORS-friendly requests to the 5eTools raw mirror.
   - Store scraped records across 10 categories (Races, Classes, Feats, Options, Backgrounds, Items, Spells, Beasts, Conditions, Books) directly into IndexedDB (with an AsyncStorage fallback on native mobile).

3. **Dataset Swapping on Cutover**:
   - At startup, the app checks IndexedDB. If the Integrated Catalog exists, it hydrates in-memory collections and completely disables/unloads the SRD Baseline, eliminating duplicate entries.
   - If IndexedDB is empty, the app seamlessly defaults to the bundled SRD Baseline.

4. **First-Run Modal & Settings Gating UX**:
   - Replace the legacy `FirstRunModal` with an informational modal explaining that the app runs on SRD 5.1 data by default and directs users to Settings for 5eTools integration.
   - In `OptionsScreen` (`src/app/options.tsx`), display an owned-content disclaimer, progress feedback during scraping, active status management (Re-sync / Revert to SRD), and gate the Source Books checklist so it only appears when integration is active, pre-populated with default books from `dnd5eToolsScrap/default_active_resource_books.txt`.

5. **Scraper CLI Alignment**:
   - In `dnd5eToolsScrap/src/index.ts`, wire in `scrapeConditions` from `conditions.ts`, support `--only conditions`, include conditions in the default scrape run, and automatically sync `conditions.json` to `src/data/conditions.json`.
