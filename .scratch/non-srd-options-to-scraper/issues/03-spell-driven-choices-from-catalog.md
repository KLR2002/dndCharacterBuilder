# 03: Spell-driven choices come from the catalog

**What to build:** Circle of the Land biomes, Divine Soul affinities, Genie kinds and the Giant Power cantrip are offered from the catalog. The scraper lifts them from the subclass's named (or, for Giant, unnamed innate) `additionalSpells` entries into a subclass-level `spellChoice`, with a description built from the spell names. The pointer table gains four rows and the four hand-written lists are deleted. The app keeps reading `additionalSpells` for the actual spell grants.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Scraper test: placeholder `additionalSpells` shapes for a land-style, affinity-style, genie-style and giant-style subclass each yield a `spellChoice` with the right options
- [x] Biome, Divine Affinity, Genie Kind and Giant Power Cantrip are offered from the catalog with their frozen ids and unchanged option names
- [x] The Giant Power pick still keeps its known spell in sync through the Reconciler
- [x] The four hand-written option lists no longer exist
- [x] Dual-Mode, stale-catalog and negative tests exist at the Rule Choice interface seam
- [x] Existing suite and characterization scenarios pass (`npm run check:all`)
