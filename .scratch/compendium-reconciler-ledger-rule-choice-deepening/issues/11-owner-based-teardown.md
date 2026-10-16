# 11: Owner-based teardown

**What to build:** Subclass teardown removes Rule Choices by looking up their id in the table and their owner, instead of matching names. The name-matching heuristics and the deprecated alias are deleted. Ids no table recognises are left alone. An import-graph check confirms there are no cycles.

**Blocked by:** 10, 06

**Status:** done

- [x] Teardown cases pass for Druid, Sorcerer, Cleric, Fighter, Warlock and Artificer
- [x] An unknown id is never removed
- [x] The deprecated toggle alias is gone
- [x] No import cycle among the Reconciler, transitions and choice modules
- [x] Existing suite passes (`npm run check:all`)

## Notes

- The remaining `includes` calls in teardown (subclass spell swaps, resource counters, Giant spells) have no owner table and were left as the spec describes.
- Barbarian Primal Knowledge now survives a subclass change, where the old substring rule removed it.
- The owner maps repeat the generator's literal ids, and no test yet checks that every generated id is mapped.
