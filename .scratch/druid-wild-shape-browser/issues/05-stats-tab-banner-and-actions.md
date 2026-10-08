# 05: Stats Tab Active Form Banner & Actions Integration

**What to build:** A mirrored Active Wild Shape banner on `StatsTab.tsx` during combat, showing beast current HP stepper, AC, and a quick link to inspect the active beast's attack actions and features.

**Blocked by:** 04: Features Tab Integration & Active Transformation State

**Status:** completed

- [x] In `StatsTab.tsx`, if `character.activeWildShape` is present:
  - Render an Active Wild Shape combat banner at the top of the tab.
  - Displays beast name, AC, current HP stepper (`[ - ] [ currentHp / maxHp ] [ + ]`), and "Revert" button.
  - Provides a "View Beast Attacks & Actions" button that opens the beast statblock detail modal directly.
- [x] Maintains full responsive layout compatibility across mobile screen sizes (< 380px compact screens).
- [x] All hooks placed at the top before conditional returns.
- [x] Run `npm run check:all` (`npm test`, `npm run typecheck`, and `npm run lint`) to ensure clean verification across the entire repository.
