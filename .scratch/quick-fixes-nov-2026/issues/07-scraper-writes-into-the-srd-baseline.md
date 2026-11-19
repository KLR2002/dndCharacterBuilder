# 07: A scraper run writes into the SRD Baseline

**What to build:**

- **The problem.** `dnd5eToolsScrap/src/index.ts` copies its output into `src/data`:
  - `items.json` (~210)
  - `books.json` (~265)
  - `conditions.json` (~292)

  An items scrape replaces the SRD Baseline's items with all ~2000 5etools items, most of them non-SRD (ADR 0014). SRD-baseline ticket 02 hit this and restored the file by hand.
- **The fix.** The scraper writes only `dnd5eToolsScrap/data/`, and `node scripts/prune-to-srd.mjs` is the one way into `src/data`. The prune already writes items, books and conditions. Remove the three syncs, and update the scraper README if it describes them.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] A scraper check (`dnd5eToolsScrap/checks/`) reads `dnd5eToolsScrap/src/index.ts` and fails if it names `src/data`, with a message pointing at `scripts/prune-to-srd.mjs`. Show it failing before the removal.
- [ ] After `npx tsx src/index.ts --only items,books,conditions` in `dnd5eToolsScrap/` (from the cache), `git status src/data` is clean. Restore any tracked scraper data the run changed if the change is not yours to keep, and say what it was.
- [ ] `npm run check:all` passes.
