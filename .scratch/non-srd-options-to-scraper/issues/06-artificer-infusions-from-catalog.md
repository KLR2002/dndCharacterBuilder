# 06: Artificer infusions come from the catalog

**What to build:** The scraper emits every Replicate Magic Item table row as an Artificer Infusion option (`AI`), named "Replicate Magic Item: X" with the Artificer level taken from the table caption, alongside the infusions it already emits. The umbrella record is not offered as a selectable option. The infusion module reads all infusions from the catalog's option records and the 66-entry hand-written definition table is deleted. Saved picks resolve case-insensitively, since the table text is lower-case ("Alchemy jug") and saved names are title-cased ("Alchemy Jug"). A catalog without them hides the choice and keeps saved picks.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merge `fffcffb`. Open gap: a catalog synced before this change still has `AI` records (umbrella without the flag), so it is not detected as missing; ticket 10 wires the stale flag from ticket 01.

- [x] Scraper test: a placeholder infusion with caption tables yields one `AI` option per row with the right level, and the umbrella record is flagged as non-selectable
- [x] Infusions Known offers the same infusions per level as before, from the catalog
- [x] Saved picks such as "Replicate Magic Item: Alchemy Jug" still resolve
- [x] The hand-written infusion definition table no longer exists
- [x] Active infusion rules (capacity, mundane targets, pruning) behave as before
- [x] Dual-Mode, stale-catalog and negative tests exist
- [x] Existing suite passes (`npm run check:all`)
