# 07: A scraper run writes into the SRD Baseline

**What to build:**

- **The problem.** `dnd5eToolsScrap/src/index.ts` copies its output into `src/data`:
  - `items.json` (~210)
  - `books.json` (~265)
  - `conditions.json` (~292)

  An items scrape replaces the SRD Baseline's items with all ~2000 5etools items, most of them non-SRD (ADR 0014). SRD-baseline ticket 02 hit this and restored the file by hand.
- **The fix.** The scraper writes only `dnd5eToolsScrap/data/`, and `node scripts/prune-to-srd.mjs` is the one way into `src/data`. The prune already writes items, books and conditions. Remove the three syncs, and update the scraper README if it describes them.

**Blocked by:** None

**Status:** needs-triage

- [ ] After `npx tsx src/index.ts --only items` in `dnd5eToolsScrap/`, `git status src/data` is clean.
- [ ] `npm run check:all` passes.
