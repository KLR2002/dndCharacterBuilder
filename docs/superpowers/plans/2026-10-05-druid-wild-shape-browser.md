# Spec: Druid Wild Shape Beast Statblock Browser

## Problem Statement

When playing or leveling a Druid in Fifth Edition Dungeons & Dragons (2014 rules), players gain the *Wild Shape* class feature at 2nd level, allowing them to assume the form of beasts they have seen. However:
1. The character sheet currently only provides a generic resource counter (`Wild Shape [ 2 / 2 ]`) with no way to browse, search, or inspect beast statblocks.
2. Players must look up beast Armor Class, Hit Points, speeds, traits, and attack actions outside the app in the *Monster Manual* or physical books.
3. Calculating 2014 rules limits is error-prone: standard Druids face strict Challenge Rating caps (CR 1/4 at lvl 2, CR 1/2 at lvl 4, CR 1 at lvl 8) and movement restrictions (no swimming speed until lvl 4, no flying speed until lvl 8).
4. Circle of the Moon Druids have completely different *Circle Forms* scaling (CR 1 at lvl 2, $\lfloor\text{lvl}/3\rfloor$ at lvl 6+, up to CR 6) and 10th-level *Elemental Wild Shape* (costing 2 charges for CR 5 Elementals), while still obeying swimming and flying speed level restrictions.
5. In combat, tracking the beast's temporary hit point pool and knowing when the form drops requires manual scratch paper.

## Solution

1. **Beast Data Pipeline**: Ingest all official `type: "beast"` creatures up to CR 6 (excluding swarms) plus the four Circle of the Moon CR 5 Elementals (*Air, Earth, Fire, Water*) into `src/data/beasts.json`, complete with full statblocks (AC, HP, speeds, abilities, senses, traits, actions). Expose this through `getBeasts(activeBooks)` in `src/services/dataService.ts`.
2. **Pure Rules Engine**: Implement `src/rules/wildShape.ts` with `getWildShapeLimits(character)`, `isBeastEligible(beast, character, activeBooks)`, and `getBeastFilterReason(beast, character)`. This guarantees 100% adherence to 2014 PHB rules for both standard Druids and Circle of the Moon Druids without hardcoding book names.
3. **Interactive Wild Shape Browser Modal**: Provide a searchable, filterable beast browser featuring:
   - Search by creature name.
   - Filtering by Challenge Rating and movement modes (Walking, Swimming, Flying).
   - "Favorites / Seen" star toggle persisted on `character.favoriteWildShapes`.
   - "Show All" toggle (default off, showing eligible beasts; when enabled, locked beasts appear dimmed with badges indicating why they are locked).
   - Full Monster Manual-style statblock inspector with AC, HP formula, speeds, ability scores, traits, and formatted actions.
4. **Features Tab Card & Active Transformation State**:
   - In `FeaturesTab.tsx`, render a dedicated Wild Shape card summarizing current limits (Max CR, Swim/Fly status, duration) and a button to open the browser.
   - Tapping "Adopt Shape" deducts 1 Wild Shape charge (or 2 charges for Moon Druid Elementals) and sets `character.activeWildShape`.
   - Displays an Active Wild Shape status banner with beast HP stepper, AC, link to statblock actions, and a "Revert to Normal Form" button.
5. **Stats Tab Combat Integration**:
   - When transformed, display the Active Wild Shape status banner at the top of `StatsTab.tsx` so the player can view and adjust beast HP and AC directly during combat turns.

## User Stories

1. As a 2nd-level standard Druid, I want to browse beasts up to CR 1/4 with no swim or fly speed (such as Badger, Boar, Wolf), so that I only see forms I can legally assume.
2. As a 2nd-level standard Druid, I do not want to see Giant Poisonous Snake (swim speed) or Giant Owl (fly speed) in my default list, so that I don't accidentally choose an illegal movement mode.
3. As a 2nd-level Druid, I want to toggle "Show all beasts" to preview higher-level or swimming forms, seeing clear badges explaining "Requires Level 4 (Swim)" or "Requires Level 8 (Fly)".
4. As a 4th-level standard Druid, I want to see swimming beasts up to CR 1/2 (such as Crocodile, Reef Shark), so that my newly unlocked swimming speed feature is immediately usable.
5. As an 8th-level standard Druid, I want to see flying beasts up to CR 1 (such as Giant Eagle, Giant Vulture), so that I can take to the skies.
6. As a 2nd-level Circle of the Moon Druid, I want to access CR 1 beasts (such as Brown Bear, Dire Wolf) immediately, while swimming beasts remain locked until level 4 and flying beasts until level 8.
7. As a 6th-level Circle of the Moon Druid, I want to see CR 2 beasts (such as Polar Bear, Saber-Toothed Tiger), reflecting my enhanced Circle Forms scaling.
8. As a 10th-level Circle of the Moon Druid, I want to see Air, Earth, Fire, and Water Elementals, and when I adopt one, I want the system to deduct 2 Wild Shape uses simultaneously.
9. As a player with specific sourcebooks enabled (e.g. PHB only), I only want to see beasts from those sourcebooks, so that table source restrictions are respected.
10. As a player, I want to "star" / favorite my druid's 4 go-to combat and scout beasts, so that I can filter to my favorites instantly during combat without scrolling.
11. As a player in combat, I want to tap "Adopt Shape" on a Brown Bear to deduct 1 Wild Shape use and display an Active Wild Shape banner with 34 HP and 11 AC on my sheet.
12. As a player in combat, I want to adjust my beast's HP as it takes damage, and easily revert to normal form when the beast drops to 0 HP or when combat ends.
13. As a player on the Stats tab during combat, I want to see my beast's AC, HP, and a quick link to its attack rolls and damage dice.
14. As a player taking a Long Rest, I want my active Wild Shape form to be cleared and my Wild Shape charges reset to 2.
15. As a developer, I want all Wild Shape rules evaluated by pure functions in `src/rules/wildShape.ts`, so that all level, CR, and movement conditions are exhaustively unit-tested.

