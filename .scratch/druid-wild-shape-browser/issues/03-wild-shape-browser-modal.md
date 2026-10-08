# 03: Wild Shape Browser Modal with Statblock Inspector & Bookmarking

**What to build:** An interactive `WildShapeModal` that enables players to search, filter, star/bookmark favorite shapes, and inspect full Monster Manual-style statblocks for any eligible or locked beast.

**Blocked by:** 02: Pure Wild Shape Rules Engine & Gating

**Status:** completed

- [x] `WildShapeModal.tsx` provides:
  - Text search by creature name.
  - CR filter dropdown / chip selection.
  - Movement speed filter chips (All, Walking, Swimming, Flying).
  - Star / Favorites filter toggle showing only beasts in `character.favoriteWildShapes`.
  - "Show All" toggle (default false): when off, hides ineligible beasts; when on, displays ineligible beasts dimmed with their requirement badge from `getBeastFilterReason`.
- [x] List items show beast name, CR badge, size, speed badges (walk/swim/fly), source badge, and star button to toggle favorite status in `character.favoriteWildShapes`.
- [x] Statblock Inspector displays:
  - Header: Name, size, creature type, alignment, sourcebook badge, CR and XP.
  - Armor Class (and natural armor label if present) and Hit Points (average and hit dice formula).
  - Speed badges (walk, swim, fly, climb, burrow).
  - Ability scores table (STR, DEX, CON, INT, WIS, CHA) with calculated ability score modifiers.
  - Senses (darkvision, blindsight, passive perception) and skills.
  - Traits (Pack Tactics, Keen Smell, Charge, etc.) with title and description.
  - Actions with attack bonus, reach/range, damage formula, damage type, and description.
- [x] "Adopt Shape" button:
  - For standard beasts: enables adoption if `resourceCounters.wild_shape.current >= 1`.
  - For Elementals: enables adoption if `resourceCounters.wild_shape.current >= 2` (or shows "Requires 2 Wild Shape charges").
  - Invokes `onAdopt(beast)` callback.
- [x] Complies with mobile UX patterns (scrollable, responsive layout, min 44px tap targets).
