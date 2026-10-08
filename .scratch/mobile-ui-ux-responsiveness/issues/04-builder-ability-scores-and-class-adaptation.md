# 04: Builder Ability Scores & Class Progression Adaptation

**What to build:** In `AbilityScoresSection.tsx` and `builderStyles.tsx`, dynamically render ability score cards as full-width horizontal rows with large 44px stepper buttons on compact screens (< 380px) to prevent the 12px stepper overflow bug, while retaining the 2-column card grid on larger viewports. In `ClassProgressionSection.tsx`, implement a 2-tier stacked layout for multiclass entries so long archetype titles (e.g. Arcane Trickster Rogue) never truncate.

**Blocked by:** 01-responsive-layout-foundation

**Status:** ready-for-agent

- [ ] In `AbilityScoresSection.tsx`, switch from 2-column card grid to full-width horizontal rows on compact screens (`isCompact < 380px`).
- [ ] Ensure stepper `[-]` and `[+]` touch targets are 44×44px with zero card overflow on 320px screens.
- [ ] In `ClassProgressionSection.tsx`, stack subclass selection into a full-width row below the class name and level stepper on mobile.
- [ ] In `StartingGrantsSection.tsx` and `BackgroundSection.tsx`, ensure action buttons use responsive widths and never clip.
- [ ] Verify all tests, type checks, and lint pass.
