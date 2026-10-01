# D&D 5e (2014) Character Builder Rework Design Specification

Date: 2026-09-18
Status: Approved
Authority: `cb.txt`

## 1. Scope & Objective

Complete the Expo SDK 57 / React Native D&D 5e (2014) Character Builder application, fixing all existing lint and hook errors and fulfilling every requirement specified in `cb.txt`.

Target platforms: Android and Web.
Theme: Default red-black theme with customizable accent color in options.

## 2. Architecture & Pure Rules Layer (`src/rules/`)

Isolate core 5e rules into pure, testable TypeScript modules without direct React dependencies:

1. `builderTransitions.ts`:
   - `setStandardArrayPick(character, ability, value)`
   - `setChoiceRacialBonus(character, picks)`
   - `validateMulticlass(character, targetClass, effectiveScores)`
   - `addMulticlassLevel(character, className, source)`
   - `applyStartingGrants(character, mode, choices)`
   - `setCustomBackground(character, name, skills)`

2. `leveling.ts`:
   - `getPendingLevelChoices(character)`: detects unassigned ASI/Feats and subclasses.
   - `applyAsiSelection(character, selection)`: applies +2/+1+1 or Feats.
   - `asiLevels(className)`: class-level progression (Fighter: 4, 6, 8, 12, 14, 16, 19; Rogue: 4, 8, 10, 12, 16, 19; Others: 4, 8, 12, 16, 19).

3. `spellcasting.ts`:
   - `getClassSpellProfiles(character)`: returns per-class spellcasting info (casting ability, DC, attack bonus, max spell level, prepared limit).
   - Multiclass spell slots (PHB multiclass spellcaster table) vs single-class half/third caster tables.
   - Separate Pact Magic slots from shared slots.

4. `attacks.ts`:
   - `getAvailableAttacks(character)`: calculates weapon attacks based on equipped items, proficiency, and highest appropriate ability modifier (finesse/ranged DEX vs STR).
   - Detects dual-wielding (two light melee weapons) and provides offhand bonus-action attack.

5. `rest.ts`:
   - `applyShortRest(character, spentDice)`: restores Pact Magic slots and short-rest features.
   - `applyLongRest(character)`: restores max HP, recovers floor(totalLevel / 2) hit dice, resets long-rest features, clears 1 exhaustion level.

## 3. UI Tab Requirements & Fixes

1. `BuilderTab`:
   - Ability scores: Point buy, standard array, manual.
   - Race: Subraces, custom lineage, lineage replacement (Dhampir, etc.).
   - Background: Standard list + custom background with custom name and 2 skill choices.
   - Starting Equipment & Gold: Direct grant to inventory and pouch.
   - Leveling: Subclass choice prompt, ASI / Feat selection prompt.
   - Multiclass: Prerequisites check (current + target classes), multiclass proficiencies.

2. `StatsTab`:
   - HP, Temp HP, Conditions (add/remove from `getConditions()`), Short/Long Rest.
   - Ability score modifiers `floor((score - 10) / 2)`.
   - Speed, AC, PB, Initiative, Hit Dice tracking.
   - Saving throws and skills grouped by ability, marked with proficiency, expertise, Jack of All Trades, passive bonuses (Investigation, Insight, Perception with Observant bonus).
   - Armor, weapon, and tool proficiencies derived from race, classes, background.

3. `SpellsTab`:
   - Multi-class spellcasting profiles (separate lists and stats per class).
   - Spell save DC and spell attack bonus per caster class.
   - Warlock pact slots tracked separately from spell slots.
   - Sorcerer metamagic choices and sorcery point tracking.

4. `InventoryTab`:
   - Equipped vs carried items vs pouch coins.
   - Weight limit toggle and encumbrance tracking.
   - Pure ID generation (no `Date.now()` or `Math.random()` during render).

5. `FeaturesTab`:
   - List features from race, background, class, feats.
   - Unified Channel Divinity pool.
   - Resource counters (Rage, Wild Shape, Ki, Action Surge, etc.) with `∞` for Barbarian 20.

6. `JournalTab`:
   - Editable character Name.
   - Art upload / URL.
   - Alignment, Gender, Faction (notes, rank, renown), Description, Backstory, Personality, Ideals, Bonds, Flaws, Scrapped race lore, Notes.

7. `ActionsTab`:
   - Attack calculations from equipped weapons and stats.
   - Two-weapon fighting offhand attack row.
   - Spell attacks and standard actions cheatsheet.

## 4. Hook & Purity Compliance

- Move all React hooks to the top of component bodies before any conditional early returns.
- Eliminate impure functions called during render.
- Fix `use-color-scheme.web.ts` hydration state.

## 5. Verification

- All unit tests in `checks/` pass via `npm test`.
- `npx tsc --noEmit` passes with 0 errors.
- `npm run lint` passes with 0 errors.
- `npx expo export --platform web` bundles cleanly.
