# 02: Pure Spell Rules Resolution Engine

**What to build:**
Implement pure rules functions in `src/rules/spellcasting.ts` that evaluate whether a spell is available for a given class in a set of active resource books. Write thorough TDD tests in `checks/spellcasting.test.ts`.

**Blocked by:** 01: Scraper Ingestion and Spell Schema Normalization.

**Status:** done

- [x] Implement `isSpellAvailableForClass(spell: SpellData, className: string, activeBooks?: string[]): boolean` in `src/rules/spellcasting.ts`.
- [x] Implement `getAvailableSpellsForClass(spells: SpellData[], className: string, activeBooks?: string[]): SpellData[]` in `src/rules/spellcasting.ts`.
- [x] Ensure `isSpellAvailableForClass` verifies both `spell.classes` (native class grants) and `spell.classVariants` (where `activeBooks` contains `definedInSource`).
- [x] Ensure third-caster classes ("Eldritch Knight", "Arcane Trickster") correctly map to the Wizard spell list.
- [x] Write unit tests in `checks/spellcasting.test.ts` verifying:
  - XGE spells (e.g. *Control Flames*, *Toll the Dead*) are available to Druid/Sorcerer/Wizard when XGE is active, and unavailable when XGE is inactive.
  - Cross-book alternative spell lists (e.g. *Aid* for Bard/Ranger from TCE) are available only when TCE is active, and unavailable when only PHB is active.
  - Native PHB spells (e.g. *Aid* for Cleric/Paladin) remain available when PHB is active.
  - Flexibility across diverse supplement books (FTD, SCC, EGW) using `definedInSource` without hardcoded book titles.
- [x] Ensure all tests pass with `npm test`.
