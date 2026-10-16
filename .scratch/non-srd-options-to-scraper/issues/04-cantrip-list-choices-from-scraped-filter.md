# 04: Cantrip-list choices use the scraped filter

**What to build:** Acolyte of Nature, Reaper and Arcane Initiate are offered from the filter the scraper keeps on the subclass's `known` entry (`choose` filter and count). The scraper emits it as the subclass's `spellChoice.from`; one generic resolver in the app applies the filter against the Compendium and the active books. The three named cantrip resolvers are removed.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Scraper test: placeholder `known.choose` shapes yield a `spellChoice` with the filter and count
- [ ] One generic resolver offers druid cantrips, necromancy cantrips and two wizard cantrips for the three rows, scoped to active books
- [ ] Frozen ids, counts and the books each row is gated by are unchanged
- [ ] The three named resolvers (`druidCantrips`, `necromancerCantrips`, `wizardCantrips`) no longer exist
- [ ] Dual-Mode and negative tests exist at the Rule Choice interface seam
- [ ] Existing suite and characterization scenarios pass (`npm run check:all`)
