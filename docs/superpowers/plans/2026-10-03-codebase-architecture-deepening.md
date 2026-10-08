# Codebase Architecture Deepening: Unified Character Evaluator, Hit Dice Lifecycle, and Ancestry Engine

## Problem Statement

As the application has expanded with 2014 D&D rules—including multiclassing, origin feats, innate magic, and ancestry variants—business logic and state mutations have fragmented across shallow modules and leaked into UI components. Specifically:

1. **Fragmented Sheet Derivation**: Derived combat and ability statistics (effective ability scores, AC, max HP, saving throws, skills, speed, proficiencies) are scattered across seven shallow rule modules and mediated by a thin adapter (`dndRules.ts`) that redundantly executes catalog ancestry lookups seven times per render pass. UI tabs must independently invoke and coordinate over ten separate rule functions.
2. **Hit Dice State Schema Leakage**: Hit dice pooling, healing rolls, and recovery operations are split between pure helpers and presentation code. UI components directly mutate raw character state using incompatible keys (such as class names instead of standard die tokens like `d12` or `d8`), bypassing rules enforcement.
3. **Ancestry Rule Logic Leaking into UI**: The ancestry builder component spans over 1,000 lines because rule logic—such as string matching on subrace names, synthetic choice identifier fabrication, and origin feat eligibility gating—is implemented directly inside React render loops rather than behind a clean domain seam.

## Solution

Deepen the three key architectural seams into robust, highly cohesive modules with minimal public interfaces:

1. **Deep Character Evaluator Module**: Consolidate all derived character calculations behind a single `evaluateCharacter(character)` interface. The module performs catalog and ancestry resolution once, returning a cohesive, immutable `EvaluatedCharacter` view model consumed across all character sheet tabs, eliminating the shallow `dndRules.ts` middleman.
2. **Consolidated Hit Dice Lifecycle Module**: Encapsulate all hit dice rules—pooling by die type, rolling hit dice with Constitution modifier healing, clamping to maximum hit points, manual recovery, and rest recovery—behind a unified hit dice engine (`spendHitDie`, `recoverHitDie`), ensuring presentation components never mutate raw hit dice state.
3. **Deep Ancestry Engine**: Encapsulate race catalog querying, rule choices, descent variant traits, origin feat eligibility, and innate cantrip unlocking into an Ancestry Engine with intent-based commands (`resolveAncestryState`, `selectAncestryChoice`). This reduces the ancestry builder UI to a purely declarative view adapter.

## User Stories

1. As a player opening my character sheet, I want all derived statistics (ability modifiers, AC breakdown, HP, passive perception, speeds, and saves) to calculate instantly from a single unified pass, so that the sheet renders smoothly without redundant computations.
2. As a multiclass character (such as Barbarian 1 / Bard 1), I want my hit dice clearly segregated by die type (1d12 and 1d8), so that I can spend or recover specific dice accurately.
3. As an injured adventurer taking a short rest or using hit dice from the combat tab, I want rolling a hit die to automatically apply my Constitution modifier, update my hit points up to my maximum, and mark the specific die as used, so that I cannot accidentally corrupt my character state.
4. As a player finishing a long rest, I want my hit dice to automatically recover up to half my total character level (recovering larger dice first), so that rest recovery strictly adheres to 2014 rules.
5. As a player creating a High Elf or a Half-Elf with High Elf descent, I want the bonus wizard cantrip picker to appear only when my ancestry or chosen descent feature grants it, so that I am never prompted for options my character does not have.
6. As a player selecting a descent variant feature that replaces Skill Versatility, I want changing my descent option to automatically cascade and remove invalidated sub-choices (such as an orphaned cantrip), so that my character sheet remains rules-compliant.
7. As a player choosing Variant Human or Custom Lineage, I want origin feat eligibility to be determined declaratively by the ancestry engine rather than brittle UI string matching, so that custom line-ups and subraces function reliably.
8. As a developer adding a new character sheet tab or widget, I want to call a single character evaluation interface to receive all combat and ability metrics, so that I do not have to orchestrate ten separate rule imports.
9. As a developer writing automated checks, I want to test character evaluation and ancestry choice transitions headlessly without mounting React components, so that edge cases are verified quickly and reliably.

