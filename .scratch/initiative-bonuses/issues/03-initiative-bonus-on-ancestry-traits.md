# 03: An ancestry trait can carry an Initiative Bonus (Hare-Trigger)

**What to build:** The Initiative Bonus sits on the ancestry trait that grants it, so a Harengon adds its proficiency bonus to initiative, and a variant ancestry or lineage that replaces or drops the trait drops the bonus with it. The scraper writes the bonus on the trait itself (not on the race record), the tracked race data is brought up to date through the sanctioned tooling, and the bonus shows in the breakdown labelled with the trait's name.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The race and subrace scrapers extract an Initiative Bonus onto each trait whose prose adds a number to initiative, using the same extractor and override list as tickets 01 and 02. The Initiative Bonus is carried on the trait through the app's catalog trait type.
- [ ] The tracked race data is updated by extending the sanctioned enrich tool to cover race and subrace traits (never by hand, and without a full scraper run).
- [ ] Engine tests against the invented test catalog: a race trait adds its bonus; a trait suppressed by a variant ancestry or a lineage replacement adds nothing; a subrace trait adds its bonus.
- [ ] `check:live` asserts that Hare-Trigger carries a `proficiency` bonus in the real catalog and that a Harengon character's initiative includes the proficiency bonus.
- [ ] `npm run check:all` and `npm run check:live` pass.
