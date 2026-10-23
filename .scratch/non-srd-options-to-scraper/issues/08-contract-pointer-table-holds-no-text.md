# 08: Contract: the pointer table holds no text

**What to build:** All sixteen rows are pointers: the old option-text fields are removed from the row type and Primal Knowledge's two rows convert. Guard tests prove every frozen id resolves in the fixture catalog, every option name the old table offered resolves directly or by alias, every pick count matches the scrape, and the full characterization scenarios pass against the fixture catalog. The dead `book` option gate and unused exports are removed.

**Blocked by:** 03, 04, 05

**Status:** done

**Landed:** merge `4894f2c`. `npm run check:all` passed after the merge (720 app tests, 31 scraper tests). The unchanged characterization test passes in SRD and integrated modes.

- [x] No row carries description text; the row type has no option-text field
- [x] Frozen-id, old-name and pick-count guard tests pass
- [x] Characterization scenarios pass unchanged against the fixture catalog
- [x] No leftover references to the removed resolvers, lists or fallback
- [x] Existing suite passes (`npm run check:all`)
