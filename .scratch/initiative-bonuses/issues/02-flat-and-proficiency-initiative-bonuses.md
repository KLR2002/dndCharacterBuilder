# 02: Flat and proficiency-bonus Initiative Bonuses (Alert, Aura of the Sentinel)

**What to build:** The extractor also reads the other two kinds of Initiative Bonus, on feats as well as class and subclass features. Alert gives +5 initiative. Aura of the Sentinel adds the character's proficiency bonus to initiative from the level the feature is gained, and the bonus grows with the proficiency bonus. Both stack with ticket 01's ability-modifier bonuses and show as their own lines in `initiativeBreakdown`, labelled with the feature's or feat's name.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The extractor turns "a +N bonus to initiative" into a `flat` bonus and "a bonus to initiative equal to your proficiency bonus" / "add your proficiency bonus to your initiative rolls" into a `proficiency` bonus. Sentence-level tests (invented sentences) cover both, and cover sentences that must not match (a bonus to damage or to AC that mentions neither initiative).
- [ ] Feats carry an Initiative Bonus end to end: scraper, enriched tracked data, app catalog types, `grantedFeatures` (a feat taken through an ability score improvement or as an origin feat), evaluated initiative.
- [ ] Engine tests against the invented test catalog: a feat with a flat bonus adds it; a proficiency bonus grows with character level; ability, flat and proficiency bonuses from a feat and two classes all stack; breakdown order and labels.
- [ ] `check:live` asserts that Alert carries `flat` 5 and Aura of the Sentinel carries `proficiency` in the real catalog.
- [ ] `npm run check:all` and `npm run check:live` pass.
