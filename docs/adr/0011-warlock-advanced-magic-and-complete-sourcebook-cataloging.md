# 0011: Warlock Advanced Magic and Complete Sourcebook Cataloging

## Context

Character progression for Warlocks and sourcebook content management required closing several foundational mechanical gaps:
1. **Mystic Arcanum (Levels 11, 13, 15, 17)**:
   Warlocks gain 6th-, 7th-, 8th-, and 9th-level spells called *Mystic Arcanum*. Unlike standard casters or Pact Magic slots, Arcanum spells do not consume spell slots and cannot be cast using lower-level pact slots. Each Arcanum spell can be cast exactly once per Long Rest without expending a spell slot. Previously, Warlock spell progression terminated at 5th-level Pact Slots with no representation for high-tier Arcanum magic or their 1/Long Rest usage tracking.
2. **Pact of the Tome & Cross-Class Cantrips**:
   Choosing *Pact of the Tome* at 3rd level grants a *Book of Shadows* with 3 cantrips chosen from any class's spell list, using Charisma as the spellcasting ability. Previously, only the text boon was stored without generating cantrip selection or synchronizing into the character's Warlock spell profile.
3. **Book of Ancient Secrets & Adventure Ritual Ledger**:
   The *Book of Ancient Secrets* invocation requires *Pact of the Tome* and grants ritual casting of Warlock spells, two 1st-level starting rituals from any class, and the ability to scribe discovered ritual spells during adventures (up to $\lceil \text{Warlock Level}/2 \rceil$). This necessitates both a starting rule choice and a persistent ritual ledger that never interferes with Warlock spells-known limits.
4. **Source-Agnostic Core Feature Naming**:
   Hardcoding source prefixes (such as `PHB__`) on core class features created brittle rule choice IDs. Feature choices must use clean, class-scoped identifiers (`Warlock__Pact of the Tome__Cantrips`, `Warlock__Mystic Arcanum 11`) independent of specific sourcebook prefixes.
5. **Universal 2014 Sourcebook Cataloging & Settings UX**:
   5eTools indexes ~60 official sourcebooks and supplements (Core, Supplements, Campaign Settings, Adventures, Plane Shift). Without structured categorization and bulk controls in Settings, content from optional supplements (such as *Ambition Domain* from *Plane Shift: Amonkhet*) could leak into builder selection menus without user awareness or toggleability.

## Decision

1. **Dedicated Mystic Arcanum Cards & Usage Tracking**:
   - Model Arcanum choices in `character.ruleChoices` via `Warlock__Mystic Arcanum 11`, `13`, `15`, `17`, each offering all Warlock spells of exactly that tier from active sourcebooks.
   - On `SpellsTab.tsx`, render a dedicated **"Mystic Arcanum"** card section displaying 6th, 7th, 8th, and 9th level tiers with spell metadata, save DC, attack bonus, and a `[Cast (1/Long Rest)]` usage toggle.
   - Track daily expenditures in `character.mysticArcanumSpent?: Record<number, boolean>` (e.g. `{ 6: true }`).
   - In `RestModal.tsx`, Long Rests automatically restore all Arcanum uses by resetting `mysticArcanumSpent = {}`. Short Rests leave Arcanum uses unchanged.

2. **Pact of the Tome Cantrips Synchronization**:
   - Generate rule choice `Warlock__Pact of the Tome__Cantrips` (choose: 3, all cantrips across all classes gated by `activeBooks`).
   - Synchronize chosen cantrips into `character.knownSpells` with `ownerKey: "Warlock__Tome"`, `ability: "cha"`, rendering with badge `[Pact of the Tome]` under Warlock Cantrips.
   - Teardown of Pact Boon purges synchronized Tome cantrips.

3. **Isolated Ritual Book Ledger**:
   - Store inscribed rituals in `character.ritualBook?: { name: string; source: string; level: number; isStarting?: boolean }[]`.
   - Provide a rule choice `Warlock__Book of Ancient Secrets__Starting Rituals` for the 2 starting 1st-level rituals.
   - In `SpellsTab.tsx`, render a **"Ritual Book (Book of Ancient Secrets)"** card allowing ritual-only casting and an "Inscribe Ritual" modal gated by $\le \lceil \text{Warlock Level}/2 \rceil$ and `activeBooks`.
   - Scribed rituals remain strictly isolated from `knownSpells` to avoid polluting standard Warlock spells-known counters.

4. **Clean Class-Scoped Rule Choice IDs**:
   - Omit hardcoded `PHB__` prefixes on core class features, using canonical identifiers (`Warlock__Pact of the Tome__Cantrips`, `Warlock__Book of Ancient Secrets__Starting Rituals`).

5. **Comprehensive Sourcebook Pipeline & Grouped Settings**:
   - Add `dnd5eToolsScrap/src/scrapers/books.ts` to ingest `data/books.json` into `src/data/books.json` (`npm run scrape:books`).
   - In `src/constants/books.ts`, classify all 2014 books into 5 distinct categories:
     - Core Rules (PHB, DMG, MM)
     - Rule Supplements (XGE, TCE, MPMM, FTD, BGG, BMT, etc.)
     - Campaign Settings (SCAG, ERLW, EGW, GGR, MOT, VRGR, AAG, SCC, SatO, etc.)
     - Adventures (CoS, ToA, WDH, WDMM, IDRotF, BGDIA, WBtW, etc.)
     - Plane Shift & Extras (PSA, PSI, PSK, PSZ, PSD, PSX, LR, TP, OGA)
   - In Settings, provide category accordions with bulk "Enable All" and "Disable All" controls.
   - Enforce active sourcebook filters across all builder pickers (classes, subclasses, races, feats, spells). If a source is disabled while in use, flag in `character.needsReview`.

## Consequences

- Complete 2014 RAW coverage for Warlock high-tier casting (Mystic Arcanum) and grimoire magic (Pact of the Tome, Book of Ancient Secrets).
- Clean separation between standard spell slot expenditure, pact magic, and daily arcanum uses.
- Zero interference between the ritual ledger and class spells-known limits.
- Full cataloging of all ~60 official 2014 sourcebooks with effortless bulk management in user Settings.
