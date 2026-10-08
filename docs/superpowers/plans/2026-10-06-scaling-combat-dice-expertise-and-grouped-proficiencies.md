# Scaling Combat Dice, Unified Expertise, and Grouped Proficiencies Spec

## Problem Statement

Players managing characters with martial, rogue, and skill-focused classes face several points of friction on their character sheets:
1. **Hidden or Manual Combat Scaling**: Bardic Inspiration (`1d6` to `1d12`), Rogue Sneak Attack (`1d6` to `10d6`), and Monk Martial Arts (`1d4` to `1d10`) scale automatically with class level. Currently, the character sheet does not surface these scaling dice on combat overviews or action cards, and Monk unarmed strikes/monk weapons do not automatically upgrade to the Martial Arts die or substitute Dexterity for Strength.
2. **Missing Expertise Builder Selection & Incomplete Tool Representation**: Rogues, Bards, Knowledge Clerics, Deft Explorer Rangers, Artificers, and feats grant Expertise ($2 \times \text{PB}$) on proficient skills and tools. While `character.chosenExpertise` exists in data, there is no builder selection interface or capacity gating. Furthermore, tool proficiencies lack calculated check modifiers and expertise indicators on the character sheet.
3. **Cluttered Redundant Weapon Proficiencies**: Characters gaining broad weapon categories (`Martial weapons`, `Simple weapons`) retain individual racial weapon proficiencies verbatim (e.g. Elf *Longsword, Shortsword, Shortbow, Longbow*), cluttering the sheet with redundant listings.
4. **Omitted Monk Ki Spellcasting**: Monks specializing in Way of the Four Elements, Way of Shadow, or Sun Soul cast spells or spell-like effects by expending Ki points. Because Monk is not marked as a casting class, these spells and their Wisdom save DC / spell attack modifiers are missing from the sheet.

## Solution

Deliver a polished, RAW-compliant implementation of scaling combat dice, unified expertise, categorical weapon deduplication, and Ki spellcasting:
1. **Dynamic Scaling Combat Dice**: Build a rules module calculating exact die values for Bardic Inspiration, Sneak Attack, and Martial Arts. Integrate these across FeaturesTab (badged counter), StatsTab (Class Dice strip), and ActionsTab (auto-scaled unarmed strikes/monk weapons, DEX substitution, bonus action strike cards, Sneak Attack reference card, and weapon eligibility badges).
2. **Unified Skill & Tool Expertise**: Expand expertise tracking to cover tools (e.g. `"Thieves' Tools"`). Provide milestone-based expertise selection in the Builder under Class Progression, strictly filtering to proficient skills/tools. Display calculated tool modifiers and double-dot badges on StatsTab, including Artificer 6th-level *Tool Expertise*.
3. **Categorical Weapon Proficiencies Deduplication**: Filter out individual simple and martial weapons when the character has proficiency in the corresponding weapon group, rendering concise lists.
4. **Ki Spellcasting Profile**: Recognize spellcasting Monk subclasses in `spellcasting.ts`, rendering a dedicated Ki Spellcasting Profile on SpellsTab and ActionsTab with Ki Save DC ($8 + \text{PB} + \text{WIS}$) and Ki-annotated spells, powered by RuleChoice discipline picks for Four Elements Monks.

## User Stories

