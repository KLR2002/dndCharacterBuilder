# 01: Fixed feat spells on a Spells-tab card (Telekinetic, Telepathic)

**What to build:** The tracer bullet. The feat scraper keeps a feat's structured spell grants (the same shape subclasses already carry; one shared type), the Catalog Format becomes 9, and a new reader turns the grants of every feat the character holds (ability score improvements, origin feats, class-choice feats) into Innate Magic sources, exposed through the Evaluated Character Engine. The Spells tab shows one card per source, titled by the feat, with the casting ability, save DC and attack bonus. Fixed cantrips and spells known are at will; a fixed daily or per-rest spell has a Long Rest counter that resets on a long rest. The casting ability is fixed by the grant or inherited from the feat's ability increase (Telekinetic). A Telekinetic character shows Mage Hand; a Telepathic character shows Detect Thoughts once per long rest. Granted spells never count against a class's spells known or prepared, never enter the class's known or prepared lists, and a granted spell satisfies the feat prerequisite "can cast a spell". Picks and filters are not in this ticket: an entry that needs a pick is skipped by the reader here. The existing race card keeps working from the table until ticket 06; the new cards sit beside it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The feat scraper copies `additionalSpells` onto the feat model (types shared with the subclass type); the in-app sync builds it too. Spell names are normalised as the subclass ones are. Tracked data is regenerated only through the sanctioned tools.
- [ ] `REQUIRED_CATALOG_FORMAT` is 9 and the compendium tests expect it.
- [ ] Engine tests against an invented test catalog (no real prose): a feat with a fixed cantrip gives an at-will entry; a fixed daily spell gives a counter and a long rest resets it; a fixed ability, an ability inherited from the feat's chosen increase, and two feats with different abilities each give their own DC and attack bonus.
- [ ] Granted spells appear in no class's known or prepared list and do not change the prepared or known limits (test).
- [ ] The feat-prerequisite check that a character can cast a spell is true for a character whose only spell is granted (test).
- [ ] The Spells tab renders one card per granted source with its title, ability, DC, attack bonus and spells; the existing race card is untouched.
- [ ] `npm run check:all` passes; `npm run check:live` asserts Telekinetic carries Mage Hand and Telepathic carries Detect Thoughts in the real catalog.
