# 02: Character Sheet Multi-Speed Presentation and Detail Modal

**What to build:** In `StatsTab.tsx`, update the `SPEED` stat box to display the primary walking speed prominently and render compact secondary badges for active non-zero movement modes (`🏊 30 ft`, `🧗 30 ft`, `🪽 50 ft`, or `🪽 0 ft (Armor)` when restricted). Tapping the card opens a detail modal with the full calculation breakdown and armor source conditions.

**Blocked by:** 01: Multi-Mode Movement Speeds Engine and Armor Flight Gating

**Status:** closed

- [x] In `StatsTab.tsx`, call `characterSpeeds(currentCharacter, ...)` to derive active movement modes.
- [x] Display primary walking speed in the main value text of the `SPEED` stat box.
- [x] Render compact secondary badges within/below the stat box for non-zero swim, climb, and fly speeds.
- [x] If flying speed is restricted by medium or heavy armor, display `🪽 0 ft (Armor)` in warning styling.
- [x] Tapping the speed card opens `detailModal` displaying the itemized breakdown of each active speed, bonus sources (Monk Unarmored Movement, Barbarian Fast Movement, feats), and armor restrictions.
- [x] Verified on mobile (320px viewport) without clipping or horizontal overflow.