1. As a Rogue player, I want to see my Sneak Attack dice pool automatically scale as I level up (from `1d6` at level 1 to `10d6` at level 19), so that I know exactly how much bonus damage to roll on a sneak attack.
2. As a Rogue player, I want to see which of my equipped weapons are eligible for Sneak Attack (finesse or ranged), so that I don't mistakenly assume sneak attack on non-finesse weapons.
3. As a Rogue player, I want a dedicated Sneak Attack reference card on the Actions tab, so that I can quickly reference the exact triggering conditions (advantage or adjacent ally) during combat.
4. As a Rogue player reaching 1st and 6th level, I want the Builder tab to prompt me to choose 2 proficiencies for Expertise from my proficient skills or Thieves' Tools, so that my character progression is accurate.
5. As a Bard player, I want to see my Bardic Inspiration die size dynamically scale (`1d6` $\rightarrow$ `1d8` $\rightarrow$ `1d10` $\rightarrow$ `1d12`), so that I tell my allies the correct die to roll.
6. As a Bard player, I want to see my current Bardic Inspiration die badge on my FeaturesTab resource counter and as a Bonus Action card on the Actions tab, so that I can quickly expend it during my turn.
7. As a Bard player reaching 3rd and 10th level, I want the Builder tab to prompt me to choose 2 skill proficiencies for Expertise from my currently proficient skills, so that my skill bonuses double.
8. As a Monk player, I want my Unarmed Strike damage die to automatically scale (`1d4` $\rightarrow$ `1d6` $\rightarrow$ `1d8` $\rightarrow$ `1d10`) on the Actions tab, so that my unarmed attacks deal the correct damage.
9. As a Monk player, I want my Unarmed Strike and Monk Weapons (shortswords, simple melee weapons without two-handed/heavy properties) to use Dexterity for attack and damage rolls if higher than Strength, so that my martial training is accurately reflected.
10. As a Monk player, I want equipped Monk Weapons whose damage die is lower than my Martial Arts die to automatically deal my Martial Arts die damage, so that I benefit from scaling weapon mastery.
11. As a Monk player, I want to see *"Bonus Action: Martial Arts Strike"* and *"Bonus Action: Flurry of Blows (1 Ki)"* on my Actions tab, so that I can easily roll my bonus action attacks.
12. As a player with Expertise, I want to see double-dot badges `[●●]` and calculated $2 \times \text{PB}$ modifiers on my Skills list on StatsTab, so that I can clearly distinguish expertise from standard proficiency.
13. As a player with Thieves' Tools proficiency, I want to see a calculated Dexterity check modifier (`[●●] Thieves' Tools (+7, Dex)`), so that I can quickly roll lockpicking checks without mental math.
14. As an Artificer player reaching 6th level, I want my character sheet to automatically apply *Tool Expertise* (doubling PB) to all proficient tools without requiring manual selection, so that my class feature is fully automated.
15. As a Knowledge Domain Cleric player, I want the Builder to let me choose 2 skills from Arcana, History, Nature, and Religion at 1st level, automatically granting both proficiency and double PB, so that *Blessings of Knowledge* is enforced correctly.
16. As a player choosing the Deft Explorer optional feature for Ranger, I want to select 1 proficient skill for Expertise at 1st level, so that *Canny* is supported.
17. As an Elf Fighter player, I want redundant martial weapon proficiencies (Longsword, Shortsword, Longbow, Shortbow) to be collapsed into `"Martial weapons"`, so that my proficiencies list is clean and readable.
18. As a Way of Shadow Monk player, I want a Ki Spellcasting profile on SpellsTab showing my Ki Save DC ($8 + \text{PB} + \text{WIS}$) and shadow spells (*Minor Illusion*, *Darkness*, *Darkvision*, *Pass without Trace*, *Silence*) with 2 Ki cost notations, so that I can easily look up my magic.
19. As a Way of the Four Elements Monk player, I want to choose Elemental Disciplines in the Builder at levels 3, 6, 11, and 17, so that my chosen elemental spells appear on my Spells tab and Actions tab with their Ki costs.
20. As a Sun Soul Monk player, I want to see *Burning Hands (2 Ki)* in my combat actions at 6th level, so that I can cast Searing Arc Strike in combat.

## Implementation Decisions

### 1. Scaling Combat Dice (`combatDice.ts`)
- Add a pure domain module calculating:
  - `getBardicInspirationDie(bardLevel: number): string | null` (`1d6` at 1–4, `1d8` at 5–9, `1d10` at 10–14, `1d12` at 15–20).
  - `getSneakAttackDice(rogueLevel: number): string | null` ($\lceil \text{rogueLevel} / 2 \rceil \text{d6}$).
  - `getMartialArtsDie(monkLevel: number): string | null` (`1d4` at 1–4, `1d6` at 5–10, `1d8` at 11–16, `1d10` at 17–20).
- Expose summary helper `getClassDice(character: Character)` returning all active scaling dice.
- Integrate into:
  - `FeaturesTab.tsx`: Resource counter label includes active die (e.g. `Bardic Inspiration [1d8 die]`).
  - `StatsTab.tsx`: Combat overview includes a Class Dice badge row.
  - `attacks.ts`: Monk Unarmed Strike and monk weapons damage dice upgrade to Martial Arts die if higher; statUsed defaults to Dexterity if DEX > STR.
  - `ActionsTab.tsx`: Render Sneak Attack card, Monk bonus action strike cards, and weapon eligibility badges.

### 2. Categorical Weapon Proficiencies Deduplication (`proficiencies.ts`, `characterEvaluation.ts`)
- In `proficiencies.ts`, define helper `deduplicateWeaponProficiencies(weapons: string[]): string[]`:
  - If `"Martial weapons"` is present, remove all standard weapons whose category is `"martial"`.
  - If `"Simple weapons"` is present, remove all standard weapons whose category is `"simple"`.
  - If both are present, collapse to `"Simple weapons, Martial weapons"` (plus any non-standard weapons).

### 3. Unified Skill & Tool Expertise (`skills.ts`, `characterEvaluation.ts`, `builderTransitions.ts`)
- `character.chosenExpertise: string[]` stores both skill names and tool names.
- `skills(character, opts)`: continues calculating double PB for skills in `chosenExpertise`.
- `resolveCharacterTools(character, opts)`: marks tools that have expertise (either present in `chosenExpertise` or Artificer level $\ge 6$), calculating canonical ability modifiers (DEX for Thieves' Tools, CHA for instruments, WIS for herbalism/navigator, flat PB for flexible tools).
- In `ClassProgressionSection.tsx`, render milestone expertise pickers:
  - Filter choices strictly to currently proficient skills and tools.
  - If a player removes a prerequisite proficiency, warn and prune the invalid choice during builder evaluation / transitions.

### 4. Ki Spellcasting Profile (`spellcasting.ts`, `ruleChoices.ts`)
- In `spellcasting.ts`:
  - `isCastingClass` returns true for Monk if subclass is `Way of the Four Elements`, `Way of Shadow`, or `Way of the Sun Soul`.
  - `getSpellcastingAbility` returns `"wis"`.
  - Spell save DC: $8 + \text{PB} + \text{modifiers.wis}$.
  - Spell attack bonus: $\text{PB} + \text{modifiers.wis}$.
  - Slot type: Ki-powered (no spell slots; each spell annotated with its Ki point cost).
- Subclass spell mapping:
  - Way of Shadow: *Minor Illusion*, *Darkness (2 Ki)*, *Darkvision (2 Ki)*, *Pass without Trace (2 Ki)*, *Silence (2 Ki)*.
  - Way of the Sun Soul: *Burning Hands (2 Ki)* at level 6.
  - Way of the Four Elements: Disciplines chosen via `RuleChoice` in Builder at levels 3, 6, 11, 17.

## Testing Decisions

- Test external domain behaviors only through public function interfaces and evaluation pipelines:
  - `checks/combatDice.test.ts`: Test die progressions for Bard, Rogue, and Monk across levels 1 to 20; test monk weapon damage upgrades and DEX substitution.
  - `checks/proficiencies.test.ts`: Test categorical weapon deduplication for Fighter, Elf Fighter, Dwarf Paladin, and multiclass characters.
  - `checks/expertise.test.ts`: Test skill and tool expertise calculations, double PB bonuses, Artificer 6th-level Tool Expertise, and builder choice gating.
  - `checks/monkKiSpells.test.ts`: Test Ki spell profile generation, Wisdom DC/attack calculation, Way of Shadow fixed spells, and Way of Four Elements discipline rule choices.

## Out of Scope

- 2024 revised rules (strictly adhere to 2014 RAW).
- Automated Ki expenditure tracking directly decrementing the Ki counter upon spell tap (player uses the existing counter on FeaturesTab).
- Homebrew or non-official monk traditions.

## Further Notes

- Maintains 100% test pass rate, 0 typecheck errors, and 0 lint errors throughout implementation.
