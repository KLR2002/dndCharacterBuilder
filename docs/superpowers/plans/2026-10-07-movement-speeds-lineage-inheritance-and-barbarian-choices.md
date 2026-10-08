# Specification: Movement Speeds Engine, Lineage Inheritance, and Barbarian Choices

## Problem Statement

Players creating and playing characters in the 5e 2014 Character Builder encounter three significant progression gaps on their character sheets and progression choices:
1. **Single-Speed Limitation**: The app currently computes and displays only a single walking speed (e.g., `35 ft`), hiding innate racial swimming, climbing, and flying speeds (such as Triton swim 30 ft, Tabaxi climb 20/30 ft, or Aarakocra fly 50 ft). Special movement modes specified as *"equal to your walking speed"* (such as Dhampir Spider Climb) fail to dynamically scale when class features (Monk Unarmored Movement, Barbarian Fast Movement) or feats (Mobile) increase base walking speed. Furthermore, medium and heavy armor flight restrictions are unverified.
2. **Lineage Ancestral Legacy Disconnect**: When a character selects a Lineage (*Dhampir*, *Hexblood*, *Reborn*) over a prior race, the system completely overwrites the prior race without preserving climbing/swimming/flying speeds or skill proficiencies as mandated by *Van Richten's Guide to Ravenloft*. Additionally, when chosen at 1st level without a previous race, the 2 free skill proficiencies are not offered.
3. **Missing Barbarian Progression Features**:
   - The TCoE *Primal Knowledge* optional feature does not grant its bonus Barbarian skill proficiencies at 3rd level and 10th level.
   - The *Path of the Giant* (BGG) archetype does not grant its 3rd-level cantrip choice (*Druidcraft* vs *Thaumaturgy*) with Wisdom spellcasting.
   - The *Path of the Totem Warrior* (PHB) archetype does not offer single animal spirit choices per milestone at 3rd (*Totem Spirit*), 6th (*Aspect of the Beast*), and 14th level (*Totemic Attunement*), and lacks active Rage damage resistance annotations for Bear Totem.

## Solution

Build a unified Movement Speeds engine and complete the missing Lineage and Barbarian progression choices:
1. **Multi-Mode Movement Speeds**:
   - Provide a pure rules engine calculating `{ walk, swim, climb, fly, flyRestricted, details }`.
   - Special speeds defined as *"equal to your walking speed"* dynamically inherit all class and feat walking speed increases.
   - Detect medium and heavy armor to suppress racial flight (`fly: 0`) with explicit badge warnings (`🪽 0 ft (Armor)`).
   - Display walking speed prominently on `StatsTab.tsx` with compact inline badges for non-zero swim/climb/fly modes and a modal breakdown.
2. **Lineage Ancestral Legacy**:
   - Automatically retain the prior race's swimming, climbing, and flying speeds and skill proficiencies when adopting a Lineage.
   - Provide a 2-skill picker in `AncestrySection.tsx` if no prior race existed or if no skills/speeds were inherited.
3. **Barbarian Feature Choices**:
   - Present *Primal Knowledge* milestone pickers at 3rd and 10th level in `ClassProgressionSection.tsx` when TCoE optional features are active.
   - Offer *Path of the Giant* cantrip selection (*Druidcraft* vs *Thaumaturgy*) at 3rd level with Wisdom modifier, integrated into Spells and Actions tabs.
   - Provide 3 distinct single-choice *Totem Milestone* pickers at levels 3, 6, and 14, gating SCAG options (*Elk*, *Tiger*) by active sourcebooks and augmenting *Enter Rage* cards with Bear Totem resistances.

## User Stories

