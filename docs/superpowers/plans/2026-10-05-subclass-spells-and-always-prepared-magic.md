# Spec: Subclass Spells and Always-Prepared Magic

## Problem Statement

In Fifth Edition Dungeons & Dragons (2014 rules), spellcasting subclasses grant spells through distinct mechanics that are currently unsupported or mismanaged in the character builder:
1. **Always-Prepared Casters (Cleric, Druid, Paladin, Artificer)**: Subclasses such as Cleric Divine Domains, Druid Circles (Circle of the Land, Spores, Wildfire), Paladin Sacred Oaths, and Artificer Specialists grant spells that are permanently prepared and do not count against the character's prepared spell limit (`preparedLimit`). Currently, players must manually prepare these spells, which incorrectly consumes their limited preparation pool.
2. **Warlock Otherworldly Patrons**: Upstream 5e 2014 rules dictate that patrons expand the list of spells a Warlock can choose from when learning spells (*Expanded Spell List*), rather than auto-preparing or auto-granting them for free. Currently, patron spells are not shown in the "Add Spells" picker modal.
3. **Sorcerer Subclasses (Clockwork Soul, Aberrant Mind, Divine Soul, Lunar Sorcery)**:
   - Clockwork Soul and Aberrant Mind grant 10 bonus spells known that do not count against spells known, with the crucial rule that one spell can be replaced on level-up with a spell of the same level from specific schools (Abjuration/Transmutation for Clockwork, Divination/Enchantment for Aberrant) from Sorcerer, Warlock, or Wizard lists.
   - Divine Soul grants an affinity spell (Good, Evil, Law, Chaos, Neutrality) and opens the entire Cleric spell list for learning Sorcerer spells.
   - Lunar Sorcery grants 15 phase-based spells across 5 levels.
4. **Subclass Cantrip Grants & Choices**: Features like Light Cleric (*Light*), Grave Cleric (*Spare the Dying*), Celestial Warlock (*Light*, *Sacred Flame*), Nature Cleric (1 chosen Druid cantrip), and Arcana Cleric (2 chosen Wizard cantrips) are missing.
5. **Third-Casters (Eldritch Knight & Arcane Trickster)**: Lack school indicator badges and filter guidance for their Abjuration/Evocation and Enchantment/Illusion requirements.
6. **Subclass Teardown & Lifecycle**: Changing a subclass or deleveling leaves orphan spells and stale choices behind because there is no automated teardown.

## Solution

1. **Scraper Pipeline Extension**: Update `dnd5eToolsScrap/src/scrapers/classes.ts` to ingest `additionalSpells` from raw 5eTools subclass data into `SubclassModel` in `src/data/classes.json`.
2. **Pure Rules Engine (`src/rules/subclassSpells.ts`)**:
   - Provide `getSubclassSpells(className, subclassName, classLevel, options)` returning `{ prepared: SpellData[], known: SpellData[], expanded: SpellData[], cantrips: SpellData[] }`.
   - Implement ephemeral runtime derivation: always-prepared spells and default subclass spells known are never written permanently into `character.knownSpells` or `character.preparedSpells`, ensuring zero orphan data when changing subclasses.
   - Apply subclass supremacy: if a subclass sourcebook is active, all spells on its granted list are accessible regardless of individual spell sourcebook toggles.
3. **Explicit Subclass Spell Swaps**: For Clockwork Soul and Aberrant Mind, persist only player substitutions in `character.subclassSpellSwaps?: Record<string, string>`. Validate replacements strictly against TCoE school, spell level, and class list rules.
4. **Rule Choice & Cantrip Builder Integration**:
   - Add `RuleChoice` options for Circle of the Land Biome (Arctic, Coast, Desert, Forest, Grassland, Mountain, Swamp, Underdark) and Divine Soul Affinity (Good, Evil, Law, Chaos, Neutrality) in the Builder tab.
   - Add prompt pickers for Nature Cleric (1 Druid cantrip), Death Cleric (1 Necromancy cantrip), and Arcana Cleric (2 Wizard cantrips).
   - Implement automated teardown: changing subclass in Builder automatically clears obsolete subclass `ruleChoices`, `subclassSpellSwaps`, and subclass-specific resource counters, and displays a warning dialog if a Warlock holds orphaned patron spells.
5. **Spells Tab UX Polish**:
   - Always-prepared spells render with a locked badge (`[Domain Spell]`, `[Circle Spell]`, `[Always Prepared]`) and disabled prepare toggles.
   - Prepared counter displays `X / Y prepared (+ Z domain)` so the player's core preparation budget remains distinct and untouched.
   - Warlock and Divine Soul spell pickers display expanded patron spells and Cleric spells seamlessly.
   - Eldritch Knight and Arcane Trickster spell pickers display school badges, quick-filter chips, and guidance banners.

## User Stories

