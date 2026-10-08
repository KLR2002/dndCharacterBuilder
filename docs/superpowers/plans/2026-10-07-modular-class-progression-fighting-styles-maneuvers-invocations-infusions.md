# Specification: Modular Class Progression (Fighting Styles, Battle Master Maneuvers, Eldritch Invocations, and Artificer Infusions)

## Problem Statement

Players creating martial and modular progression characters in the 5e 2014 Character Builder encounter four critical gaps across the builder, character sheet, and combat math engines:
1. **Fighting Styles Choice Gating & Passive Math**:
   - Fighter (1st & 10th level Champion), Paladin (2nd level), and Ranger (2nd level) do not offer gated Fighting Style selections from their class lists.
   - 2014 RAW forbids duplicate styles across classes or milestones, but the builder lacks cross-choice deduplication.
   - Cantrip-granting styles (*Blessed Warrior*, *Druidic Warrior*) lack automated sub-choices and spell profile synchronization.
   - Passive combat benefits (*Archery* +2 to hit, *Defense* +1 AC in armor, *Dueling* +2 damage, *Two-Weapon Fighting* ability mod to off-hand) are not automatically computed on the sheet.
2. **Battle Master Maneuvers & Superiority Dice**:
   - Battle Master Fighters do not receive maneuver pickers across level milestones (3 at 3rd, 5 at 7th, 7 at 10th, 9 at 15th level).
   - Superiority Dice ($4 \to 5 \to 6$) do not scale their die face ($d8 \to d10 \to d12$) in combat dice pools, and bonus dice from *Superior Technique* style or *Martial Adept* feat do not automatically upgrade to match the Battle Master's die face.
   - The character sheet lacks dedicated tactical action cards with dynamic Maneuver Save DC ($8 + \text{PB} + \max(\text{STR}, \text{DEX})$) and short-rest pool counters.
3. **Eldritch Invocations & Teardown Integrity**:
   - Warlocks lack an invocation progression picker scaling from 2 to 8 invocations.
   - Invocations lack prerequisite validation (Warlock level gates, Pact Boon requirements, *Eldritch Blast* spell requirements).
   - At-will spells granted by invocations (*Armor of Shadows*, *Fiendish Vigor*) do not appear on the Spells tab with zero-slot tags, and alterations to pact boons or class levels leave orphaned illegal choices behind.
4. **Artificer Infusions & Equipment Binding**:
   - Artificers lack a two-tier infusion system: Infusions Known ($4 \to 12$) and Active Infused Items ($2 \to 6$, +2 for Armorer 9).
   - Replicate Magic Item cannot be chosen multiple times for different items.
   - Active equipment enhancements (*Enhanced Defense* +1/+2 AC, *Enhanced Weapon* +1/+2 attack/damage) cannot be bound to inventory equipment or reflected in automated combat calculations.

## Solution

Implement the four modular progression systems in unified rules engines, character builder sections, and character sheet tabs:
1. **Fighting Styles Engine**:
   - Provide class-specific option pickers with cross-milestone and multiclass dynamic deduplication.
   - Provide sub-rule choices for *Blessed Warrior* and *Druidic Warrior* synchronizing chosen cantrips into `knownSpells`.
   - Calculate passive modifiers in `attacks.ts` (*Archery*, *Dueling*, *Two-Weapon Fighting*) and `ac.ts` (*Defense*), displaying transparent breakdown badges.
   - Connect *Fighting Initiate* feat to an inline style sub-picker.
2. **Battle Master Maneuvers & Superiority Dice Pool**:
   - Offer tiered milestone choices (`Maneuvers 3`, `7`, `10`, `15`) in `ruleChoices`.
   - Implement `getSuperiorityDice(character)` in `combatDice.ts` consolidating Battle Master progression ($d8 \to d10 \to d12$) with *Superior Technique* and *Martial Adept* bonus dice.
   - Generate dedicated tactical cards on `ActionsTab.tsx` displaying dynamic Save DC and superiority dice bonuses, backed by a short-rest counter on `FeaturesTab.tsx`.
