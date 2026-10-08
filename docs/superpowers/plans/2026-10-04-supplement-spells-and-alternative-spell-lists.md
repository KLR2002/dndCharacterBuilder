# Spec: Supplement Spells and Alternative Spell Lists

## Problem Statement

When building or playing spellcasting characters, players find that spells from supplement sourcebooks (such as *Xanathar's Guide to Everything* [XGE], *Fizban's Treasury of Dragons* [FTD], *Explorer's Guide to Wildemount* [EGW]) do not appear in class spell lists, even when those books are enabled in active resource books. Furthermore, alternative class spell lists introduced in *Tasha's Cauldron of Everything* [TCE] (the "Additional Class Spells" feature) are completely missing, preventing classes like Bards and Rangers from learning spells like *Aid*, or Clerics from learning *Aura of Vitality*.

This occurs because 5eTools `data/spells/sources.json` stores supplement and expanded class associations under `classVariant`, which the data scraper ignored during ingestion. Consequently, all 95 XGE spells and numerous cross-book expansions were ingested with empty class lists (`classes: []`), breaking spell learning and preparation across all spellcasting classes.

## Solution

1. **Ingestion Normalization**: Update the data scraper to ingest both `class` and `classVariant` from `sources.json`. Native supplement spells (where `definedInSource === spell.source`) populate `classes: string[]`, while cross-book expansions (where `definedInSource !== spell.source`) populate `classVariants: SpellClassVariant[]`.
2. **Pure Rules Spell Resolution**: Implement `isSpellAvailableForClass(spell, className, activeBooks)` and `getAvailableSpellsForClass(spells, className, activeBooks)` in `src/rules/spellcasting.ts`, dynamically evaluating class eligibility based on active resource books without hardcoding book names.
3. **UI Integration**: Update `SpellsTab.tsx` and builder pickers to filter candidate spells using `isSpellAvailableForClass`, ensuring all active supplement spells and alternative spell lists become available strictly when their respective sourcebooks are selected.

## User Stories

1. As a player building a Wizard with XGE enabled, I want to see and learn XGE cantrips and spells like *Control Flames*, *Toll the Dead*, and *Absorb Elements*, so that I can utilize all spells from my enabled sourcebooks.
2. As a player building a Bard with TCE enabled, I want to see and learn TCE additional class spells like *Aid* and *Color Spray*, so that I can take advantage of Tasha's expanded spell list rules.
3. As a player building a Bard with only the PHB enabled, I do not want to see *Aid* on my Bard spell list, so that table restrictions are strictly respected.
4. As a player building a Cleric with only the PHB enabled, I want to see *Aid* on my Cleric spell list, so that core rules spells remain available to their original classes.
5. As a player building a Druid with Fizban's Treasury of Dragons (FTD) enabled, I want to see *Draconic Transformation* and *Summon Draconic Spirit*, so that my dragon-themed druid has access to dragon magic.
6. As a player building an Eldritch Knight Fighter or Arcane Trickster Rogue, I want access to XGE and TCE Wizard spells up to my allowed spell level, so that third-caster archetypes benefit from all active Wizard spells.
7. As a player switching active resource books on my character, I want the available spells list in the Spells tab to update immediately to reflect the new set of enabled books.
8. As a developer maintaining the scraper pipeline, I want `npm run scrape:spells` to automatically and deterministically populate native classes and class variants from cache, so that future data updates preserve all spell-class associations.
9. As a developer writing tests, I want pure rules functions like `isSpellAvailableForClass` that do not depend on React components or the filesystem, so that testing is fast and deterministic.

## Implementation Decisions

- **Domain Language**: Adheres to `GLOSSARY.md` definitions for *Class Spell List*, *Alternative Spell List*, *Supplement Spell*, and *Spellcasting Profile*.
- **Architecture**: Recorded in ADR 0005 (`docs/adr/0005-supplement-spells-and-alternative-spell-lists.md`).
- **Data Model**:
  `SpellData` in `src/types/dnd5e.ts` is expanded to include:
  ```ts
  export interface SpellClassVariant {
    name: string;
    source: string;
    definedInSource: string;
  }
  ```
  and `classVariants?: SpellClassVariant[]`.
- **Pure Rules Seam**:
  In `src/rules/spellcasting.ts`:
  - `isSpellAvailableForClass(spell: SpellData, className: string, activeBooks?: string[]): boolean`
  - Evaluates native class membership and variant class grants dynamically:
    1. Checks if `spell.classes.includes(className)`.
    2. Checks if `spell.classVariants` contains an entry for `className` where `activeBooks` includes `definedInSource`.
  - Zero hardcoded book names.
- **UI Seam**:
  In `src/components/tabs/SpellsTab.tsx`:
  - Replace the naïve `s.classes?.includes(targetCastingClass)` check in `filteredPickerSpells` with `isSpellAvailableForClass(s, targetCastingClass, activeBooks)`.

## Testing Decisions

- Tests evaluate external domain behavior against 2014 D&D rules, not internal object shapes.
- Unit tests in `checks/spellcasting.test.ts` will cover:
  1. Native supplement spells (e.g. *Control Flames*, *Toll the Dead*) available to Druid/Sorcerer/Wizard only when XGE is in `activeBooks`.
  2. Alternative spell lists (e.g. *Aid*) available to Bard/Ranger only when TCE is in `activeBooks`, while remaining available to Cleric/Paladin whenever PHB is active.
  3. General multi-book flexibility (e.g. FTD, SCC, EGW) verifying that `definedInSource` gates class access accurately.
  4. Behavior when `activeBooks` is undefined (defaults to all available books).

## Out of Scope

- Subclass spell list expansion (subclass features in `classes.json` already handle domain/oath/patron spells).
- 2024 revised ruleset spell lists (strictly 2014 rules).
- Spell point variants or homebrew spell list modifications.

## Further Notes

- Upstream 5eTools cache is already present at `dnd5eToolsScrap/.cache/data_spells_sources.json.json` and does not require network access to re-scrape.
