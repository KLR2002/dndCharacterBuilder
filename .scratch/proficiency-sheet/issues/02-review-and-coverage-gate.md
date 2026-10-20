# 02: Review the remaining features and add the coverage gate

**What to build:** Every class feature, subclass feature and feat whose prose mentions a proficiency, language, tool or saving-throw grant is either covered by a grant (extracted or in the override file) or explicitly marked "reviewed, grants nothing". A scraper test fails on any that is neither, so a new book cannot ship with silent gaps. Diamond Soul, and any other feature granting saving-throw proficiency, counts. This ticket contains the one-time review of the candidates the extractor left over (about 80 class and subclass features and a few feats). The review is a judgment pass, so it is done as a list for the main session and a Sonnet reviewer to confirm; ambiguous items go to the user with the sentence and the proposed grant.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A scraper test scans the scraped data and fails, naming each feature, when a match is neither covered nor marked "reviewed, grants nothing".
- [ ] The test passes on the tracked scraped data after the review.
- [ ] The marks and the override entries hold names only, with no rule prose.
- [ ] The review list of every decision (grant added, or marked grants nothing) with the feature name is written to `.scratch/proficiency-sheet/review.md` for the user.
- [ ] Features that grant saving-throw proficiency (Diamond Soul and feats) are covered as saving-throw grants.
- [ ] The gate has a unit test with invented features: it fails on an uncovered match and passes once covered or marked.
- [ ] `dnd5eToolsScrap` tests and `npm run check:all` pass.
