# 0010: Modular Class Progression: Fighting Styles, Battle Master Maneuvers, Eldritch Invocations, and Artificer Infusions

## Context

Across 5e martial and modular progression, characters make customizable choices from structured option pools:
1. **Fighting Styles**: Granted to Fighters (1st & 10th level Champion), Paladins (2nd level), Rangers (2nd level), and via the *Fighting Initiate* feat. 2014 RAW forbids duplicate style choices across classes or milestones. Several styles grant passive bonuses (*Archery* +2 to hit, *Defense* +1 AC in armor, *Dueling* +2 damage), while TCoE introduces styles granting cantrips (*Blessed Warrior*, *Druidic Warrior*) or tactical features (*Superior Technique*, *Interception*).
2. **Battle Master Maneuvers & Superiority Dice**: Battle Master Fighters learn maneuvers at levels 3 (3), 7 (5), 10 (7), and 15 (9), fueled by Superiority Dice (4 at 3rd, 5 at 7th, 6 at 15th) that scale in die face ($d8 \to d10 \to d12$). *Superior Technique* and the *Martial Adept* feat each grant one superiority die of d6 that does not scale; these dice are a separate pool from the Battle Master's dice. Maneuvers require dedicated tactical cards with dynamic Save DC ($8 + \text{PB} + \max(\text{STR}, \text{DEX})$).
3. **Eldritch Invocations**: Warlocks learn 2 to 8 invocations across levels 2 to 20 (and via *Eldritch Adept*). Invocations impose strict prerequisites (Warlock level, Pact Boon, *Eldritch Blast* cantrip). Invocations grant at-will spells, slot-expending spells, or combat modifiers (*Agonizing Blast*). Build alterations (such as changing Pact Boon or deleveling) must not leave orphaned choices in character state.
4. **Artificer Infusions**: Artificers have a two-tier system: Infusions Known ($4 \to 12$) from level-gated options (2nd, 6th, 10th, 14th) and Active Infused Items ($2 \to 6$, +2 for Armorer 9). *Replicate Magic Item* can be chosen multiple times for different items. Active enhancements (*Enhanced Defense*, *Enhanced Weapon*) bind to specific equipment and modify sheet numbers.

## Decision

1. **Unified Storage in `character.ruleChoices`**:
   - Store all modular choices in `character.ruleChoices?: RuleChoiceEntry[]` using canonical IDs (`origin: "class"` or `"subclass"`).
   - Fighting Styles: `PHB__Fighter__Fighting Style`, `PHB__Fighter__Additional Fighting Style 10`, `PHB__Paladin__Fighting Style`, `PHB__Ranger__Fighting Style`.
   - Battle Master Maneuvers: `PHB__Fighter__Battle Master__Maneuvers 3`, `7`, `10`, `15`.
   - Eldritch Invocations: `PHB__Warlock__Invocations 2`, `5`, `7`, `9`, `12`, `15`, `18`.
   - Artificer Infusions Known: `TCE__Artificer__Infusions Known`.
   - Dynamic exclusion across choices prevents duplicate styles or maneuvers.
   - Cantrip-granting styles (*Blessed Warrior*, *Druidic Warrior*) generate sub-rule choices synchronizing cantrips into `knownSpells`.

2. **Feat Crossover Integration**:
   - *Fighting Initiate*, *Martial Adept*, and *Eldritch Adept* generate inline `ruleChoices` sub-entries within `AsiFeatSection.tsx` (`TCE__Feat__Fighting Initiate__Style`, `PHB__Feat__Martial Adept__Maneuvers`, `TCE__Feat__Eldritch Adept__Invocation`).
   - Prerequisites for *Eldritch Adept* strictly verify whether the character is a qualifying Warlock before offering gated invocations.

3. **Separate Superiority Dice Pools**:
   - In `src/rules/combatDice.ts`, export `getSuperiorityDice(character): { battleMaster, bonus } | null`, where each pool is `{ count, die }` or `null`.
   - `battleMaster` is present for a Battle Master: count and die size are computed from Fighter level ($d8/d10/d12$). It never includes the bonus dice.
   - `bonus` holds one d6 for *Superior Technique* and one for *Martial Adept*. It stays $d6$ at every level, with or without Battle Master.
   - Each pool is its own resource counter (`superiority_dice` for the Battle Master pool, `superiority_dice_d6` for the bonus pool).

4. **Automated Combat Math & Source Transparency**:
   - `attacks.ts`: *Archery* adds +2 to ranged weapon attacks; *Dueling* adds +2 damage to single one-handed melee weapon attacks; *Two-Weapon Fighting* adds ability modifier to off-hand damage; *Agonizing Blast* adds Charisma modifier to *Eldritch Blast* damage.
   - `ac.ts`: *Defense* adds +1 AC when armor is equipped; *Enhanced Defense* adds +1 AC (+2 at level 10+) to infused armor or shield.
   - Attack and AC cards display transparent breakdown badges (`[Archery +2]`, `[Defense +1]`, `[Infused +1]`).
   - Dedicated tactical cards render on `ActionsTab.tsx` for Battle Master maneuvers with dynamic Save DC ($8 + \text{PB} + \max(\text{STR}, \text{DEX})$).

5. **Teardown Invariants & Orphan Pruning**:
   - Class, subclass, or feat teardown validates invocation prerequisites against current state. Invalid invocations are pruned from `ruleChoices`, and an explanatory note is recorded in `character.needsReview`.

6. **Two-Tier Artificer Infusion Engine**:
   - *Replicate Magic Item* options are flattened into item-specific choices in the Infusions Known picker (e.g. `Replicate Magic Item: Bag of Holding`), allowing multi-instance selection.
   - On the sheet, an active infusion manager tracks `Infused Items: X / Y`. Enhancements bind to specific inventory items, and replicated items spawn designated temporary inventory objects.

## Consequences

- 100% adherence to 2014 RAW mechanics across all martial combat styles, tactical maneuvers, eldritch pacts, and artificer inventions.
- Robust prevention of illegal choice stacking or orphaned prerequisites.
- Direct mathematical transparency on character sheet combat cards without manual overrides.
