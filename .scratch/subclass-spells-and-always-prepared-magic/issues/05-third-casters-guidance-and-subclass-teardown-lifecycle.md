# 05: Third-Casters Guidance and Subclass Teardown Lifecycle

**What to build:**
End-to-end third-caster UI guidance and automated subclass change teardown.
In `SpellsTab.tsx`, provide school indicators, quick-filter chips (`[Abjuration & Evocation]` for Eldritch Knight, `[Enchantment & Illusion]` for Arcane Trickster), and a rules guidance banner explaining the 2014 school restrictions and unrestricted level slots (3, 8, 14, 20).
In the Builder tab, implement automated clean teardown when switching an existing subclass:
1. Clear obsolete subclass `ruleChoices` (such as Land Biome or Divine Affinity).
2. Clear `subclassSpellSwaps`.
3. Remove old subclass resource counters.
4. If a Warlock changes patron, check if `character.knownSpells` contains spells exclusive to the former patron's expanded list; if found, present a warning modal offering to replace or unlearn the illegal spells.

**Blocked by:** 02 (Warlock Patron Expanded Lists and Divine Soul Access), 03 (Sorcerer Origin Spells, Swaps, and Ranger Conclaves), 04 (Subclass Cantrips and Builder Rule Choices).

**Status:** closed

- [x] In `SpellsTab.tsx`, add school badges, filter chips (`[Abjuration & Evocation]`, `[Enchantment & Illusion]`), and guidance banner for Eldritch Knight and Arcane Trickster
- [x] Implement `teardownSubclass(character, className)` in `src/rules/builderTransitions.ts`
- [x] Clear subclass `ruleChoices`, `subclassSpellSwaps`, and obsolete subclass resource counters when changing subclass in `ClassProgressionSection.tsx`
- [x] Implement Warlock orphaned patron spells detector and warning modal
- [x] Verify with unit tests in `checks/subclassSpells.test.ts` and `checks/builderTransitions.test.ts`
