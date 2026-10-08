# Spec: Warlock Advanced Magic and Complete Sourcebook Cataloging

## Problem Statement

Warlock progression in the character builder currently suffers from major high-tier and grimoire gaps:
1. Warlocks reach level 11, 13, 15, and 17 without any mechanism to select or track their 6th-, 7th-, 8th-, and 9th-level *Mystic Arcanum* spells. Pact magic slots terminate at 5th level, leaving high-level Warlocks incapable of casting high-level magic.
2. Players selecting *Pact of the Tome* at level 3 only receive a text boon without the ability to choose their 3 cross-class cantrips, and these cantrips do not surface on the Spells tab.
3. The *Book of Ancient Secrets* invocation lacks starting ritual spell selection and provides no in-game ritual ledger to scribe discovered rituals found during adventures.
4. Hardcoded source prefixes (`PHB__`) on core class progression choices create brittle rule choice identifiers.
5. Content from uncataloged sourcebooks (such as *Plane Shift: Amonkhet* and adventure modules) leaks into character builder menus without user toggleability in Settings, and no scraper pipeline exists to ingest the full 2014 sourcebook catalog.

## Solution

1. Introduce modular rule choices for *Mystic Arcanum* (levels 11, 13, 15, 17) with full builder respec flexibility, accompanied by a dedicated **"Mystic Arcanum"** card section on the Spells tab featuring daily cast buttons ($1/\text{Long Rest}$) and automatic reset upon taking a Long Rest.
2. Introduce a source-agnostic rule choice for *Pact of the Tome Cantrips* offering 3 cantrips from any class list, synchronizing into the Warlock profile under Charisma with a `[Pact of the Tome]` badge.
3. Introduce *Book of Ancient Secrets* starting rituals selection (2 1st-level rituals from any class) and a persistent, isolated `character.ritualBook` ledger with an in-game "Inscribe Ritual" modal gated by $\le \lceil \text{Warlock Level}/2 \rceil$ and active books.
4. Cleanse class rule choice IDs to use source-agnostic canonical identifiers (`Warlock__Pact of the Tome__Cantrips`, `Warlock__Book of Ancient Secrets__Starting Rituals`, `Warlock__Mystic Arcanum 11`).
5. Ingest all official 2014 sourcebooks from 5eTools into the data pipeline, classify them across 5 clean categories in Settings with bulk "Enable All / Disable All" controls, and strictly filter all builder option pickers by active books.

## User Stories

