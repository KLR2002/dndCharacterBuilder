# 01: Rule Choice data in the scraper

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Traits carrying an option set expose those options as structured Rule Choice data, with the number to pick.
- [ ] The unlock level for each scraped Rule Choice is supplied by a curated table keyed by source, race, subrace and trait — not by parsing description prose.
- [ ] A test fails when a Rule Choice appears in the shipped catalog with no curated level.
- [ ] A test over the extraction logic, against a fixture reproducing the three real shapes (a variant feature set, a revelation list, a Season list), asserts option names, option counts and option descriptions survive extraction.
- [ ] Scraper model types gain the Rule Choice field, so the scraped output type-checks against it.
- [ ] The shipped catalog regenerates identically from a fresh scrape.
