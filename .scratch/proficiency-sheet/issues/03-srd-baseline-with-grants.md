# 03: SRD baseline regenerated with grants

**What to build:** The SRD baseline carries the structured grants, so SRD-only characters will get subclass and feat grants (for example the Life Domain's heavy armor) without the Integrated Catalog. It is regenerated through the existing prune script from the scraped data, as its own commit. This is the one allowed regeneration of `src/data/` for this spec; hand edits remain forbidden.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `src/data/` is regenerated only by running `node scripts/prune-to-srd.mjs`, and the commit touches nothing else.
- [ ] A check, run and reported, proves the only differences in `src/data/` are the added `grants` fields (compare before and after with those fields removed).
- [ ] The baseline still contains only SRD content; no non-SRD feature grants appear in it.
- [ ] `npm run check:all` passes.
