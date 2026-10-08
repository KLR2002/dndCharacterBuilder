# 04: Features Tab Integration & Active Transformation State

**What to build:** A dedicated Wild Shape card in `FeaturesTab.tsx` that summarizes current rules limits, provides access to the beast browser modal, manages shape adoption (charge deduction and active form state), displays an active transformation banner with beast HP stepper, and clears the active form on Long Rest.

**Blocked by:** 03: Wild Shape Browser Modal with Statblock Inspector & Bookmarking

**Status:** completed

- [x] Render a dedicated Wild Shape card in `FeaturesTab.tsx` whenever the character has the Wild Shape feature (Druid level >= 2).
- [x] Displays a summary of current Wild Shape limits:
  - Max CR (e.g. "Max CR: 1/2 (Circle of the Land)" or "Max CR: 2 (Circle of the Moon)").
  - Movement restrictions: "No Swim / No Fly" (lvl 2-3), "Swim Allowed / No Fly" (lvl 4-7), or "Swim & Fly Allowed" (lvl 8+).
  - Duration: `Math.floor(druidLevel / 2)` hours.
  - "Browse Wild Shapes" button opening `WildShapeModal`.
- [x] Shape Adoption Handler:
  - Adopting a standard beast deducts 1 use from `character.resourceCounters.wild_shape.current`.
  - Adopting an elemental deducts 2 uses from `character.resourceCounters.wild_shape.current`.
  - Sets `character.activeWildShape = { name, source, currentHp, maxHp, ac }`.
- [x] Active Transformation Banner:
  - When `character.activeWildShape` is present, displays a prominent banner:
    - Beast name, source badge, AC badge.
    - Beast HP stepper `[ - ] [ currentHp / maxHp ] [ + ]` (cannot exceed `maxHp`, drops form when 0).
    - "Inspect Statblock" button opening the beast's statblock.
    - "Revert to Normal Form" button that resets `character.activeWildShape = null`.
- [x] Long Rest integration in `src/rules/rest.ts`:
  - `applyLongRest` resets `character.activeWildShape = null` (and resets Wild Shape charges).
  - Unit test in `checks/rest.test.ts` verifies active Wild Shape is cleared on Long Rest.
