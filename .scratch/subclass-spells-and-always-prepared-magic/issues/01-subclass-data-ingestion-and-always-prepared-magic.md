# 01: Subclass Data Ingestion and Always-Prepared Magic

**What to build:**
End-to-end ingestion and presentation of always-prepared subclass spells for Cleric Domains, Druid Circles (Land, Spores, Wildfire), Paladin Sacred Oaths, and Artificer Specialists.
Extract `additionalSpells` in `dnd5eToolsScrap/src/scrapers/classes.ts` into `src/data/classes.json`. Build `src/rules/subclassSpells.ts` with ephemeral derivation of always-prepared spells. In `SpellsTab.tsx`, display always-prepared spells in their respective level groups with a locked badge (`[Domain Spell]`, `[Circle Spell]`, or `[Always Prepared]`) and a disabled toggle, while separating the counter into `X / Y prepared (+ Z domain)` so the character's base preparation budget is never consumed.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Ingest `additionalSpells` (`prepared`, `known`, `expanded`) in `dnd5eToolsScrap/src/scrapers/classes.ts` and sync to `src/data/classes.json`
- [x] Implement pure rules module `src/rules/subclassSpells.ts` with `getSubclassSpells(className, subclassName, level, options)`
- [x] Support Cleric domains, Druid circles, Paladin oaths, and Artificer specialists up to 20th level
- [x] Integrate ephemeral always-prepared spells into `getClassSpellProfiles` in `src/rules/spellcasting.ts`
- [x] In `SpellsTab.tsx`, render always-prepared spells with a locked badge and disabled un-prepare toggle
- [x] Display distinct prepared counter format `X / Y prepared (+ Z domain)` in `SpellsTab.tsx`
- [x] Verify with unit tests in `checks/subclassSpells.test.ts` and `checks/spellcasting.test.ts`
