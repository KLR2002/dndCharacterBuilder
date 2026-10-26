# 02: Flat and proficiency-bonus Initiative Bonuses (Alert, Aura of the Sentinel)

**What to build:** The extractor also reads the other two kinds of Initiative Bonus, on feats as well as class and subclass features. Alert gives +5 initiative. Aura of the Sentinel adds the character's proficiency bonus to initiative from the level the feature is gained, and the bonus grows with the proficiency bonus. Both stack with ticket 01's ability-modifier bonuses and show as their own lines in `initiativeBreakdown`, labelled with the feature's or feat's name.

**Blocked by:** 01

**Status:** done

**Landed:** fast-forward of `worktree-agent-a15287f36c4aa222c` (tip b5cfe60). `check:all` passes (1257 app, 222 scraper); `check:live` 62/62. Feats carry the bonus; Alert's 2014 print is `flat` 5 and its 2024 print is `proficiency` ("When you roll Initiative, you can add your Proficiency Bonus to the roll"); Aura of the Sentinel is `proficiency`. A bonus gained by another creature is reported, not given to the holder. Catalog format stays 8 (no release has shipped it). Open items: Avatar of Battle, Tandem Footwork and roll-trigger sentences (Hound of Ill Omen) still unparsed, for ticket 04's marks; Hare-Trigger now extractable, wired in ticket 03.

- [x] The extractor turns "a +N bonus to initiative" into a `flat` bonus and "a bonus to initiative equal to your proficiency bonus" / "add your proficiency bonus to your initiative rolls" into a `proficiency` bonus. Sentence-level tests (invented sentences) cover both, and cover sentences that must not match (a bonus to damage or to AC that mentions neither initiative).
- [x] Feats carry an Initiative Bonus end to end: scraper, enriched tracked data, app catalog types, `grantedFeatures` (a feat taken through an ability score improvement or as an origin feat), evaluated initiative.
- [x] Engine tests against the invented test catalog: a feat with a flat bonus adds it; a proficiency bonus grows with character level; ability, flat and proficiency bonuses from a feat and two classes all stack; breakdown order and labels.
- [x] `check:live` asserts (each print's own bonus) that Alert carries `flat` 5 or `proficiency`, and Aura of the Sentinel carries `proficiency` in the real catalog.
- [x] `npm run check:all` and `npm run check:live` pass.