1. As a 1st-level Life Domain Cleric, I want *Bless* and *Cure Wounds* to appear automatically as prepared spells in my Spells tab, so that I don't have to manually prepare them.
2. As a 1st-level Life Domain Cleric, I want my prepared spells counter to display `4 / 4 prepared (+ 2 domain)` (assuming +3 WIS), so that I know my domain spells did not consume my daily preparation limit.
3. As a 3rd-level Life Domain Cleric, I want *Lesser Restoration* and *Spiritual Weapon* to automatically unlock and appear as prepared spells without any manual action.
4. As a Cleric, I want my domain spells to show a locked badge (`[Domain Spell]`) and have a disabled un-prepare toggle, so that I cannot accidentally un-prepare them.
5. As a 3rd-level Circle of the Land Druid, I want to choose my Land Biome (such as Coast or Mountain) in the Builder tab, so that my Circle Spells reflect my chosen terrain.
6. As a 3rd-level Coast Druid, I want *Mirror Image* and *Misty Step* to appear as always-prepared circle spells with a `[Circle Spell]` badge.
7. As a 2nd-level Circle of Spores Druid, I want *Chill Touch* to automatically appear as a subclass cantrip, and at 3rd level *Blindness/Deafness* and *Gentle Repose* to appear as always-prepared spells.
8. As a 3rd-level Oath of Devotion Paladin, I want *Protection from Evil and Good* and *Sanctuary* to automatically appear as always-prepared oath spells.
9. As a 3rd-level Battle Smith Artificer, I want *Heroism* and *Shield* to automatically appear as always-prepared specialist spells.
10. As a 1st-level Fiend Warlock, I want to see *Burning Hands* and *Command* available to choose in the "Add Spells" picker modal, so that I can learn them using my standard Warlock spells known budget.
11. As a Warlock player, I want patron spells in the "Add Spells" picker NOT to be auto-learned, so that the strict 2014 rules for Expanded Spell Lists are respected.
12. As a 1st-level Light Domain Cleric, I want the *Light* cantrip to automatically appear in my cantrip list with a `[Subclass Cantrip]` badge.
13. As a 1st-level Nature Domain Cleric, I want the Builder tab to prompt me to choose 1 Druid cantrip, and once chosen, have it appear in my sheet with a `[Subclass Cantrip]` badge.
14. As a 1st-level Arcana Domain Cleric, I want the Builder tab to prompt me to choose 2 Wizard cantrips, and have them appear as cleric cantrips on my sheet.
15. As a 1st-level Divine Soul Sorcerer, I want to select my Divine Affinity (Good, Evil, Law, Chaos, Neutrality) in Builder, granting me the corresponding affinity spell (*Cure Wounds*, *Inflict Wounds*, *Bless*, *Bane*, or *Protection from Evil and Good*).
16. As a Divine Soul Sorcerer, I want the "Add Spells" picker to include both Sorcerer and Cleric spells, so that I can learn spells from either list using Charisma as my spellcasting ability.
17. As a 1st-level Clockwork Soul Sorcerer, I want *Alarm* and *Protection from Evil and Good* automatically granted as bonus spells known that don't count against my sorcerer spells known count.
18. As a Clockwork Soul Sorcerer upon leveling up, I want to tap "Swap Spell" on *Alarm* and choose an Abjuration or Transmutation spell of 1st level from the Sorcerer, Warlock, or Wizard lists (such as *Shield* or *Expeditious Retreat*).
19. As a 1st-level Aberrant Mind Sorcerer, I want *Mind Sliver*, *Arms of Hadar*, and *Dissonant Whispers* automatically granted as bonus spells known.
20. As an Aberrant Mind Sorcerer upon leveling up, I want to tap "Swap Spell" on *Arms of Hadar* and select a Divination or Enchantment spell of 1st level from Sorcerer, Warlock, or Wizard (such as *Charm Person* or *Hex*).
21. As a 3rd-level Gloom Stalker Ranger, I want *Disguise Self* to automatically appear as a bonus known spell without consuming my ranger spells known count.
22. As an Eldritch Knight Fighter, I want to view Wizard spells in the "Add Spells" picker with clear school badges and quick-filter chips for `[Abjuration & Evocation]` alongside a helpful rules reminder.
23. As an Arcane Trickster Rogue, I want quick-filter chips for `[Enchantment & Illusion]` in my spell picker.
24. As a player switching my Cleric from Life Domain to Light Domain in Builder, I want my Life Domain spells to cleanly disappear and Light Domain spells (plus *Light* cantrip) to take their place immediately.
25. As a player switching my Warlock patron from Fiend to Hexblade, I want the app to warn me if I currently know *Fireball* (a Fiend-exclusive spell) so I can replace or unlearn it.
26. As a player changing subclass, I want all obsolete subclass resource counters and `subclassSpellSwaps` to be purged immediately with zero leftover ghost records.
27. As a player playing with only PHB and TCE enabled, I want Clockwork Soul spells (including TCE spells like *Summon Construct*) to be fully functional because the subclass source is active.
28. As a developer, I want all subclass spell logic isolated in pure, highly-testable functions in `src/rules/subclassSpells.ts` with comprehensive unit test coverage.

