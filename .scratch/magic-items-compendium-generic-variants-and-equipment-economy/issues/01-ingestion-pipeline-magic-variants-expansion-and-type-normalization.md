# 01: Ingestion Pipeline, Magic Variants Expansion & Type Normalization

**What to build:**
Expand the data scraping and catalog generation pipeline to ingest 5eTools `data/magicvariants.json` and generate pre-expanded concrete items for all standard 2014 weapons and armors alongside generic templates. Strip pipe source suffixes from raw type codes and map all items to canonical types and `itemCategory`. Provide a reliable offline fallback so the scraper and test suites run completely offline.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] In `dnd5eToolsScrap/src/scrapers/items.ts`, fetch/read `data/magicvariants.json` with an offline fallback fixture in `dnd5eToolsScrap`
- [x] Cross-product all 37 standard 2014 PHB weapons and 13 armors/shields with core DMG variants (`+1`, `+2`, `+3`, `Weapon of Warning`, `Vicious Weapon`, `Adamantine Armor`, `Mithral Armor`)
- [x] Pre-populate base damage dice, damage type, range, weight, properties, base AC, strength requirement, stealth disadvantage, rarity, attunement, `bonusWeapon`, `bonusAc`, and description for each expanded variant
- [x] Retain canonical generic templates (`Weapon, +1`, `Weapon of Warning`, `Armor, +1`, etc.) for custom weapons
- [x] Strip pipe source suffixes from raw type codes (`WD|DMG` $\to$ `WD`, `SC|DMG` $\to$ `SC`, `RD|DMG` $\to$ `RD`, `RG|DMG` $\to$ `RG`, etc.)
- [x] Map normalized type codes to canonical `itemCategory` (`Weapon`, `Armor`, `Shield`, `Potion`, `Ring`, `Rod`, `Wand`, `Scroll`, `Wondrous Item`, `Adventuring Gear`, `Tool`) and human-readable `type`
- [x] Synchronize output to `src/data/items.json` and update `ItemModel` and `ItemData` typings
- [x] Add unit tests in `checks/itemsScraper.test.ts` verifying type normalization, variant generation, and catalog completeness
