# 01: Complete 2014 Sourcebooks Ingestion, Categorization & Bulk Settings Controls

**What to build:**
A comprehensive 2014 sourcebooks pipeline and settings experience. Ingest all official sourcebooks from 5eTools `data/books.json` via a dedicated scraper, classify them in the app into five distinct categories (Core Rules, Rule Supplements, Campaign Settings, Adventures, Plane Shift & Extras), provide "Enable All" / "Disable All" bulk controls in Settings, and enforce strict active-sourcebook filtering across all character builder menus.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] Add `dnd5eToolsScrap/src/scrapers/books.ts` to fetch `data/books.json` from 5eTools and output to `src/data/books.json`, runnable via `npm run scrape:books`.
- [x] Update `src/constants/books.ts` to classify all ~60 official 2014 books into 5 clean categories: Core Rules, Rule Supplements, Campaign Settings, Adventures, and Plane Shift & Extras.
- [x] Add category-level "Enable All" and "Disable All" bulk actions in the Settings UI so users can manage entire book sets in one tap.
- [x] Enforce active-book gating across all character builder option selectors (classes, subclasses, races, feats, spells).
- [x] When an active book is disabled in Settings, check existing characters and flag any now-unsupported features in `character.needsReview`.
- [x] Add comprehensive automated tests in `checks/catalogIntegrity.test.ts` verifying all book categories, default states, and bulk toggling.
