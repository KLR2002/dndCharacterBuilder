# 0006: Wild Shape Beast Browser and Transformation Architecture

## Context

In Fifth Edition 2014 Dungeons & Dragons, Druids gain the *Wild Shape* feature at 2nd level, allowing them to assume the shape of a beast they have seen before. The mechanics involve distinct constraints across progression:
1. **Challenge Rating & Movement Restrictions**: Standard Druids scale from CR 1/4 (no swim/fly) at 2nd level to CR 1/2 (no fly) at 4th level, and CR 1 (flying allowed) at 8th level. Circle of the Moon Druids (*Circle Forms*) expand this to CR 1 at 2nd level and $\lfloor\text{level}/3\rfloor$ starting at 6th level (up to CR 6 at 18th level), while continuing to respect movement mode level restrictions.
2. **Elemental Wild Shape**: At 10th level, Circle of the Moon Druids can expend two uses of Wild Shape simultaneously to assume the form of an Air, Earth, Fire, or Water Elemental (CR 5).
3. **Data Availability**: The application lacked monster and beast statblocks. Upstream 5eTools stores creatures across source-specific bestiary files (`bestiary-mm.json`, `bestiary-vgm.json`, etc.).
4. **Table Utility vs State Complexity**: A pure reference viewer requires players to manually track beast HP and deduct counters, while a full character sheet statblock override destructively interferes with multiclassing, mental ability retention (INT/WIS/CHA), and proficiencies.

## Decision

1. **Scraping Pipeline & Beast Catalog (`beasts.json`)**:
   - Create a dedicated scraper in `dnd5eToolsScrap/src/scrapers/beasts.ts` to ingest all official `type: "beast"` creatures up to CR 6 (excluding swarms), plus the four 2014 Circle of the Moon CR 5 Elementals (Air, Earth, Fire, Water).
   - Store formatted statblocks in `src/data/beasts.json` (size, AC, HP, hit dice formula, speeds, ability scores, senses, traits, actions, CR, and source).
   - Expose catalog access via `getBeasts(activeBooks?: string[])` in `src/services/dataService.ts`.

2. **Pure Rules Engine (`src/rules/wildShape.ts`)**:
   - Provide `getWildShapeLimits(character)` returning maximum CR, allowed movement speeds (swim, fly), maximum duration in hours ($\lfloor\text{druidLevel}/2\rfloor$), and elemental eligibility.
   - Provide `isBeastEligible(beast, character, activeBooks)` and `getBeastFilterReason(beast, character)` to enforce level, CR, movement mode, and sourcebook boundaries.

3. **Active Transformation State & Bookmarking**:
   - Add `favoriteWildShapes?: string[]` to `Character` for persistent bookmarking/favoriting ("seen beasts").
   - Add `activeWildShape?: { name: string; source: string; currentHp: number; maxHp: number; ac: number } | null` to track current beast form and beast hit points.
   - Tapping "Adopt Shape" decrements 1 Wild Shape charge (or 2 charges for Moon Druid Elementals) and sets `activeWildShape`.
   - Managing beast HP is isolated to the Active Wild Shape tracker; dropping the form or reducing beast HP to 0 clears the active state banner without destructively modifying base character stats.

4. **UI Integration**:
   - Render a dedicated Wild Shape card in `FeaturesTab.tsx` summarizing rules limits and housing the active transformation controls.
   - Display a mirrored active transformation status banner at the top of `StatsTab.tsx` with beast AC, HP tracker, and quick link to beast actions.
   - Render a full `WildShapeModal` with text search, CR filter, speed filters, favorites toggle, "Show All" toggle (dimming locked forms with requirement badges), and comprehensive Monster Manual-style statblock inspect views.

## Consequences

- Druid players gain a fast, comprehensive, source-filtered Wild Shape browser strictly compliant with 2014 rules.
- Beast combat statistics are easily accessible during encounters without corrupting the character's base stats or multiclass progression.
- Circle of the Moon high-CR forms and Elemental Wild Shape are cleanly supported with automated charge validation.
