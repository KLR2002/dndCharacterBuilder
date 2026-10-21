# 20: Choice grant ids survive a changed pool

**What to build:** A saved pick on a choice grant stays attached when a re-scrape adds or removes an option in that choice's pool. Today the id includes the sorted pool, so a changed pool moves the id without an alias and the saved pick stays stored but invisible.

**Blocked by:** 15

**Status:** done

**Landed:** merged from `pr/20-pool-free-choice-ids` (923b348). `check:all` passes (1087 app tests, 144 scraper tests, 322 known type errors none new), scraper type check clean, layout checks green in both modes. A choice's id is `<category>:choice:<kind>` with kind `any`, `from` or `rule`; neither the pool nor the count is part of it, so a re-scrape that adds or removes an option never moves a saved pick. 100 integrated and 3 SRD choice ids changed; each changed choice carries its position id and its former pool-bearing id as aliases; regenerated records differ only in `id` and `aliases`. The grant-id pin was re-recorded to include the former pool-bearing ids. Sheet output is unchanged (characterization baselines and allowlists untouched). Known limits for the release notes: same-kind siblings in one feature are told apart by order (`~2`, `~3`), so a re-scrape that reorders them moves picks (real case: the Kensei melee/ranged pair); a change of a choice's kind (any to a names list or back) moves the id with no alias; an old cache keeps its former ids and a pick saved under a new id stays hidden until the catalog is re-synced (format bump is ticket 17).

**Decision:** the owner chose to fix this before the release gate. Key choices without their pool; keep the ticket 15 ids and the position ids both resolvable as aliases.

- [x] A test changes a choice's pool and the saved pick still resolves.
- [x] Shipped ids and aliases stay pinned by the grant-id guard.
- [x] `npm run check:all` passes.
