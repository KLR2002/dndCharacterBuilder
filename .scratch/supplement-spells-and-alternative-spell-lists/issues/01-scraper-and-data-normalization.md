# 01: Scraper Ingestion and Spell Schema Normalization

**What to build:**
Update the data scraper to parse both `class` and `classVariant` from 5eTools `sources.json`. Populate `spell.classes` with native classes (where `definedInSource === spell.source`) and populate `spell.classVariants` with cross-book alternative class grants. Update TypeScript definitions in `src/types/dnd5e.ts`, re-run `scrape:spells`, and update `src/data/spells.json`.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Add `SpellClassVariant` interface and optional `classVariants?: SpellClassVariant[]` property to `SpellData` in `src/types/dnd5e.ts` and `dnd5eToolsScrap/src/types/models.ts`.
- [x] Update `dnd5eToolsScrap/src/scrapers/spells.ts` to read `spellInfo.classVariant` in addition to `spellInfo.class`.
- [x] Ensure spells introduced in supplement books (e.g. XGE, FTD, TCE) where `definedInSource === raw.source` have their classes populated into `spell.classes`.
- [x] Ensure cross-book grants (where `definedInSource !== raw.source`) are stored in `spell.classVariants`.
- [x] Run scraper to regenerate `dnd5eToolsScrap/data/spells.json` and sync with `src/data/spells.json`.
- [x] Verify that XGE spells (e.g. *Control Flames*) now contain their class lists and PHB spells (e.g. *Aid*) contain their TCE class variants.
