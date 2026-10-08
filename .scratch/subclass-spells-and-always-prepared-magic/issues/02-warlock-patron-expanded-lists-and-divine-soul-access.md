# 02: Warlock Patron Expanded Lists and Divine Soul Cleric Spell Access

**What to build:**
End-to-end support for Expanded Spell Lists and cross-class spell access in the "Add Spells" picker modal.
For Warlocks, Otherworldly Patron expanded spells (from Fiend, Archfey, Great Old One, Celestial, Hexblade, Fathomless, Genie, Undead, Undying) are made available to choose in the spell picker modal without automatically being learned or prepared, strictly adhering to 2014 RAW. Learning one expends one of the Warlock's normal Spells Known. For Divine Soul Sorcerers, include the complete Cleric spell list in the "Add Spells" picker, treating learned spells as Sorcerer spells using Charisma.

**Blocked by:** 01 (Subclass Data Ingestion and Always-Prepared Magic).

**Status:** closed

- [x] Update `isSpellAvailableForClass` in `src/rules/spellcasting.ts` to accept active subclass context
- [x] Make Warlock patron expanded spells eligible in the "Add Spells" picker modal when viewing the Warlock profile
- [x] Ensure learning a Warlock patron spell consumes standard spells known slots and persists in `character.knownSpells`
- [x] Grant Divine Soul Sorcerers access to the Cleric spell list in the "Add Spells" picker modal
- [x] Ensure Cleric spells learned by a Divine Soul Sorcerer use Charisma DC and attack bonus
- [x] Verify with unit tests in `checks/subclassSpells.test.ts` and `checks/spellcasting.test.ts`
