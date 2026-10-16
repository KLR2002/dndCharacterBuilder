# 11: Owner-based teardown

**What to build:** Subclass teardown removes Rule Choices by looking up their id in the table and their owner, instead of matching names. The name-matching heuristics and the deprecated alias are deleted. Ids no table recognises are left alone. An import-graph check confirms there are no cycles.

**Blocked by:** 10, 06

**Status:** ready-for-agent

- [ ] Teardown cases pass for Druid, Sorcerer, Cleric, Fighter, Warlock and Artificer
- [ ] An unknown id is never removed
- [ ] The deprecated toggle alias is gone
- [ ] No import cycle among the Reconciler, transitions and choice modules
- [ ] Existing suite passes (`npm run check:all`)
