# 0005: Supplement Spells and Alternative Spell Lists Architecture

## Context

In Fifth Edition 2014 rules, spells originate across multiple official sourcebooks (PHB, XGE, TCE, FTD, SCC, EGW, AI, AAG, etc.):
1. **Supplement Spells**: Spells introduced in expansion sourcebooks (e.g. *Control Flames*, *Toll the Dead*, *Absorb Elements* in *Xanathar's Guide to Everything*; *Silvery Barbs* in *Strixhaven*; *Ashardalon's Stride* in *Fizban's Treasury of Dragons*) are intended to belong to class spell lists whenever their originating sourcebook is active.
2. **Alternative Spell Lists (TCE Additional Class Spells)**: *Tasha's Cauldron of Everything* (TCE) expanded the spell lists of standard classes (Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard), granting existing classes access to spells defined in other books (e.g. *Aid* for Bards and Rangers, *Aura of Vitality* for Clerics and Druids).
3. **5eTools Ingestion Friction**: Upstream 5eTools data separates class associations in `sources.json` into:
   - `class`: standard base class list associations.
   - `classVariant`: supplemental and alternative class list associations, recording `name`, `source`, and `definedInSource`.
   The initial scraper implementation in `dnd5eToolsScrap/src/scrapers/spells.ts` only evaluated `class` and ignored `classVariant`, resulting in all 95 XGE spells and all cross-book TCE expansions lacking class associations.

## Decision

1. **Upstream Ingestion Normalization**:
   - Update `dnd5eToolsScrap/src/scrapers/spells.ts` to ingest both `class` and `classVariant` from `data/spells/sources.json`.
   - Native supplement spells (where `definedInSource === spell.source`) populate `spell.classes` directly.
   - Cross-book alternative grants (where `definedInSource !== spell.source`) are preserved in `spell.classVariants: { name: string; source: string; definedInSource: string }[]`.

2. **Source-Gated Spell Availability in Pure Rules Engine**:
   - Provide a pure rule helper `isSpellAvailableForClass(spell: SpellData, className: string, activeBooks?: string[]): boolean` in `src/rules/spellcasting.ts`.
   - A spell is eligible for `className` if:
     a) `spell.classes.includes(className)` (native class membership when spell is in the active library), OR
     b) `spell.classVariants` includes an entry for `className` where `activeBooks` contains `definedInSource` (e.g. `TCE` for *Aid* on Bard).
   - This ensures full flexibility across all books (XGE, TCE, FTD, SCC, EGW, etc.) without hardcoding specific book titles in business logic.

3. **SpellsTab Integration**:
   - The Add Spells picker and class spell profiles filter available spells using `isSpellAvailableForClass(s, activeProfile.className, activeBooks)` and `s.level <= activeProfile.maxSpellLevel`.

## Consequences

- All 95 XGE spells, 21 TCE spells, 7 FTD spells, and other supplement spells become immediately available to their respective classes.
- Alternative class spell lists (e.g. TCE expanded lists) become accessible automatically whenever the enabling sourcebook is selected in `activeBooks`, while remaining strictly hidden when that sourcebook is inactive.
- Backward compatibility is maintained for components and tests that inspect `spell.classes`.
