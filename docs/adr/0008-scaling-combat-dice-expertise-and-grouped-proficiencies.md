# 0008: Scaling Combat Dice, Unified Expertise, and Categorical Proficiencies

## Context

Several foundational 5e 2014 progression mechanics directly impact the character sheet across martial, rogue, and skill-focused classes:
1. **Scaling Combat Dice**: Bardic Inspiration (`1d6` up to `1d12`), Rogue Sneak Attack (`1d6` up to `10d6`), and Monk Martial Arts (`1d4` up to `1d10`) scale automatically at specific class level milestones. Players frequently look up their current die values during combat, but currently the character sheet either omits them or does not integrate them into attack and action calculations.
2. **Expertise & Tool Proficiency Tracking**: Rogues (levels 1 and 6), Bards (levels 3 and 10), Knowledge Clerics (level 1), Deft Explorer Rangers (TCoE level 1), Artificers (Tool Expertise at level 6), and feats (*Skill Expert*, *Prodigy*) grant double proficiency bonus ($2 \times \text{PB}$) on proficient skills and tools. Currently, `character.chosenExpertise` exists in character state but lacks a validated builder selection flow, and tools lack calculated ability modifiers and expertise indicators.
3. **Redundant Weapon Proficiencies**: When characters gain broad weapon categories (e.g. `Martial weapons` or `Simple weapons` from classes like Fighter, Paladin, or Barbarian), individual weapon proficiencies from races (e.g., Elf *Longsword, Shortsword, Shortbow, Longbow* or Dwarf *Battleaxe, Handaxe*) remain listed verbatim, producing cluttered and redundant strings such as `"Simple weapons, Martial weapons, Longswords, Shortswords, Shortbows, Longbows"`.
4. **Ki Spellcasting for Monks**: Monks of the Way of the Four Elements, Way of Shadow, and Way of the Sun Soul cast spells or duplicate spell effects by expending Ki points rather than standard spell slots. Because Monk is not traditionally categorized as a spellcasting class, these spells and their Wisdom save DC / spell attack modifiers were absent from the character's spell profile and actions.

## Decision

1. **Unified Skill & Tool Expertise Architecture**:
   - `character.chosenExpertise: string[]` stores both skill names and tool names (e.g. `"Thieves' Tools"`).
   - In `ClassProgressionSection.tsx`, dedicated milestone pickers render when classes reach expertise levels (Rogue 1: 2 picks, Rogue 6: 2 picks, Bard 3: 2 picks, Bard 10: 2 picks, Knowledge Cleric 1 is no longer a milestone: its skills carry Expertise from the grant (ADR 0015), Deft Explorer: 1 pick).
   - The picker strictly filters options to skills/tools the character is currently proficient in.
   - On `StatsTab.tsx`:
     - Skills display the double-dot indicator `[●●]` and calculated $2 \times \text{PB}$ bonus.
     - Tools under Tool Proficiencies display double-dot badges `[●●]` when expertise is present, with calculated modifiers based on canonical abilities (Thieves' Tools $\rightarrow$ DEX, Musical Instruments $\rightarrow$ CHA, Herbalism/Navigator $\rightarrow$ WIS) or flat $+2 \times \text{PB}$.
     - 6th-level Artificers automatically apply *Tool Expertise* ($2 \times \text{PB}$) to all proficient tools without requiring manual selection.

2. **Dynamic Scaling Combat Dice & Automation**:
   - Dedicated rule module `src/rules/combatDice.ts` calculates active class dice from class levels:
     - Bardic Inspiration: `1d6` (1–4), `1d8` (5–9), `1d10` (10–14), `1d12` (15–20).
     - Rogue Sneak Attack: $\lceil \text{Rogue Level} / 2 \rceil \text{d6}$.
     - Monk Martial Arts: `1d4` (1–4), `1d6` (5–10), `1d8` (11–16), `1d10` (17–20).
   - **FeaturesTab**: Resource counter title displays the active die (e.g. `Bardic Inspiration [1d8 die]`).
   - **StatsTab**: Combat overview displays an active Class Dice summary strip.
   - **ActionsTab**:
     - Monk Unarmed Strike and Monk Weapons (shortswords, non-heavy/two-handed simple melee weapons) automatically adopt the Martial Arts die if higher than base damage, and use DEX for attacks/damage if higher than STR.
     - Monk automatically gains *"Bonus Action: Martial Arts Strike"* and *"Bonus Action: Flurry of Blows (1 Ki)"*.
     - Rogue displays a *"Sneak Attack (Xd6)"* Action card and adds `[Sneak Attack Eligible: +Xd6]` badges to finesse and ranged weapon attacks.

3. **Categorical Weapon Proficiencies Deduplication**:
   - In `proficiencies.ts` and `characterEvaluation.ts`:
     - If `Martial weapons` is present, all standard martial weapons are omitted from the display set.
     - If `Simple weapons` is present, all standard simple weapons are omitted.
     - If both are present, the weapons list renders cleanly as `"Simple weapons, Martial weapons"` (plus any non-standard/exotic weapons).

4. **Ki Spellcasting Profile & Elemental Disciplines**:
   - `src/rules/spellcasting.ts` recognizes Monk as a casting class when the subclass is `Way of the Four Elements`, `Way of Shadow`, or `Way of the Sun Soul`.
   - Generates a `ClassSpellProfile` with:
     - Spellcasting ability: Wisdom (`wis`).
     - Save DC: $8 + \text{PB} + \text{WIS}$; Attack Bonus: $\text{PB} + \text{WIS}$.
     - Slot type: Ki-powered (no traditional slots consumed, displays Ki cost in spell names/badges).
   - Way of Shadow automatically grants *Minor Illusion* and the 4 shadow spells (*Darkness*, *Darkvision*, *Pass without Trace*, *Silence* at 2 Ki each).
   - Way of the Four Elements disciplines are selected via `RuleChoice` in the Builder at levels 3, 6, 11, and 17, and render on SpellsTab and ActionsTab with their Ki costs.

## Consequences

- Full RAW compliance for martial arts progression, sneak attack dice scaling, and bardic inspiration.
- High-fidelity skill and tool expertise calculations with zero ambiguity on character sheets.
- Clean, uncluttered weapon proficiency presentation.
- Complete spell and action visibility for Ki-based Monk subclasses.
