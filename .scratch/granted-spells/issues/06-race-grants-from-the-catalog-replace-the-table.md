# 06: Race spell grants from the Catalog replace the hardcoded table

**What to build:** The race and subrace scraper keeps spell grants. The reader gives a race's fixed grants (Drow, Tiefling, Firbolg, Triton, Githyanki, Githzerai, Svirfneblin, Genasi, Aasimar and the rest) as a card per race source, each gated by total character level where the grant has a level, with the same at-will, daily and per-rest handling as feats. The hardcoded race table is deleted. Counter ids already saved for racial daily spells keep working, so usage survives the update. The Spells tab shows the race card through the same card as feats. High Elf and Tiefling still work on the SRD Baseline (they are SRD), and Drow is absent from it, as it always was.

**Blocked by:** 01

**Status:** done

**Landed:** fast-forward of `worktree-agent-a2e9c0db294135144` (tip 935af02). `check:all` passes (1313 app, 261 scraper); `check:live` 73/73. The hardcoded race table is gone; race and subrace grants come from the catalog (SRD baseline carries High Elf and Tiefling). Source `#N` cast levels are kept as `castLevels` beside a grant (Hellish Rebuke stays 2nd level; Water Genasi Create or Destroy Water is now 2nd level as the source says). A subrace with grants of its own replaces the race's. Open items: Mark-of-X race `expanded` lists are not read (no ticket); leveled `known` spells on a race (Gnome (Deep)) are at will; `classes.json` not regenerated with `castLevels` (app ignores it for subclasses); `resolveCharacterAncestry` needs the saved race source to match the catalog's (pre-existing).

- [x] The race and subrace scrapers copy spell grants, including those on variant and lineage races; the in-app sync builds them too.
- [x] Engine tests against an invented catalog: level-gated fixed grants appear from their level; per-rest counters reset on a long rest; a saved counter id from the old table keeps its used state.
- [x] The table, its matchers and its tests are gone; no race or subrace name remains in app code for spells (a guard test searches for the table's former names in the rules folder).
- [x] The SRD Baseline test for High Elf and Tiefling passes without a synced catalog.
- [x] `check:live` asserts Drow (Dancing Lights at level 1, Faerie Fire at level 3, Darkness at level 5), Tiefling and Firbolg from the real catalog.
- [x] `npm run check:all` and `npm run check:live` pass.
