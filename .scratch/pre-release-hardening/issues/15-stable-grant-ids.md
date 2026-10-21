# 15: Stable grant ids with aliases and migration

**What to build:** A grant's id depends on what the grant is, not on its position in its feature, so a re-scrape that reorders or adds a grant cannot move a saved pick. Every id shipped so far stays resolvable: each grant carries its former id as an alias, and loading a character rewrites its saved proficiency picks from the alias to the new id once.

**Blocked by:** 13, 14

**Status:** ready-for-agent

- [ ] Ids are derived from the grant's category, kind and what it names or picks from, and are unique within a feature.
- [ ] Each grant carries its former position-based id as an alias, and a character saved with a former id loads with its picks intact under the new id, covered by a test.
- [ ] Re-running the migration on an already migrated character changes nothing.
- [ ] The grant-id guard pins the shipped ids and their aliases for the tracked data; dropping or moving one fails it.
- [ ] Overrides' grants get ids by the same rule.
- [ ] Data changed only through the enrich step and the prune script; `npm run check:all` passes.
