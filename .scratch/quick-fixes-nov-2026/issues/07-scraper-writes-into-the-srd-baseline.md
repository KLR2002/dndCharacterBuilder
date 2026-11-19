# 07: A scraper run writes into the SRD Baseline

**What to build:**

- **The problem.** `dnd5eToolsScrap/src/index.ts` copies its output into `src/data`:
  - `items.json` (~210)
  - `books.json` (~265)
  - `conditions.json` (~292)

  An items scrape replaces the SRD Baseline's items with all ~2000 5etools items, most of them non-SRD (ADR 0014). SRD-baseline ticket 02 hit this and restored the file by hand.
- **The fix.** The scraper writes only `dnd5eToolsScrap/data/`, and `node scripts/prune-to-srd.mjs` is the one way into `src/data`. The prune already writes items, books and conditions. Remove the three syncs, and update the scraper README if it describes them.

**Blocked by:** None

**Status:** done

**Landed:** merge a90e890 (01f6582).
- **Fix:** the three syncs to `src/data` are removed from `dnd5eToolsScrap/src/index.ts`.
- **Check:** `dnd5eToolsScrap/checks/scraper-stays-out-of-src-data.test.ts` fails if `index.ts` names `src/data`; it was red before the removal.
- **Scraper run:** a run for items, books and conditions left `src/data` clean. The run also showed upstream drift in the tracked `dnd5eToolsScrap/data/books.json` (author names, dates, groups), which was restored, not committed.
- check:all passed.

- [x] A scraper check (`dnd5eToolsScrap/checks/`) reads `dnd5eToolsScrap/src/index.ts` and fails if it names `src/data`, with a message pointing at `scripts/prune-to-srd.mjs`. Show it failing before the removal.
- [x] After `npx tsx src/index.ts --only items,books,conditions` in `dnd5eToolsScrap/` (from the cache), `git status src/data` is clean. Restore any tracked scraper data the run changed if the change is not yours to keep, and say what it was.
- [x] `npm run check:all` passes.