1. As a player playing a Triton, I want my character sheet to show both my 30 ft walking speed and my 30 ft swimming speed, so that I know my underwater movement capability at a glance during combat.
2. As a player playing an Aarakocra Monk, I want my 50 ft flying speed displayed alongside my walking speed on the Stats tab, so that I can utilize aerial movement effectively.
3. As an Aarakocra or Fairy character wearing medium or heavy armor, I want my flying speed to automatically indicate that flight is restricted by armor (`🪽 0 ft (Armor)`), so that I do not accidentally take illegal aerial actions under 5e RAW.
4. As a Dhampir Monk with *Spider Climb* ("climbing speed equal to your walking speed"), I want my climbing speed to increase dynamically when my Unarmored Movement increases my walking speed from 35 ft to 45 ft, so that my climbing speed accurately mirrors my modified walking speed.
5. As a player inspecting my character's speed tile on the Stats tab, I want to tap the tile to open a detail modal showing the itemized calculation breakdown of every active movement mode and rule source, so that I can explain my speeds to my DM.
6. As a player who converts a Sea Elf character into a Dhampir, I want my character to automatically keep the Sea Elf's 30 ft swimming speed and Perception proficiency under *Ancestral Legacy*, so that I do not lose valid racial capabilities when taking a Lineage.
7. As a player creating a Reborn character at 1st level without an existing race, I want the builder to prompt me to choose 2 skill proficiencies of my choice, so that my character receives the fallback skills granted by *Ancestral Legacy*.
8. As a Barbarian leveling up to 3rd level with TCoE optional features active, I want to choose a bonus skill proficiency from the Barbarian skill list under *Primal Knowledge*, so that my barbarian becomes more versatile out of combat.
9. As a Barbarian leveling up to 10th level with TCoE optional features active, I want to choose a second bonus skill proficiency from the Barbarian skill list, so that my high-level barbarian progression reflects my chosen features.
10. As a Barbarian who chose the *Path of the Giant* archetype at 3rd level, I want to choose between *Druidcraft* and *Thaumaturgy*, so that my giant barbarian gains their innate magical capability.
11. As a Path of the Giant Barbarian, I want my chosen cantrip to appear on my Spells tab and Actions tab with my Wisdom spell save DC and attack modifier, so that I can cast it seamlessly during gameplay.
12. As a Path of the Totem Warrior Barbarian reaching 3rd level, I want to select exactly one animal totem (*Bear*, *Eagle*, *Wolf*, and *Elk*/*Tiger* if SCAG is enabled) for *Totem Spirit*, so that I gain my desired rage benefit without accidentally selecting multiple spirits.
13. As a Path of the Totem Warrior Barbarian with the Bear totem, I want my *Enter Rage* combat card on the Actions tab to explicitly state that I have resistance to all damage types except psychic while raging, so that I remember my defensive durability in combat.
14. As a Path of the Totem Warrior Barbarian reaching 6th level, I want to select exactly one animal spirit for *Aspect of the Beast*, so that I customize my exploration benefits according to the rules.
15. As a Path of the Totem Warrior Barbarian reaching 14th level, I want to select exactly one animal spirit for *Totemic Attunement*, so that my capstone combat totem is active and verified.

## Implementation Decisions

1. **Movement Speeds Rules Engine**:
   - Implement `characterSpeeds(character: Character, opts?: RulesOptions): MovementSpeeds` in `src/rules/speed.ts`.
   - Preserve existing `speed(character, opts): number` signature returning walking speed for 100% backward compatibility.
   - Detect movement modes from `race.speed` (supporting both objects `{ walk, swim, climb, fly }` and numeric fallbacks).
   - Evaluate relative speed traits matching `equal to your walking speed` against `effectiveWalkingSpeed`.
   - Check equipped armor categories via `armorCategory()`; if medium or heavy armor is equipped and racial flight is present, set `flyRestricted: true` and `fly: 0`.
2. **Sheet Presentation (`StatsTab.tsx`)**:
   - Enhance the `SPEED` tile to render walking speed prominently.
   - Render compact secondary badges for active non-zero swim/climb/fly modes (`🏊 X ft`, `🧗 X ft`, `🪽 X ft`).
   - If flight is restricted by armor, display `🪽 0 ft (Armor)` in a warning variant.
   - Provide a detail modal displaying the breakdown of all active speeds and rule sources.
3. **Lineage Ancestral Legacy Engine**:
   - In `src/rules/ancestryEngine.ts` and `src/rules/grantedFeatures.ts`:
     - When `character.lineageReplacement` is set and `character.race` exists, preserve the prior race's skill proficiencies and special speeds (`swim`, `climb`, `fly`) under resolved ancestry.
     - When a Lineage is chosen without a prior race or without inherited skills/speeds, provide a 2-skill `RuleChoice` in `AncestrySection.tsx`.
4. **Barbarian Progression Rule Choices**:
   - In `src/rules/ruleChoices.ts`:
     - Add `Primal Knowledge` rule choices at Barbarian levels 3 and 10 (offering unchosen skills from *Animal Handling, Athletics, Intimidation, Nature, Perception, Survival*), gated by `character.optionalFeatureReplacements?.["Primal Knowledge"]` or active optional features.
     - Add `Path of the Giant: Giant Power` at Barbarian level 3 offering *Druidcraft* and *Thaumaturgy*.
     - Add 3 distinct `RuleChoice` entries for `Path of the Totem Warrior`:
       - `Totem Spirit (3rd Level)`: `choose: 1` from `["Bear", "Eagle", "Wolf", ...SCAG]`
       - `Aspect of the Beast (6th Level)`: `choose: 1` from `["Bear", "Eagle", "Wolf", ...SCAG]`
       - `Totemic Attunement (14th Level)`: `choose: 1` from `["Bear", "Eagle", "Wolf", ...SCAG]`
       - Gate Elk and Tiger options by checking `activeBooks` contains `SCAG`.
5. **Combat Actions & Spell Integration**:
   - In `src/rules/spellcasting.ts` and `src/components/tabs/ActionsTab.tsx`:
     - When Path of the Giant Barbarian selects a cantrip, inject it into `knownSpells` with `ownerKey: "Barbarian__BGG"` and `ability: "wis"`.
     - In `ActionsTab.tsx` and `FeaturesTab.tsx`, augment *Enter Rage* with Bear Totem damage resistances if Bear is selected for Totem Spirit.

## Testing Decisions

- Test only external behavior and public module APIs without asserting internal UI state or unexported helpers.
- **Boundary Verification (CODING_STANDARDS §4)**:
  - Test higher-level Barbarian choices are absent at lower levels (e.g. 10th-level Primal Knowledge not offered at level 3, 14th-level Totemic Attunement not offered at level 6).
  - Test pre-unlock levels (e.g. level 2 Barbarian) offer zero rule choices.
  - Test that SCAG totem animals (Elk, Tiger) are excluded when `activeBooks` excludes `SCAG`.
  - Test medium/heavy armor suppresses flight speed to 0.
- Create dedicated test suites:
  - `checks/speeds.test.ts` (multi-mode calculations, relative scaling with Monk/Barbarian, armor flight restriction).
  - `checks/lineageInheritance.test.ts` (Dhampir, Hexblood, Reborn speeds and skills preservation, 2-skill fallback).
  - `checks/barbarianChoices.test.ts` (Primal Knowledge, Giant cantrip, Totem Warrior single choice per milestone).

## Out of Scope

- Custom beast flying speeds in Wild Shape (already handled in Wild Shape engine).
- 2024 D&D ruleset changes (strictly 2014 rules).
- Homebrew movement modes (e.g. teleport speed or ethereal travel).

## Further Notes

All changes must verify cleanly with `npm run check:all` (`npm test`, `npm run typecheck`, and `expo lint`).
