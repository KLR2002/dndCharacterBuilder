# 20: Choice grant ids survive a changed pool

**What to build:** A saved pick on a choice grant stays attached when a re-scrape adds or removes an option in that choice's pool. Today the id includes the sorted pool, so a changed pool moves the id without an alias and the saved pick stays stored but invisible.

**Blocked by:** 15

**Status:** needs-triage

**Open question:** decide before the first release that users keep saves for, since later changes would strand picks. Options: key choices on category and kind only (with a disambiguating suffix), or add an alias path when a pool changes. The pins from ticket 15 and the catalog format bump (ticket 17) are affected either way.

- [ ] A test changes a choice's pool and the saved pick still resolves.
- [ ] Shipped ids and aliases stay pinned by the grant-id guard.
- [ ] `npm run check:all` passes.
