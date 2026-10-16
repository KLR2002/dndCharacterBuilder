# 01: CLI Scraper Conditions Integration

**What to build:**
Update `dnd5eToolsScrap/src/index.ts` to import and run `scrapeConditions` from `dnd5eToolsScrap/src/scrapers/conditions.ts`. Support `--only conditions`, include conditions in the default full `npm run scrape` run, emit `conditions.json` in the scraper output directory, and synchronize it to `src/data/conditions.json`.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] In `dnd5eToolsScrap/src/index.ts`, import `scrapeConditions` from `./scrapers/conditions.js` (pointing to `conditions.ts`)
- [x] Add `conditions` to the allowed categories in `parseArgs()`, help output, and category filters
- [x] Implement the `[X/X] Scraping Conditions & Statuses...` execution block saving to `conditions.json`
- [x] Add candidate path synchronization to `src/data/conditions.json`
- [x] Verify `npm --prefix dnd5eToolsScrap run scrape:options` or `npm --prefix dnd5eToolsScrap run test` runs cleanly
