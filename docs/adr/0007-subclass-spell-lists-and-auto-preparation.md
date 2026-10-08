# 0007: Subclass Spell Lists, Ephemeral Auto-Preparation, and Swap Persistence

## Context

In Fifth Edition 2014 rules, subclasses across various classes grant or expand spells in fundamentally different ways:
1. **Always-Prepared Spells**: Cleric Domains, Druid Circles (Land, Spores, Wildfire), Paladin Oaths, and Artificer Specialists grant spells at specific class levels that are always prepared and do not count toward the character's prepared spell limit (`preparedLimit`).
2. **Expanded Spell Lists**: Warlock Otherworldly Patrons expand the pool of spells available to learn, but do not automatically grant free known or prepared spells (strict 2014 RAW, PHB p. 108).
3. **Subclass Spells Known & School-Restricted Swaps**: TCoE Sorcerers (Clockwork Soul, Aberrant Mind) and Ranger Conclaves gain bonus spells known. Clockwork Soul and Aberrant Mind Sorcerers can replace a subclass spell upon gaining a Sorcerer level with a spell of the same level from specific schools (Abjuration/Transmutation for Clockwork; Divination/Enchantment for Aberrant) from the Sorcerer, Warlock, or Wizard lists.
4. **Subclass Selection Lifecycle**: When a player changes their subclass or class levels in the character builder, persisting subclass spells directly into `character.knownSpells` or `character.preparedSpells` creates orphaned "ghost" spells, state desynchronization, and brittle reconciliation migrations.

## Decision

1. **Upstream Ingestion of `additionalSpells`**:
   - Update `dnd5eToolsScrap/src/scrapers/classes.ts` to parse `additionalSpells` from raw 5eTools subclass data into `SubclassModel` in `src/data/classes.json`.
   - Structured categories preserved: `prepared` (auto-prepared spells), `known` (subclass spells known/cantrips), `expanded` (expanded spell lists), and choice structures.

2. **Ephemeral Runtime Derivation**:
   - Always-prepared spells (Cleric domains, Druid circles, Paladin oaths, Artificer specialists) and baseline subclass spells known (Ranger conclaves, Sorcerer origins) are derived dynamically at runtime from `(character.classes, activeBooks)` inside a dedicated `src/rules/subclassSpells.ts` module.
   - They are NOT written permanently into `character.knownSpells` or `character.preparedSpells`.
   - Subclass supremacy applies: if a subclass is active, all spells on its granted list are accessible regardless of individual spell book origin.

3. **Explicit Swap Mapping (`character.subclassSpellSwaps`)**:
   - For customizable subclass spells (Clockwork Soul, Aberrant Mind), substitutions made by the player are stored in a minimal dictionary: `character.subclassSpellSwaps?: Record<string, string>` (mapping canonical original spell name to replacement spell name).
   - This keeps character storage compact, declarative, and trivial to validate or clear upon subclass change.

4. **UI Integration & Subclass Lifecycle Contract**:
   - In `SpellsTab.tsx`, always-prepared spells render in their respective level sections with a locked badge (`[Domain Spell]`, `[Always Prepared]`, or `[Circle Spell]`) and disabled un-prepare action.
   - The prepared counter renders `X / Y prepared (+ Z domain)` to explicitly separate the standard preparation budget from auto-prepared domain spells.
   - For Warlocks, patron expanded spells are dynamically included in `isSpellAvailableForClass(spell, "Warlock", activeBooks, patronSubclass)`.
   - In the character builder, both switching subclass and deleveling below the subclass acquisition requirement (or removing the class) trigger `teardownSubclass`:
     1. Clears subclass `ruleChoices` (such as Circle of the Land Biome, Divine Soul Affinity, domain cantrip picks).
     2. Clears `subclassSpellSwaps`.
     3. Removes obsolete subclass resource counters.
     4. Warns Warlocks if changing patrons orphans patron-exclusive known spells.

## Consequences

- Clean state synchronization: changing subclass or altering class levels immediately and correctly updates the spell sheet without leftover records.
- Zero risk of violating the prepared spell budget.
- Full fidelity to 2014 rules for domain spells, warlock patron spell options, and TCoE spell replacement rules.
