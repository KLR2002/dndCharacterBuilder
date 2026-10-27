# 07: Race picks and migration

**What to build:** The race pick shapes. A race that lets the player choose the casting ability (Aarakocra, Fairy, Githyanki and the other MPMM races) shows the choice in the ancestry section with the race's other choices, and the card uses it. Filter picks on races (Wood Elf Magic's druid cantrip, Kobold's sorcerer cantrip, the High Elf and half-elf high-descent wizard cantrip) use the pick mechanism from tickets 02 and 03. A saved character that holds the old pick (the High Elf cantrip in rule choices or under the legacy racial owner key) is migrated on load to the new storage; a pick that no longer matches raises a review notice and the legacy racial entry is released from known spells.

**Blocked by:** 03, 06

**Status:** done

**Landed:** race and subrace grants take picks and a casting ability through the feat machinery (`GrantedSpellPicks`, renamed from `FeatSpellPicks`); the High Elf special case and its ancestry state are gone; saved High Elf and Half-Elf cantrips migrate on load from the legacy rule choice and the `racial__innate` known spell. Wood Elf carries no grant in the tracked data, so the live test uses Elf (Kaladesh) / Vahadar.

- [x] Engine tests against an invented catalog: a race with a chosen ability; a race with a filter cantrip pick; changing race releases the picks with a notice; a character saved with the old High Elf pick gets the same cantrip on its card after loading; an unmatched legacy pick raises a notice.
- [x] The ancestry section shows the ability and cantrip controls with the shared controls.
- [x] The old special cases for the High Elf cantrip in the ancestry engine and the old reader are removed.
- [x] `check:live` asserts a Wood Elf (or equivalent real race) offers the druid cantrip filter and an MPMM race offers the ability choice.
- [x] `npm run check:all` and `npm run check:live` pass.
