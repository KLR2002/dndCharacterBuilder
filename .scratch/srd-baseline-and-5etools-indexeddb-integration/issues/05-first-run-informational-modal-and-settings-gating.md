# 05: First-Run Informational Modal & Settings Sourcebook Gating

**What to build:**
Replace the legacy sourcebook selection wizard in `FirstRunModal` with an informational dialog explaining that the app runs on SRD 5.1 rules and references Settings for 5eTools integration. In `OptionsScreen` (`src/app/options.tsx`), implement the 5eTools Integration section with an owned-content disclaimer, download progress modal, Re-sync and Revert to SRD controls, and gate the Source Books checklist so it only appears when integration is active, pre-populated with the 14 default books from `default_active_resource_books.txt`.

**Blocked by:** 04 (In-App Scraper Service & IndexedDB Pipeline)

**Status:** closed

- [x] Redesign `FirstRunModal` to display an informational welcome message regarding SRD 5.1 and settings integration with a single confirmation button
- [x] In `CharacterContext.tsx`, track `hasIntegratedCatalog` state synced with `CompendiumStorage`
- [x] In `src/app/options.tsx`, hide the "Source Books" section entirely when `hasIntegratedCatalog` is false
- [x] Add the "5eTools Integration" section in `OptionsScreen` displaying the disclaimer and "Enable Integration" button
- [x] Connect "Enable Integration" to the confirmation disclaimer modal ("This integration is intended exclusively to reference sourcebooks and content that you already legally own...")
- [x] Render the scraping progress modal during download
- [x] Upon successful integration, reveal the Source Books checklist with `DEFAULT_ACTIVE_BOOK_CODES` (the 14 default books) enabled
- [x] Provide "Re-sync / Update" and "Revert to SRD" controls when integration is active
