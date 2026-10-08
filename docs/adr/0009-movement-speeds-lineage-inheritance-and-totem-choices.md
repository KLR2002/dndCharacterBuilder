# 0009: Movement Speeds Engine, Lineage Inheritance, and Totem Warrior Choices

## Context

Several character progression and race mechanics were missing from the rules engine and character sheet:
1. **Multi-Mode Movement Speeds**: The app currently evaluates and displays a single number for speed (`walk`). Multiple official races possess innate swimming, climbing, or flying speeds (e.g., Triton swim 30 ft, Tabaxi climb 20/30 ft, Aarakocra fly 50 ft). Furthermore, several traits specify speeds *"equal to your walking speed"* (e.g. Dhampir Spider Climb, Simic Hybrid), which must scale dynamically when walking speed increases via class features (Monk *Unarmored Movement*, Barbarian *Fast Movement*) or feats (*Mobile*). Racial flight is also subject to medium/heavy armor restrictions.
2. **Lineage Ancestral Legacy Inheritance**: In *Van Richten's Guide to Ravenloft*, characters selecting a Lineage (*Dhampir*, *Hexblood*, *Reborn*) replace their base race traits but retain any climbing, flying, or swimming speeds and any skill proficiencies gained from their previous race. If chosen without a prior race, the character gains two free skill proficiencies.
3. **Barbarian Skill & Cantrip Progression**:
   - *Primal Knowledge* (TCoE optional feature) grants one Barbarian skill at 3rd level and another at 10th level.
   - *Path of the Giant* (BGG) grants a cantrip choice (*Druidcraft* or *Thaumaturgy*) using Wisdom at 3rd level.
4. **Totem Warrior Animal Selection Integrity**: Path of the Totem Warrior allows players to select an animal spirit at 3rd (*Totem Spirit*), 6th (*Aspect of the Beast*), and 14th level (*Totemic Attunement*). Each milestone must strictly enforce selecting exactly one animal per tier, while allowing different animals across tiers and gating SCAG options (*Elk*, *Tiger*) by active sourcebooks.

## Decision

1. **Multi-Mode Movement Speeds Engine**:
   - In `src/rules/speed.ts`, export `characterSpeeds(character: Character, opts?: RulesOptions): MovementSpeeds`:
     ```ts
     export interface MovementSpeeds {
       walk: number;
       swim?: number;
       climb?: number;
       fly?: number;
       flyRestricted?: boolean;
       details: { mode: string; speed: number; source: string; restricted?: boolean }[];
     }
     ```
   - Keep `speed(character, opts): number` returning walking speed for 100% backward compatibility.
   - **Relative Speed Scaling**: Special speeds defined as *"equal to your walking speed"* dynamically evaluate against total walking speed (including Monk Unarmored Movement, Barbarian Fast Movement, and feats). Fixed numerical speeds remain fixed unless modified by specific rules.
   - **Armor Flight Restriction**: If a character with racial flight wears medium or heavy armor, set `flyRestricted: true` and `fly: 0`.
   - **Sheet Presentation (`StatsTab.tsx`)**:
     - The `SPEED` tile displays primary walking speed prominently (e.g., `35 ft`).
     - Directly within the speed tile, render compact secondary badges for active non-zero modes: `🏊 X ft`, `🧗 X ft`, `🪽 X ft` (or `🪽 0 ft (Armor)` if restricted).
     - Tapping the tile opens a detail modal with full breakdowns by source and armor conditions.

2. **Lineage Ancestral Legacy Inheritance**:
   - In `src/rules/ancestryEngine.ts` and `src/rules/grantedFeatures.ts`:
     - When `character.lineageReplacement` is set and `character.race` exists:
       - Retain base race's skill proficiencies and special speeds (`swim`, `climb`, `fly`).
       - Suppress other base race/subrace traits in favor of lineage traits.
     - When a Lineage is chosen at 1st level without a previous race (or if the previous race had no skills or special speeds):
       - Provide a dedicated 2-skill picker in `AncestrySection.tsx` choosing from the 18 standard skills.

3. **Barbarian Feature Choices**:
   - **Primal Knowledge**:
     - At Barbarian level 3 and level 10, when `Primal Knowledge` optional feature is active, present a `RuleChoice` in `ClassProgressionSection.tsx` offering unchosen skills from the Barbarian 1st-level list (*Animal Handling, Athletics, Intimidation, Nature, Perception, Survival*).
   - **Path of the Giant (Giant Power)**:
     - At Barbarian level 3, present a subclass `RuleChoice` for cantrips: *Druidcraft* vs. *Thaumaturgy*.
     - The selected cantrip is added to `knownSpells` with Wisdom modifier and rendered on `ActionsTab.tsx` and `SpellsTab.tsx`.
   - **Path of the Totem Warrior**:
     - Implement 3 distinct `RuleChoice` entries under `subclassRuleChoices()`:
       1. `Totem Spirit (3rd Level)`: Choose 1 (`Bear`, `Eagle`, `Wolf`, plus `Elk`, `Tiger` if `SCAG` active).
       2. `Aspect of the Beast (6th Level)`: Choose 1 (`Bear`, `Eagle`, `Wolf`, plus `Elk`, `Tiger` if `SCAG` active).
       3. `Totemic Attunement (14th Level)`: Choose 1 (`Bear`, `Eagle`, `Wolf`, plus `Elk`, `Tiger` if `SCAG` active).
     - On `ActionsTab.tsx` and `FeaturesTab.tsx`, dynamically augment *Enter Rage* to detail active animal spirit benefits (e.g., Bear Totem resistance to all damage except psychic).

## Consequences

- Complete RAW fidelity for all movement speeds (swimming, climbing, flying) with dynamic unarmored/speed scaling and armor penalties.
- Seamless lineage adoption with full preservation of prior racial movement capabilities and skills.
- Transparent and strictly validated progression for Barbarian subclasses and optional features.
