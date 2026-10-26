# 06: Race spell grants from the Catalog replace the hardcoded table

**What to build:** The race and subrace scraper keeps spell grants. The reader gives a race's fixed grants (Drow, Tiefling, Firbolg, Triton, Githyanki, Githzerai, Svirfneblin, Genasi, Aasimar and the rest) as a card per race source, each gated by total character level where the grant has a level, with the same at-will, daily and per-rest handling as feats. The hardcoded race table is deleted. Counter ids already saved for racial daily spells keep working, so usage survives the update. The Spells tab shows the race card through the same card as feats. High Elf and Tiefling still work on the SRD Baseline (they are SRD), and Drow is absent from it, as it always was.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The race and subrace scrapers copy spell grants, including those on variant and lineage races; the in-app sync builds them too.
- [ ] Engine tests against an invented catalog: level-gated fixed grants appear from their level; per-rest counters reset on a long rest; a saved counter id from the old table keeps its used state.
- [ ] The table, its matchers and its tests are gone; no race or subrace name remains in app code for spells (a guard test searches for the table's former names in the rules folder).
- [ ] The SRD Baseline test for High Elf and Tiefling passes without a synced catalog.
- [ ] `check:live` asserts Drow (Dancing Lights at level 1, Faerie Fire at level 3, Darkness at level 5), Tiefling and Firbolg from the real catalog.
- [ ] `npm run check:all` and `npm run check:live` pass.