## Implementation Decisions

- **Domain Glossary**: Strictly adheres to `GLOSSARY.md` definitions for *Character*, *Wild Shape*, *Circle Forms*, *Beast Statblock*, and *Elemental Wild Shape*.
- **Architectural Record**: Documented in ADR 0006 (`docs/adr/0006-wild-shape-beast-browser-and-transformation.md`).
- **Data Model**:
  `BeastData` in `src/types/dnd5e.ts`:
  ```ts
  export interface BeastAction {
    name: string;
    description: string;
    attackBonus?: number;
    damageDice?: string;
    damageType?: string;
  }

  export interface BeastTrait {
    name: string;
    description: string;
  }

  export interface BeastData {
    name: string;
    source: string;
    size: string; // "Tiny" | "Small" | "Medium" | "Large" | "Huge" | "Gargantuan"
    type: "beast" | "elemental";
    cr: string; // "0", "1/8", "1/4", "1/2", "1", "2", ...
    crNumeric: number; // 0, 0.125, 0.25, 0.5, 1, 2, ...
    ac: number;
    hp: {
      average: number;
      formula: string; // "3d10 + 3"
    };
    speed: {
      walk?: number;
      swim?: number;
      fly?: number;
      climb?: number;
      burrow?: number;
    };
    abilities: {
      str: number;
      dex: number;
      con: number;
      int: number;
      wis: number;
      cha: number;
    };
    senses?: string[];
    passivePerception?: number;
    skills?: Record<string, number>;
    traits?: BeastTrait[];
    actions?: BeastAction[];
    isElementalWildShape?: boolean;
  }
  ```
- **Character State Extensions**:
  In `src/types/character.ts`:
  ```ts
  export interface ActiveWildShape {
    name: string;
    source: string;
    currentHp: number;
    maxHp: number;
    ac: number;
  }
  ```
  Added to `Character`:
  - `favoriteWildShapes?: string[]` (array of `"${name}__${source}"` keys)
  - `activeWildShape?: ActiveWildShape | null`
- **Pure Rules Seam**:
  In `src/rules/wildShape.ts`:
  - `getWildShapeLimits(character: Character): WildShapeLimits`
  - `isBeastEligible(beast: BeastData, character: Character, activeBooks?: string[]): boolean`
  - `getBeastFilterReason(beast: BeastData, character: Character): string | null`
- **Rest Rules Seam**:
  In `src/rules/rest.ts`:
  - `applyLongRest` clears `activeWildShape` to `null` and recovers Wild Shape resource counter.
- **UI Seams**:
  - `src/components/WildShapeModal.tsx`: Search, filter, inspection modal.
  - `src/components/tabs/FeaturesTab.tsx`: Dedicated card and active transformation banner.
  - `src/components/tabs/StatsTab.tsx`: Mirrored active transformation banner with quick HP stepper and link to beast actions.

## Testing Decisions

- High-seam testing in `checks/wildShape.test.ts`:
  - Tests verify external domain behavior across character levels 2, 4, 6, 8, 10, 18 for both standard Druids and Circle of the Moon Druids.
  - Verifies CR gating, swimming gating, flying gating, and elemental gating.
  - Verifies active sourcebook filtering.
- Catalog integrity test in `checks/catalogIntegrity.test.ts`:
  - Verifies `src/data/beasts.json` contains no swarms, all entries have required attributes, and includes the four CR 5 elementals.
- Rest tests in `checks/rest.test.ts`:
  - Verifies that `applyLongRest` resets `activeWildShape` to `null`.

## Out of Scope

- Polymorph / True Polymorph spell forms (this spec is strictly for the Druid Wild Shape feature).
- Swarms of beasts (explicitly barred by 2014 D&D rules).
- 2024 revised ruleset Wild Shape statblocks (strictly 2014 rules).
- Overwriting the entire character's ability scores and proficiencies on the sheet (beast HP and AC are tracked in the active banner, while mental stats and character features are preserved per 2014 rules).

## Further Notes

- Ingestion will process source bestiary files from 5eTools, converting tags and entries to clean text using existing parser utilities.
