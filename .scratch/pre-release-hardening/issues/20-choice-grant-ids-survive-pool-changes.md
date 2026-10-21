# 20: Choice grant ids survive a changed pool

**What to build:** A saved pick on a choice grant stays attached when a re-scrape adds or removes an option in that choice's pool. Today the id includes the sorted pool, so a changed pool moves the id without an alias and the saved pick stays stored but invisible.

**Blocked by:** 15

**Status:** ready-for-agent

**Decision:** the owner chose to fix this before the release gate. Key choices without their pool; keep the ticket 15 ids and the position ids both resolvable as aliases.

- [ ] A test changes a choice's pool and the saved pick still resolves.
- [ ] Shipped ids and aliases stay pinned by the grant-id guard.
- [ ] `npm run check:all` passes.
