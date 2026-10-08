# 05: Character Sheet Combat & Actions Mobile Polish

**What to build:** In `StatsTab.tsx` and `ActionsTab.tsx`, wrap combat stat tiles (Armor Class, Initiative, Speed, Proficiency Bonus, Inspiration) into a responsive card grid with `flexWrap: "wrap"` so numbers remain legible without horizontal squishing. Apply `hitSlop` (≥40px tap zones) to death save bubbles and active condition badges. In `ActionsTab.tsx`, optimize weapon attack cards and dual-wielding bonus action cards with prominent attack/damage badges and tap-friendly touch targets.

**Blocked by:** 01-responsive-layout-foundation

**Status:** ready-for-agent

- [ ] In `StatsTab.tsx`, wrap combat stats into a responsive grid with minimum readable card width.
- [ ] In `StatsTab.tsx`, add `hitSlop` to death save circles and condition dismiss icons.
- [ ] In `ActionsTab.tsx`, ensure equipped weapon cards and off-hand bonus action cards format cleanly on 320px screens.
- [ ] Verify clean layout on 320px viewport without horizontal clipping.
- [ ] Verify all tests, type checks, and lint pass.
