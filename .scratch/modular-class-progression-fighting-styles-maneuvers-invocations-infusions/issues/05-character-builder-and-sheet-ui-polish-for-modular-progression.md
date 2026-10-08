# 05: Character Builder & Sheet UI Polish for Modular Progression

**What to build:** Full UI polish and mobile responsiveness across the builder and character sheet: integrate dedicated progression sections in `ClassProgressionSection.tsx` and `AsiFeatSection.tsx` for fighting styles, maneuvers, invocations, and infusions; render transparent breakdown badges (`[Archery +2]`, `[Defense +1]`, `[Infused +1]`); ensure all buttons meet touch targets ($\ge 44$px hitSlop); and end-to-end verification.

**Blocked by:** 01, 02, 03, 04 (unifies and polishes all modular progression features).

**Status:** closed

- [x] In `src/components/builder/ClassProgressionSection.tsx`, render dedicated modular progression choice cards below relevant class/subclass headers (Fighting Styles for Fighter/Paladin/Ranger, Maneuvers for Battle Master, Invocations for Warlock, Infusions for Artificer).
- [x] In `src/components/builder/AsiFeatSection.tsx`, render dynamic sub-choice selectors for *Fighting Initiate*, *Martial Adept*, and *Eldritch Adept*.
- [x] On `ActionsTab.tsx` and `StatsTab.tsx`, display clear breakdown badges on weapon attack and AC tiles (`[Archery +2]`, `[Defense +1]`, `[Infused +1]`).
- [x] Ensure all interactive buttons, checkboxes, and chips have touch targets $\ge 44$px with `hitSlop`.
- [x] Verify that `npm run check:all` passes with 0 test failures, 0 TypeScript errors, and 0 Expo lint errors across all test suites.