1. As a Warlock reaching 11th level, I want to choose one 6th-level Warlock spell as my Mystic Arcanum, so that I can cast high-level patron magic.
2. As a Warlock reaching 13th level, I want to choose one 7th-level Warlock spell as my Mystic Arcanum, so that my magical power continues to scale.
3. As a Warlock reaching 15th level, I want to choose one 8th-level Warlock spell as my Mystic Arcanum, so that I gain access to potent magical secrets.
4. As a Warlock reaching 17th level, I want to choose one 9th-level Warlock spell as my Mystic Arcanum, so that I master the pinnacle of eldritch magic.
5. As a high-level Warlock viewing the Spells tab, I want to see a dedicated Mystic Arcanum card section separate from Pact Slots, so that I understand these spells do not expend pact slots.
6. As a Warlock on the Spells tab, I want each Arcanum spell card to show its casting time, range, save DC, and attack bonus, so that I have complete tactical information.
7. As a Warlock using an Arcanum in combat, I want to tap "Cast (1/Long Rest)" to mark that tier as expended, so that I can track daily resource consumption.
8. As an injured Warlock taking a Short Rest, I want my Mystic Arcanum uses to remain expended, so that short rests only recover Pact Magic slots as per 2014 RAW.
9. As a Warlock taking a Long Rest, I want all spent Mystic Arcanum uses to automatically recover, so that my daily high-level magic is restored.
10. As a player editing a Warlock in the builder, I want to change my chosen Arcanum spell at any time, so that I can refine my character build without artificial hurdles.
11. As a player selecting Pact of the Tome at 3rd level, I want the builder to prompt me to choose 3 cantrips from any class's spell list, so that my Book of Shadows grants versatile cantrip utility.
12. As a Tome Warlock on the Spells tab, I want my 3 chosen Tome cantrips to appear under my Warlock Cantrips with a `[Pact of the Tome]` badge and calculate with Charisma, so that I can use them seamlessly.
13. As a player changing my Pact Boon from Tome to Blade or Chain, I want the synchronized Tome cantrips to be cleanly purged, so that invalid features do not linger on my sheet.
14. As a Tome Warlock taking the Book of Ancient Secrets invocation, I want the builder to prompt me to choose 2 1st-level ritual spells from any class list, so that my ritual casting begins immediately.
15. As a Tome Warlock on the Spells tab, I want to see an inscribed Ritual Book section with a `[Ritual Only]` badge, so that I can cast my rituals without confusing them with prepared spells.
16. As a Tome Warlock adventuring in a campaign, I want an "Inscribe Ritual" action that lets me add discovered ritual spells to my Ritual Book, so that I can expand my ritual grimoire during play.
17. As a Tome Warlock inscribing a ritual, I want the selection modal to only display ritual spells whose spell level is $\le \lceil \text{Warlock Level}/2 \rceil$, so that the 2014 RAW level requirement is strictly respected.
18. As a Tome Warlock, I want my inscribed rituals to be stored in an isolated ledger that never counts against my Warlock spells known limit, so that my core spellcasting progression remains untouched.
19. As a player configuring sourcebooks in Settings, I want to see all ~60 official 2014 sourcebooks neatly divided into Core Rules, Rule Supplements, Campaign Settings, Adventures, and Plane Shift / Extras, so that I can easily find specific books.
20. As a Dungeon Master or player starting a core-only campaign, I want a single "Disable All" button on the Adventures and Plane Shift categories, so that I do not have to toggle dozens of individual checkboxes.
21. As a player building a Cleric with Plane Shift disabled, I want setting-specific subclasses like *Ambition Domain (PSA)* to be hidden from the subclass selection menu, so that unapproved setting material does not leak into my game.
22. As a player who disables a sourcebook previously in use, I want the builder to flag any invalidated features in `character.needsReview`, so that I can update my character to match campaign rules.
23. As a developer running data pipeline updates, I want `npm run scrape:books` to ingest the official books registry from 5eTools, so that source cataloging is automated and up-to-date.

## Implementation Decisions

1. **Source-Agnostic Feature Rule Choice IDs**:
   - Class-level progression choices drop hardcoded `PHB__` prefixes and adopt canonical identifiers:
     - `Warlock__Pact of the Tome__Cantrips` (choose: 3, all cantrips across active books)
     - `Warlock__Book of Ancient Secrets__Starting Rituals` (choose: 2, 1st-level rituals across active books)
     - `Warlock__Mystic Arcanum 11` (choose: 1, 6th-level Warlock spell)
     - `Warlock__Mystic Arcanum 13` (choose: 1, 7th-level Warlock spell)
     - `Warlock__Mystic Arcanum 15` (choose: 1, 8th-level Warlock spell)
     - `Warlock__Mystic Arcanum 17` (choose: 1, 9th-level Warlock spell)
   - Pruning functions clean up dependent choices when deleveling or modifying prerequisites.

2. **Dedicated Mystic Arcanum UI & State**:
   - `Character` state stores daily expenditures in `mysticArcanumSpent?: Record<number, boolean>` where keys represent spell level (6, 7, 8, 9).
   - Long rest execution in the rest engine unconditionally clears `mysticArcanumSpent = {}`. Short rests preserve the object unchanged.
   - `SpellsTab.tsx` renders a distinct card section below Pact Slots displaying each unlocked Arcanum tier with spell details and an interactive toggle button.

