# 05: Feat spell coverage gate, reviewed marks and live check

**What to build:** A coverage test over the tracked data fails when a feat's description grants spells ("you learn … cantrip", "you can cast … spell" and the like) and the feat has neither spell grants nor a reviewed mark. Marks live in the scraper's override area in their own list. Ritual Caster, Quicksmithing, Servo Crafting and Strixhaven Mascot carry the "not modelled: the ritual book" mark; anything else the extractor cannot read is reviewed. A mark naming no feat, or on a feat that has grants, throws. A live check gate runs the same coverage over the catalog the in-app sync builds, and the live checks prove the named feats in the real catalog.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The coverage function reports uncovered feats and stale marks over data; unit tests with invented feats cover each.
- [ ] The gate runs over the tracked data in the scraper's checks and over the live catalog in `check:live`; both pass after the marks are added (every report is reviewed in the ticket's landing note).
- [ ] `check:live` asserts, in the real catalog: Magic Initiate, Strixhaven Initiate, Fey Touched and Spell Sniper carry grants; a Wizard with Magic Initiate (Cleric) evaluates to a card whose ability is Wisdom.
- [ ] `npm run check:all` and `npm run check:live` pass.
