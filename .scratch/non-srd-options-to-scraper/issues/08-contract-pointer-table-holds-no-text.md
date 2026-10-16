# 08: Contract: the pointer table holds no text

**What to build:** All sixteen rows are pointers: the old option-text fields are removed from the row type and Primal Knowledge's two rows convert. Guard tests prove every frozen id resolves in the fixture catalog, every option name the old table offered resolves directly or by alias, every pick count matches the scrape, and the full characterization scenarios pass against the fixture catalog. The dead `book` option gate and unused exports are removed.

**Blocked by:** 03, 04, 05

**Status:** ready-for-agent

- [ ] No row carries description text; the row type has no option-text field
- [ ] Frozen-id, old-name and pick-count guard tests pass
- [ ] Characterization scenarios pass unchanged against the fixture catalog
- [ ] No leftover references to the removed resolvers, lists or fallback
- [ ] Existing suite passes (`npm run check:all`)
