# 03: Platform Storage Adapter & Dynamic In-Memory Compendium Store

**What to build:**
Create a unified compendium storage adapter supporting IndexedDB on Web and AsyncStorage/in-memory fallback on Native and test environments. Update `src/services/dataService.ts` to hydrate an in-memory catalog from this storage adapter at application startup, falling back to the bundled SRD Baseline when empty, and performing a total dataset swap (disabling SRD entities) when an Integrated Catalog is loaded.

**Blocked by:** 02 (SRD Baseline Catalog Pruning and Source Tagging)

**Status:** closed

- [x] Create `src/services/compendiumStorage.ts` with IndexedDB on Web, AsyncStorage on Mobile, and `__setCompendiumKvForTests` for deterministic testing
- [x] Add compendium state schema (`hasIntegratedCatalog: boolean`, collections for all 10 categories)
- [x] Update `src/services/dataService.ts` with `initCompendiumStore()` and `clearCompendiumStore()`
- [x] Ensure `dataService` getters return synchronous, fast results from in-memory collections
- [x] Enforce Dataset Swapping: when `hasIntegratedCatalog` is true, filter out/exclude all `source: "SRD"` records so zero duplicates appear
- [x] Add unit tests in `checks/compendiumStorage.test.ts` verifying storage hydration, cutover swapping, and fallback behavior
