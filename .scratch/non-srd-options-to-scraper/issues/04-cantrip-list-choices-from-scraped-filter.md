# 04: Cantrip-list choices use the scraped filter

**What to build:** Acolyte of Nature, Reaper and Arcane Initiate are offered from the filter the scraper keeps on the subclass's `known` entry (`choose` filter and count). The scraper emits it as the subclass's `spellChoice.from`; one generic resolver in the app applies the filter against the Compendium and the active books. The three named cantrip resolvers are removed.

**Blocked by:** 02, 03 (sequenced after 03 only because both change the same scraper function that reads `additionalSpells`)

**Status:** ready-for-agent

- [x] Scraper test: placeholder `known.choose` shapes yield a `spellChoice` with the filter and count
- [x] One generic resolver offers druid cantrips, necromancy cantrips and two wizard cantrips for the three rows, scoped to active books
- [x] Frozen ids, counts and the books each row is gated by are unchanged
- [x] The three named resolvers (`druidCantrips`, `necromancerCantrips`, `wizardCantrips`) no longer exist
- [x] Dual-Mode and negative tests exist at the Rule Choice interface seam
- [x] Existing suite and characterization scenarios pass (`npm run check:all`)
