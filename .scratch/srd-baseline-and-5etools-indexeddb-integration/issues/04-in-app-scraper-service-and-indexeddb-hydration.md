# 04: In-App Scraper Service & IndexedDB Pipeline

**What to build:**
Implement an in-app client-side scraper module in `src/services/scraper/` that executes the 10 catalog scrapers directly inside the browser using standard CORS `fetch` against the 5eTools raw GitHub mirror, emitting parsed models and saving them directly into `CompendiumStorage` (IndexedDB).

**Blocked by:** 03 (Platform Storage Adapter & Dynamic In-Memory Compendium Store)

**Status:** closed

- [x] Create `src/services/scraper/browserClient.ts` implementing a browser-safe `fetchJson` against `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/master`
- [x] Implement `src/services/scraper/runner.ts` that runs all 10 category scrapers with a progress callback (`(category: string, index: number, total: number) => void`)
- [x] Save scraped collections across all 10 categories to `CompendiumStorage` upon completion and mark `hasIntegratedCatalog: true`
- [x] Trigger `initCompendiumStore()` cutover to reload in-memory data
- [x] Add unit tests in `checks/browserScraper.test.ts` verifying runner orchestration and mock fetch processing
