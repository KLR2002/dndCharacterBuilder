# 15: Stable grant ids with aliases and migration

**What to build:** A grant's id depends on what the grant is, not on its position in its feature, so a re-scrape that reorders or adds a grant cannot move a saved pick. Every id shipped so far stays resolvable: each grant carries its former id as an alias, and loading a character rewrites its saved proficiency picks from the alias to the new id once.

**Blocked by:** 13, 14

**Status:** done

**Landed:** merged from `pr/15-stable-grant-ids` (da85cd9). `check:all` passes (1082 app tests, 140 scraper tests, 322 known type errors none new), scraper type check clean, layout checks green in both modes. Id rule: `<source>/<owner>/<feature>@<level>#<key>`, key `<category>:fixed:<sorted names>`, `<category>:choice:any`, `:from=<sorted pool>` or `:base=..;without=..;plus=..;attack=..` for weapon pools; the count is excluded; same-key siblings in a feature get `~2`, `~3`. All 666 shipped ids changed (7 carry a `~N` suffix), each grant keeps its former position id as an alias, and every regenerated record differs from before only in grant `id` and `aliases`. Saved picks move from alias to new id on reconcile, idempotent. `checks/fixtures/proficiencyGrantIds.json` pins every shipped id and alias (recorded from the starting data); mutation checks confirmed dropping or moving one fails it. Sheet output is unchanged: the four characterization baselines and their allowlists were not touched (allowlists still name former ids, which resolve through aliases). An old cache with position ids and no aliases still resolves saved picks, and a pick saved under a new id opened against an old cache is kept, not shown. The SRD prune ran in the same commit as the integrated regeneration (the pins need both to move together); its diff is id-only. Open items: choice ids include the pool, so a later re-scrape that changes a pool moves that choice's id without an alias and leaves its saved pick stored but invisible (ticket 20); the 'every tracked grant carries an alias' test was written after the data change; the catalog format bump is ticket 17.

- [x] Ids are derived from the grant's category, kind and what it names or picks from, and are unique within a feature.
- [x] Each grant carries its former position-based id as an alias, and a character saved with a former id loads with its picks intact under the new id, covered by a test.
- [x] Re-running the migration on an already migrated character changes nothing.
- [x] The grant-id guard pins the shipped ids and their aliases for the tracked data; dropping or moving one fails it.
- [x] Overrides' grants get ids by the same rule.
- [x] Data changed only through the enrich step and the prune script; `npm run check:all` passes.