## Implementation Decisions

1. **Character Evaluator Module**:
   - Replaces the shallow pass-throughs in `dndRules.ts` with a deep `evaluateCharacter` function.
   - The interface accepts a `Character` and optional catalog references, executing `findRace` and `findBackground` once per evaluation.
   - Returns a structured `EvaluatedCharacter` containing:
     - `effectiveScores`: ability scores, ability modifiers, and point buy / ASI breakdowns.
     - `hp`: maximum HP, current HP, temporary HP, and hit dice pool summaries.
     - `armorClass`: final AC and breakdown components (armor, shield, Dex cap, unarmored defense source).
     - `speeds`: walking, swimming, climbing speeds, and unarmored movement bonuses.
     - `proficiencies`: deduplicated armor, weapon, tool, and language proficiencies.
     - `saves`: saving throw modifiers and proficiency flags.
     - `skills`: skill bonuses, passive perception, passive investigation, and passive insight.
   - Internal calculation functions in individual rule modules remain pure and testable through internal seams.

2. **Hit Dice Lifecycle Engine**:
   - Exposes high-level mutations: `spendHitDie(character, die, options?)` and `recoverHitDie(character, die?)`.
   - Strictly enforces die token keys (`d6`, `d8`, `d10`, `d12`), disallowing class-name keys.
   - Encapsulates roll mechanics: die roll + Constitution modifier, min 1 HP healed, capped at `maxHp`.
   - Re-exports pure pool inspector `getHitDicePools(character)` for presentation layers.
   - Consolidates hit dice recovery logic shared between short rest, long rest, and manual sheet actions.

3. **Ancestry Resolution Engine**:
   - Provides `resolveAncestryState(character, catalogs)` which returns:
     - Offered rule choices with current picks and replacement metadata.
     - Origin feat eligibility status and current selection.
     - Racial cantrip eligibility and current pick.
     - Speed, size, darkvision, and racial trait descriptions.
   - Provides `applyAncestryChoice(character, choiceId, option, catalogs)` which encapsulates choice recording and clean cascading (e.g. clearing dependent cantrips when switching away from a cantrip-granting descent choice).
   - Replaces ad-hoc string comparisons in the UI with catalog-driven properties.

## Testing Decisions

- **Testing Surface**: All tests cross the public module seams (`evaluateCharacter`, `spendHitDie`, `applyAncestryChoice`) rather than mocking internal helper functions.
- **External Behavior Verification**:
  - Verify that a multiclass Barbarian 1 / Bard 1 character evaluated through `evaluateCharacter` has correct AC, HP, saves, and distinct hit dice pools.
  - Verify that `spendHitDie` correctly updates both HP and `usedHitDice` while preventing spending depleted dice or exceeding max HP.
  - Verify that `applyAncestryChoice` cleanly cascades dependent rule choices when swapping ancestry traits.
- **Prior Art**: Builds directly upon the test patterns in `checks/rules.test.ts`, `checks/rest.test.ts`, `checks/halfElfVariant.test.ts`, and `checks/innateMagic.test.ts`.

## Out of Scope

- Modifying the underlying JSON data catalogs (`races.json`, `classes.json`, etc.).
- Implementing 2024 revised ruleset mechanics (strictly adhering to 2014 5e rules).
- Adding third-party state management libraries (Redux, Zustand) or new dependencies.
- Redesigning the visual mobile card styling established in ADR 0001 and 0002.

## Further Notes

- This architectural deepening significantly improves testability and AI navigability by concentrating business rules behind clear seams and reducing UI component file sizes.
