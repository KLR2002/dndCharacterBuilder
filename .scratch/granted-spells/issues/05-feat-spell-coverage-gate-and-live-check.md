# 05: Feat spell coverage gate, reviewed marks and live check

**What to build:** A coverage test over the tracked data fails when a feat's description grants spells ("you learn … cantrip", "you can cast … spell" and the like) and the feat has neither spell grants nor a reviewed mark. Marks live in the scraper's override area in their own list. Ritual Caster, Quicksmithing, Servo Crafting and Strixhaven Mascot carry the "not modelled: the ritual book" mark; anything else the extractor cannot read is reviewed. A mark naming no feat, or on a feat that has grants, throws. A live check gate runs the same coverage over the catalog the in-app sync builds, and the live checks prove the named feats in the real catalog.

**Blocked by:** 03

**Status:** done

**Landed:** fast-forward of `worktree-agent-acbf7caaf7160e100` (tip ddda72d). `check:all` passes (1320 app, 278 scraper); `check:live` 81/81. Coverage gate over tracked data and the live catalog; 7 tracked and 33 live-only reviewed marks (no casting ability in the grant: Cartomancer, Outlands Envoy, Rune Shaper, Boon of Misty Escape, Light Bringer; ritual book: Quicksmithing, Servo Crafting, Strixhaven Mascot, Ritual Caster; always-prepared groups: the Adepts, Boons, Mark of X, Vampire Touched and others; Genie Magic has no grant). Open items: the reader gives a notice-only card for prepared-only feats with a chosen ability (Marks, Boons) and for ritual-only named lists (Ritual Caster) that can never be filled: fix in review; Mark feats' `expanded` lists are not read; the gate mirrors the reader's shape, so it checks covered implies a reader source but not the reverse.

- [x] The coverage function reports uncovered feats and stale marks over data; unit tests with invented feats cover each.
- [x] The gate runs over the tracked data in the scraper's checks and over the live catalog in `check:live`; both pass after the marks are added (every report is reviewed in the ticket's landing note).
- [x] `check:live` asserts, in the real catalog: Magic Initiate, Strixhaven Initiate, Fey Touched and Spell Sniper carry grants; a Wizard with Magic Initiate (Cleric) evaluates to a card whose ability is Wisdom.
- [x] `npm run check:all` and `npm run check:live` pass.
