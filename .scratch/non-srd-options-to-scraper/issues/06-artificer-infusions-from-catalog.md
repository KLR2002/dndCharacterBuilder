# 06: Artificer infusions come from the catalog

**What to build:** The scraper emits every Replicate Magic Item table row as an Artificer Infusion option (`AI`), named "Replicate Magic Item: X" with the Artificer level taken from the table caption, alongside the infusions it already emits. The umbrella record is not offered as a selectable option. The infusion module reads all infusions from the catalog's option records and the 66-entry hand-written definition table is deleted. Saved picks resolve case-insensitively, since the table text is lower-case ("Alchemy jug") and saved names are title-cased ("Alchemy Jug"). A catalog without them hides the choice and keeps saved picks.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Scraper test: a placeholder infusion with caption tables yields one `AI` option per row with the right level, and the umbrella record is flagged as non-selectable
- [ ] Infusions Known offers the same infusions per level as before, from the catalog
- [ ] Saved picks such as "Replicate Magic Item: Alchemy Jug" still resolve
- [ ] The hand-written infusion definition table no longer exists
- [ ] Active infusion rules (capacity, mundane targets, pruning) behave as before
- [ ] Dual-Mode, stale-catalog and negative tests exist
- [ ] Existing suite passes (`npm run check:all`)
