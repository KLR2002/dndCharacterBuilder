# 02: SRD Baseline Catalog Pruning and Source Tagging

**What to build:**
Prune the bundled JSON catalog files in `src/data/*.json` down to strictly 2014 SRD 5.1 content (12 base classes with 1 archetype each, 9 base SRD races with SRD subraces, SRD spells, SRD items/monsters, Grappler feat, and Acolyte background). Tag all baseline records with `source: "SRD"`. Update `checks/catalogIntegrity.test.ts` to validate the SRD baseline without failing on sourcebook comparisons.

**Blocked by:** 01 (CLI Scraper Conditions Integration)

**Status:** closed

- [x] Prune `src/data/races.json` to SRD 5.1 races (Dragonborn, Dwarf, Elf, Gnome, Half-Elf, Half-Orc, Halfling, Human, Tiefling) with `source: "SRD"`
- [x] Prune `src/data/classes.json` to 12 SRD classes and 1 archetype each (Berserker, Lore, Life, Land, Champion, Open Hand, Devotion, Hunter, Thief, Draconic, Fiend, Evocation) with `source: "SRD"`
- [x] Prune `src/data/spells.json` to SRD spells with `source: "SRD"`
- [x] Prune `src/data/items.json`, `backgrounds.json`, `feats.json`, `beasts.json`, and `conditions.json` to SRD 5.1 contents tagged with `source: "SRD"`
- [x] Update `checks/catalogIntegrity.test.ts` to assert that the baseline dataset contains only SRD entities
- [x] Verify test suite passes against the clean SRD baseline