## Implementation Decisions

- **Domain Terminology**: Strictly complies with `GLOSSARY.md` terms for *Always-Prepared Spells*, *Expanded Spell List*, *Subclass Spells Known*, *Subclass Spell Replacement*, and *Rule Choice*.
- **Architectural Record**: Documented in ADR 0007 (`docs/adr/0007-subclass-spell-lists-and-auto-preparation.md`).
- **Scraper Ingestion**:
  Update `dnd5eToolsScrap/src/scrapers/classes.ts` and `SubclassModel` in `dnd5eToolsScrap/src/types/models.ts` to capture `additionalSpells` from raw 5eTools class JSON.
  `SubclassAdditionalSpells`:
  ```ts
  export interface SubclassAdditionalSpells {
    prepared?: Record<string, string[]>; // level -> spell names
    known?: Record<string, (string | { choose?: string; count?: number })[]>;
    expanded?: Record<string, string[]>; // level -> spell names
    innate?: Record<string, string[]>;
    name?: string; // e.g. "Good", "Full Moon"
  }
  ```
- **Rules Engine Module (`src/rules/subclassSpells.ts`)**:
  - `getSubclassSpells(className: string, subclassName: string, classLevel: number, options?: SubclassSpellOptions): SubclassSpellsResult`
  - Returns:
    - `prepared: SpellData[]`: Always-prepared spells for that level.
    - `known: SpellData[]`: Subclass spells known for that level (incorporating any active `subclassSpellSwaps`).
    - `expanded: SpellData[]`: Subclass expanded spells eligible in the spell picker.
    - `cantrips: SpellData[]`: Subclass cantrips granted or chosen.
- **Character Persistence (`src/types/character.ts`)**:
  - Add optional `subclassSpellSwaps?: Record<string, string>;` to `Character`.
  - Add optional `subclassCantrips?: Record<string, string[]>;` (or use existing `ruleChoices`).
- **Spell Profile Augmentation (`src/rules/spellcasting.ts`)**:
  - In `getClassSpellProfiles(character, opts)`:
    - Compute `subclassResult = getSubclassSpells(c.className, c.subclass, c.level, ...)`.
    - Inject `alwaysPreparedSpells` and `subclassKnownSpells` into profile.
    - Calculate `preparedCount` as user-prepared spells, with `alwaysPreparedCount` tracked alongside.
  - In `isSpellAvailableForClass(spell, className, activeBooks, context)`:
    - Accept optional subclass context (e.g. Warlock patron, Divine Soul affinity).
    - If Warlock has a patron with expanded spells, return true if `spell.name` matches the patron's expanded list.
    - If Sorcerer has Divine Soul, return true if `spell.classes.includes("Cleric")`.
- **Builder Lifecycle & Teardown**:
  - When changing subclass in `builderTransitions.ts` / `ClassProgressionSection.tsx`:
    - Remove old subclass `ruleChoices`.
    - Clear `subclassSpellSwaps`.
    - Prune subclass-specific resource counters.
    - Validate existing `knownSpells` and provide warning for orphaned patron spells.

## Testing Decisions

- **Test Quality**: Tests must verify observable behavior (profile outputs, prepared spell counts, availability filters, and teardown outcomes) rather than internal helper implementation details.
- **Pure Rules Coverage (`checks/subclassSpells.test.ts`)**:
  - Cleric domain spells progression across levels 1, 3, 5, 7, 9.
  - Druid Circle of the Land terrain selection (Coast vs Mountain).
  - Druid Circle of Spores and Wildfire circle spells.
  - Paladin Sacred Oath always-prepared spells.
  - Artificer Specialist always-prepared spells.
  - Warlock Otherworldly Patron expanded list eligibility (does not auto-prepare or auto-learn).
  - Sorcerer Clockwork Soul and Aberrant Mind baseline spells and school-restricted swaps.
  - Sorcerer Divine Soul affinity spell and Cleric list access.
  - Ranger Conclave bonus spells known.
  - Subclass cantrips (fixed vs choice).
  - Subclass teardown upon changing subclass in Builder.
- **Integration Coverage (`checks/spellcasting.test.ts`)**:
  - Verify `getClassSpellProfiles` reflects domain spells, distinct `X / Y (+ Z domain)` counters, and locked states.
  - Verify `isSpellAvailableForClass` under Warlock and Divine Soul subclasses.

## Out of Scope

- Spell slot recovery mechanics beyond short/long rest (e.g. Wizard Arcane Recovery, Land Druid Natural Recovery UI modals — covered in separate resource management tickets).
- Homebrew or uncurated third-party subclasses outside official WotC 5e books.
- Automatic roll automation for subclass spell effects (damage, healing math).

## Further Notes

- Subclass feature supremacy guarantees players never get locked out of subclass spells due to cross-book references.
- All code must respect the 2014 Fifth Edition rules and Expo SDK 57 requirements.
- Zero git commit/push/reset commands allowed.
