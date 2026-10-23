# 03: SRD baseline regenerated with grants

**What to build:** The SRD baseline carries the structured grants, so SRD-only characters will get subclass and feat grants (for example the Life Domain's heavy armor) without the Integrated Catalog. It is regenerated through the existing prune script from the scraped data, as its own commit. This is the one allowed regeneration of `src/data/` for this spec; hand edits remain forbidden.

**Blocked by:** 02

**Status:** done
**Landed:** (see merge "proficiency ticket 03"), check:all passed (815 app, 85 scraper). Only `src/data/classes.json` changed (10 PHB grants added); `summary.json`'s `scrapedAt` was restored to its committed value so the proof of "only grants added" holds. Guard test in `checks/srdBaselineGrants.test.ts`.

- [x] `src/data/` is regenerated only by running `node scripts/prune-to-srd.mjs`, and the commit touches nothing else.
- [x] A check, run and reported, proves the only differences in `src/data/` are the added `grants` fields (compare before and after with those fields removed).
- [x] The baseline still contains only SRD content; no non-SRD feature grants appear in it.
- [x] `npm run check:all` passes.
