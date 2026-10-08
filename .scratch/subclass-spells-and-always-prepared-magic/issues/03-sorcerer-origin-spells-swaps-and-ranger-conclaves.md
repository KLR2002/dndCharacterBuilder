# 03: Sorcerer Origin Spells, TCoE Swaps, and Ranger Conclaves

**What to build:**
End-to-end support for Subclass Spells Known (Clockwork Soul, Aberrant Mind, Lunar Sorcery, and Ranger Conclaves) and TCoE spell replacement rules.
Baseline subclass spells known are derived dynamically at runtime and do not count against the class's standard spells known budget. Add `character.subclassSpellSwaps?: Record<string, string>` to persist explicit player swaps. In `SpellsTab.tsx`, provide an interactive "Swap Spell" modal for Clockwork Soul and Aberrant Mind that strictly restricts replacements to allowable schools (Clockwork: Abjuration/Transmutation; Aberrant: Divination/Enchantment) of the matching spell level from Sorcerer, Warlock, or Wizard lists. Support Ranger Conclave bonus spells known (Gloom Stalker, Horizon Walker, Monster Slayer, Fey Wanderer, Swarmkeeper, Drakewarden).

**Blocked by:** 01 (Subclass Data Ingestion and Always-Prepared Magic).

**Status:** closed

- [x] Add `subclassSpellSwaps?: Record<string, string>` to `Character` type in `src/types/character.ts`
- [x] Ephemerally inject baseline subclass spells known for Clockwork Soul, Aberrant Mind, Lunar Sorcery, and Ranger Conclaves in `src/rules/subclassSpells.ts`
- [x] Apply `subclassSpellSwaps` when resolving active subclass spells
- [x] Implement `validateSubclassSpellSwap(subclass, originalSpell, replacementSpell, level, activeBooks)` in `src/rules/subclassSpells.ts`
- [x] Render a "Swap Spell" button on replaceable subclass spell cards in `SpellsTab.tsx`
- [x] Build a modal allowing the player to select an eligible replacement spell matching TCoE school/class constraints
- [x] Verify with unit tests in `checks/subclassSpells.test.ts`