3. **Eldritch Invocations Engine**:
   - Offer level-gated invocation pickers enforcing Warlock level, Pact Boon, and *Eldritch Blast* prerequisites.
   - Display at-will spells on `SpellsTab.tsx` with `[At Will - Invocation]` badges and add passive bonuses to *Eldritch Blast* (*Agonizing Blast*).
   - Automatically prune orphaned invocations on teardown and post alerts to `character.needsReview`.
   - Connect *Eldritch Adept* feat with Warlock qualification checks.
4. **Artificer Infusions Engine**:
   - Implement Infusions Known picker in `ruleChoices` with item-specific flattened *Replicate Magic Item* options.
   - Implement an Active Infusion Manager tracking `Infused Items: X / Max`, binding enhancements to inventory equipment and generating temporary replicated items.
   - Incorporate active *Enhanced Defense* and *Enhanced Weapon* modifiers into AC and weapon attacks.

## User Stories

1. As a 1st-level Fighter, I want to choose a Fighting Style from the Fighter list in the character builder, so that my martial specialization is established.
2. As a 10th-level Champion Fighter, I want to choose an Additional Fighting Style that excludes my 1st-level pick, so that I do not take illegal duplicate styles under 5e RAW.
3. As a Fighter 1 / Paladin 2 multiclass character who selected *Defense* as a Fighter, I want the Paladin Fighting Style picker to exclude *Defense*, so that multiclass style duplication is prevented.
4. As a Paladin selecting *Blessed Warrior*, I want to immediately choose 2 Cleric cantrips that appear on my Spells tab using Charisma, so that my holy cantrips are ready to cast.
5. As an Archer with the *Archery* fighting style, I want my ranged weapon attack rolls on the Actions tab to automatically include the +2 attack bonus with an `[Archery +2]` badge, so that my attack rolls are calculated accurately without mental math.
6. As a sword-and-board Fighter with the *Dueling* fighting style, I want my longsword damage on the Actions tab to automatically include the +2 damage bonus, so that my one-handed weapon attacks deal the correct RAW damage.
7. As a character taking the *Fighting Initiate* feat, I want to choose a Fighting Style directly within the feat picker, so that my feat benefits are configured seamlessly.
8. As a 3rd-level Battle Master Fighter, I want to choose 3 maneuvers and see a pool of 4 Superiority Dice ($d8$) on my Features tab, so that my tactical maneuver resources are tracked across rests.
9. As a Battle Master reaching 7th, 10th, and 15th levels, I want to choose 2 additional maneuvers at each milestone, so that my maneuver repertoire grows with my Fighter levels.
10. As a 10th-level Battle Master, I want my Superiority Dice to automatically scale to $d10$ (and to $d12$ at 18th level), so that my combat dice match my class progression.
11. As a Battle Master who also takes the *Martial Adept* feat, I want my bonus die from the feat to scale to my Battle Master die face and increase my total dice pool by 1, so that my feat integrates with my archetype.
12. As a Battle Master with maneuvers selected, I want dedicated tactical action cards on the Actions tab for each maneuver displaying my dynamic Maneuver Save DC ($8 + \text{PB} + \max(\text{STR}, \text{DEX})$), so that I know my DCs during combat.
13. As a 2nd-level Warlock, I want to select 2 Eldritch Invocations from an options list that validates my level, so that I can customize my warlock abilities.
14. As a Warlock browsing invocations, I want invocations with unmet prerequisites (such as *Thirsting Blade* requiring 5th level and *Pact of the Blade*) to clearly indicate their requirements, so that I understand why an option is locked.
15. As a Warlock with *Armor of Shadows*, I want *Mage Armor* to appear on my Spells tab marked `[At Will - Invocation]` with no slot cost, so that I can track at-will casting easily.
16. As a Warlock with *Agonizing Blast*, I want my *Eldritch Blast* attack card on the Actions and Spells tabs to display $1d10 + \text{CHA}$ damage, so that my eldritch beam damage is computed correctly.
17. As a player who respecs my Warlock from *Pact of the Blade* to *Pact of the Tome*, I want *Thirsting Blade* to be safely pruned and an alert added to `needsReview`, so that illegal choices do not corrupt my character sheet.
18. As a character taking the *Eldritch Adept* feat, I want to choose an invocation that respects the feat's qualification rules, so that non-warlocks can only take invocations without prerequisites.
19. As a 2nd-level Artificer, I want to choose 4 known infusions from eligible 2nd-level options, including specific replicated magic items like *Bag of Holding*, so that my known blueprints are recorded.
20. As a 6th-level Artificer, I want to choose from unlocked 6th-level infusions (such as *Radiant Weapon* and *Repulsion Shield*) alongside 2nd-level infusions, so that my higher-tier inventions become available.
21. As an Artificer, I want an Active Infusions counter tracking my active infused items against my maximum capacity ($2 \to 6$), so that I do not exceed my daily infusion limit.
22. As an Artificer infusing my longsword with *Enhanced Weapon*, I want the weapon on my Actions and Inventory tabs to automatically gain +1 to hit and damage (+2 at level 10+), so that my magical weapon buff is active.
23. As an Artificer infusing a *Bag of Holding*, I want the bag to appear in my inventory as an infused item, so that my carrying capacity is updated.

