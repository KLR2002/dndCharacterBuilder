# 02: Pure Wild Shape Rules Engine & Gating

**What to build:** A pure TypeScript rules module in `src/rules/wildShape.ts` that enforces 2014 Fifth Edition Wild Shape constraints for both standard Druids and Circle of the Moon Druids, with unit tests in `checks/wildShape.test.ts`.

**Blocked by:** 01: Scraper Pipeline and Beast Catalog Ingestion

**Status:** completed

- [x] `getWildShapeLimits(character: Character)` computes:
  - `hasWildShape: boolean` (true if character has Druid level >= 2).
  - `maxCr: number` and `maxCrDisplay: string`.
    - Standard Druid: Level 2-3 is CR 1/4 (0.25); Level 4-7 is CR 1/2 (0.5); Level 8+ is CR 1 (1.0).
    - Circle of the Moon: Level 2-5 is CR 1 (1.0); Level 6+ is `Math.floor(druidLevel / 3)` (CR 2 at lvl 6, CR 3 at lvl 9, CR 4 at lvl 12, CR 5 at lvl 15, CR 6 at lvl 18).
  - `canSwim: boolean` (false for Druid level < 4; true for Druid level >= 4 for both standard and Moon Druids).
  - `canFly: boolean` (false for Druid level < 8; true for Druid level >= 8 for both standard and Moon Druids).
  - `maxDurationHours: number` (`Math.floor(druidLevel / 2)`).
  - `canElemental: boolean` (true if Druid level >= 10 and subclass is Circle of the Moon).
- [x] `isBeastEligible(beast: BeastData, character: Character, activeBooks?: string[])`:
  - Returns true if beast satisfies CR limit, movement restrictions (swim/fly), sourcebook membership in `activeBooks`, and elemental qualification.
- [x] `getBeastFilterReason(beast: BeastData, character: Character)`:
  - Returns human-readable explanation if ineligible (e.g. "Requires Level 4 (Swim Speed)", "Requires Level 8 (Fly Speed)", "Requires CR 1/2 (Druid Level 4)", "Requires Circle of the Moon", "Requires Circle of the Moon Level 10").
- [x] Comprehensive unit tests in `checks/wildShape.test.ts` covering standard and Moon Druids across levels 2, 4, 6, 8, 10, 18, movement restrictions, sourcebook filtering, and elemental rules.
