# 07: Race picks and migration

**What to build:** The race pick shapes. A race that lets the player choose the casting ability (Aarakocra, Fairy, Githyanki and the other MPMM races) shows the choice in the ancestry section with the race's other choices, and the card uses it. Filter picks on races (Wood Elf Magic's druid cantrip, Kobold's sorcerer cantrip, the High Elf and half-elf high-descent wizard cantrip) use the pick mechanism from tickets 02 and 03. A saved character that holds the old pick (the High Elf cantrip in rule choices or under the legacy racial owner key) is migrated on load to the new storage; a pick that no longer matches raises a review notice and the legacy racial entry is released from known spells.

**Blocked by:** 03, 06

**Status:** ready-for-agent

- [ ] Engine tests against an invented catalog: a race with a chosen ability; a race with a filter cantrip pick; changing race releases the picks with a notice; a character saved with the old High Elf pick gets the same cantrip on its card after loading; an unmatched legacy pick raises a notice.
- [ ] The ancestry section shows the ability and cantrip controls with the shared controls.
- [ ] The old special cases for the High Elf cantrip in the ancestry engine and the old reader are removed.
- [ ] `check:live` asserts a Wood Elf (or equivalent real race) offers the druid cantrip filter and an MPMM race offers the ability choice.
- [ ] `npm run check:all` and `npm run check:live` pass.