## Implementation Decisions

1. **Unified Storage in `character.ruleChoices`**:
   - All modular progression selections are stored in `character.ruleChoices?: RuleChoiceEntry[]` using standard origin tags (`"class"`, `"subclass"`).
   - Fighting Styles IDs:
     - `PHB__Fighter__Fighting Style`
     - `PHB__Fighter__Additional Fighting Style 10`
     - `PHB__Paladin__Fighting Style`
     - `PHB__Ranger__Fighting Style`
   - Battle Master Maneuvers IDs:
     - `PHB__Fighter__Battle Master__Maneuvers 3` (choose: 3)
     - `PHB__Fighter__Battle Master__Maneuvers 7` (choose: 2)
     - `PHB__Fighter__Battle Master__Maneuvers 10` (choose: 2)
     - `PHB__Fighter__Battle Master__Maneuvers 15` (choose: 2)
   - Eldritch Invocations IDs:
     - `PHB__Warlock__Invocations 2`, `5`, `7`, `9`, `12`, `15`, `18`
   - Artificer Infusions Known ID:
     - `TCE__Artificer__Infusions Known` (capacity: 4 at lvl 2, 6 at 6, 8 at 10, 10 at 14, 12 at 18)
2. **Combat Math & Transparent Badges**:
   - `attacks.ts`:
     - *Archery*: Adds +2 to attack bonus for ranged weapons, badged `[Archery +2]`.
     - *Dueling*: Adds +2 to damage string for single one-handed melee weapon attacks, badged `[Dueling +2]`.
     - *Two-Weapon Fighting*: Modifies dual-wield calculations to add ability modifier to off-hand damage.
     - *Enhanced Weapon*: Adds +1 (+2 at Artificer 10+) to attack bonus and damage of the infused weapon.
     - *Agonizing Blast*: Adds Charisma modifier to *Eldritch Blast* damage rolls.
   - `ac.ts`:
     - *Defense*: Adds +1 AC when wearing armor (light, medium, heavy), badged `[Defense +1]`.
     - *Enhanced Defense*: Adds +1 AC (+2 at Artificer 10+) when active on equipped armor/shield.
3. **Consolidated Superiority Dice Engine (`combatDice.ts`)**:
   - Expose `getSuperiorityDice(character): { count: number; die: string } | null`.
   - Battle Master Fighter level provides base count (4 at 3, 5 at 7, 6 at 15) and die face ($d8$ at 3, $d10$ at 10, $d12$ at 18).
   - *Superior Technique* fighting style and *Martial Adept* feat each increment `count` by 1. If Battle Master is present, bonus dice scale to the Battle Master's current die face; if Battle Master is absent, die face is $d6$.
   - Feeds into short-rest resource counter on `FeaturesTab.tsx`.