3. **Pact of the Tome Cantrip Synchronization**:
   - Rule choice updates synchronize the 3 chosen cantrips into `character.knownSpells` with `ownerKey: "Warlock__Tome"`, `ability: "cha"`.
   - `SpellsTab.tsx` renders Tome cantrips in the Warlock cantrips list with a `[Pact of the Tome]` badge and computes DC/attack bonuses using Charisma.
   - Pact Boon removal removes any entries where `ownerKey === "Warlock__Tome"`.

4. **Book of Ancient Secrets Ritual Ledger Engine**:
   - `Character` schema adds `ritualBook?: { name: string; source: string; level: number; isStarting?: boolean }[]`.
   - Starting rituals selected in the builder are automatically seeded into `character.ritualBook` with `isStarting: true`.
   - `SpellsTab.tsx` provides a dedicated Ritual Book ledger section displaying all rituals and a modal allowing the player to scribe additional rituals where `spell.level <= Math.ceil(warlockLevel / 2)` and `spell.ritual === true`.
   - Scribed rituals never increment `knownSpells` count or prepared limits.

5. **Complete Sourcebook Cataloging & Settings UI**:
   - `dnd5eToolsScrap/src/scrapers/books.ts` fetches `data/books.json` from 5eTools, extracts codes, full titles, and publication dates, and synchronizes to `src/data/books.json`.
   - `src/constants/books.ts` categorizes all official 2014 sourcebooks into 5 groups:
     - Core Rules (PHB, DMG, MM)
     - Rule Supplements (XGE, TCE, MPMM, FTD, BGG, BMT, EEPC, VGM, MTF)
     - Campaign Settings (SCAG, ERLW, EGW, GGR, MOT, VRGR, AAG, SCC, SatO, AI)
     - Adventures (CoS, ToA, WDH, WDMM, IDRotF, BGDIA, WBtW, SKT, PotA, OotA, TftYP, GoS, PaBTSO, DSotDQ)
     - Plane Shift & Extras (PSA, PSI, PSK, PSZ, PSD, PSX, LR, TP, OGA)
   - Settings UI renders categorized accordion sections with "Enable All" and "Disable All" bulk toggle actions.
   - All builder selection pickers (races, subraces, classes, subclasses, feats, spells) filter strictly by `activeBooks`. Disabling a book in use adds a warning to `character.needsReview`.

## Testing Decisions

- Only test external behavior through public rule interfaces and component outputs; never test internal implementation details or private helpers.
- Seam 1: `subclassRuleChoices` and `warlockInvocationChoices` in `src/rules/ruleChoices.ts` verifying Arcanum, Tome, and Ritual choice generation and dynamic filtering.
- Seam 2: `getClassSpellProfiles` in `src/rules/spellcasting.ts` verifying Tome cantrips appear under Charisma with `[Pact of the Tome]` without altering prepared limits.
- Seam 3: Rest engine in `src/rules/rest.ts` verifying that Short Rest preserves `mysticArcanumSpent` while Long Rest resets all tiers to unspent.
- Seam 4: Ritual ledger operations verifying that scribed rituals enforce level caps ($\le \lceil \text{Warlock Level}/2 \rceil$) and do not pollute known spells.
- Seam 5: Catalog integrity in `checks/catalogIntegrity.test.ts` verifying that all sourcebook categories in `src/constants/books.ts` match `src/data/books.json` and support bulk activation.

## Out of Scope

- 2024 Revised ruleset modifications (strictly 2014 RAW).
- Custom homebrew sourcebook creator (only official 2014 / 5eTools sourcebooks).
- Automated transcription gold cost deduction from inventory coins (player manually tracks GP unless inventory auto-deduct is configured).

## Further Notes

- Invocations expanding the Tome (*Aspect of the Moon*, *Far Scribe*, *Gift of the Protectors*) already function under our invocation engine and now correctly require *Pact of the Tome*.
- Mystic Arcanum spells remain completely distinct from multiclass spell slots.
