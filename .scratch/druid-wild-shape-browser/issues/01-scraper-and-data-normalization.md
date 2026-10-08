# 01: Scraper Pipeline and Beast Catalog Ingestion

**What to build:** A scraper pipeline in `dnd5eToolsScrap/` that parses official beast and elemental statblocks from 5eTools, extracts beasts up to CR 6 (excluding swarms) plus the four Circle of the Moon CR 5 Elementals (Air, Earth, Fire, Water), normalizes them into `src/data/beasts.json`, and exposes catalog access via `getBeasts(activeBooks)` in `src/services/dataService.ts`.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] A scraper module `dnd5eToolsScrap/src/scrapers/beasts.ts` fetches and resolves creature entries from 5eTools bestiary sources.
- [x] Filters creatures strictly to `type: "beast"` up to CR 6, excluding swarms (`swarm: true` or truthy).
- [x] Ingests the four Circle of the Moon Level 10 Elementals (Air Elemental, Earth Elemental, Fire Elemental, Water Elemental) from the Monster Manual (`MM`) marked with `isElementalWildShape: true`.
- [x] Normalizes each statblock into a clean `BeastData` object including name, source, size, type, CR (display string and numeric), AC, HP (average and dice formula), speeds (walk, swim, fly, climb, burrow), ability scores, senses, traits, and formatted combat actions.
- [x] Saves the generated catalog to `src/data/beasts.json`.
- [x] `dnd5eToolsScrap/package.json` includes `scrape:beasts` script and `src/index.ts` supports `--only beasts`.
- [x] `src/services/dataService.ts` exports `getBeasts(activeBooks?: string[]): BeastData[]`.
- [x] Catalog integrity test in `checks/catalogIntegrity.test.ts` verifies `src/data/beasts.json` has valid entries, no swarms, and includes the four Elementals.