4. **Tactical Maneuver Cards (`ActionsTab.tsx`)**:
   - Generate dedicated action cards for each chosen maneuver, categorized into Bonus Actions (*Feinting Attack*, *Commander's Strike*), Reactions (*Riposte*, *Parry*, *Brace*), and Attack Modifiers/Riders (*Trip Attack*, *Menacing Attack*, *Pushing Attack*, *Precision Attack*).
   - Display dynamic Maneuver Save DC: $8 + \text{PB} + \max(\text{STR mod}, \text{DEX mod})$ and superiority die bonus.
5. **Eldritch Invocations Rules Engine & Teardown Integrity**:
   - Filter invocations against Warlock level, selected Pact Boon (*Blade*, *Tome*, *Chain*, *Talisman*), and known spells (*Eldritch Blast*).
   - In `SpellsTab.tsx`, render at-will invocation spells (*Mage Armor*, *False Life*, *Disguise Self*, etc.) in cantrip/at-will sections with `[At Will - Invocation]` badges and zero slot deduction.
   - In `builderTransitions.ts` (`teardownSubclass` and class transitions), validate chosen invocations against current prerequisites. Prune invalid entries and record notices in `character.needsReview`.
6. **Two-Tier Artificer Infusion Engine**:
   - Flatten eligible *Replicate Magic Item* options into individual choices in the known infusion catalog (e.g. `Replicate Magic Item: Bag of Holding`), enabling multiple selections of different items.
   - On the sheet, manage `activeInfusions?: { infusionName: string; targetItemId?: string; targetItemName?: string }[]`.
   - Max active slots: 2 (lvl 2), 3 (lvl 6), 4 (lvl 10), 5 (lvl 14), 6 (lvl 18) (+2 for Armorer level 9).
   - Applying an item enhancement tags the target item in `character.items`. Replicating an item spawns a temporary designated item in `character.items` tagged `isInfused: true`.
7. **Feat Crossover Sub-Pickers (`AsiFeatSection.tsx`)**:
   - Inline rule choice pickers for *Fighting Initiate* (Fighter style), *Martial Adept* (2 maneuvers), and *Eldritch Adept* (1 invocation + ability selection).
   - Enforce RAW prerequisites: *Eldritch Adept* permits invocations with prerequisites only if the character is a Warlock meeting them.

## Testing Decisions

- Test behavior and mathematical accuracy via public rule functions and clean mock characters.
- **Negative Boundary Verification (CODING_STANDARDS §4)**:
  - Assert duplicate fighting styles across classes or milestones are rejected.
  - Assert Battle Master maneuvers cannot be chosen before level 3, and higher-tier milestones are unavailable before level 7/10/15.
  - Assert bonus superiority dice from *Martial Adept* remain $d6$ for non-Battle Masters but scale to $d8/d10/d12$ for Battle Masters.
  - Assert Warlock invocations with unmet level, pact boon, or spell prerequisites are excluded from available choices.
  - Assert changing Pact Boon prunes invalid invocations and populates `needsReview`.
  - Assert Artificer infusions cannot exceed active item limits, and *Enhanced Defense* AC bonuses scale to +2 only at Artificer level 10+.
- Test suites:
  - `checks/fightingStyles.test.ts` (deduplication, passive math in attacks/ac, cantrip styles).
  - `checks/battleMasterManeuvers.test.ts` (milestone progression, superiority dice scaling, save DC formula).
  - `checks/eldritchInvocations.test.ts` (prerequisite validation, at-will spells, teardown pruning, Eldritch Adept).
  - `checks/artificerInfusions.test.ts` (known capacity, active item binding, Replicate Magic Item multiplicity, enhanced stats).

## Out of Scope

- 2024 D&D ruleset changes (strictly 2014 rules).
- Homebrew maneuvers, invocations, or infusions not present in official sourcebooks.
- Non-artificer magic item crafting systems.

## Further Notes

All changes must pass verification via `npm run check:all` (`npm test`, `npm run typecheck`, and `expo lint`).
