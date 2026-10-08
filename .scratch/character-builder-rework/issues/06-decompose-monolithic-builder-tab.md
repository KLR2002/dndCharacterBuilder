# 06: Decompose Monolithic BuilderTab into Modular Subcomponents

**What to build:** Refactor `BuilderTab.tsx` (over 2,500 lines) into cohesive, single-responsibility subcomponents to eliminate the Divergent Change code smell and make future builder maintenance straightforward. Decompose the tab into clean subcomponents: AbilityScoresSection, AncestrySection, BackgroundSection, ClassProgressionSection, AsiFeatSection, and StartingGrantsSection. Preserve all existing state wiring, event callbacks, and builder transitions without introducing regressions.

**Blocked by:** 02: Half-Feat Ability Score Increases in ASI/Feat Selection, 03: Starting Grants Reconciliation and Mode Switching

**Status:** closed

- [x] `BuilderTab.tsx` is broken down into focused section subcomponents.
- [x] Each section subcomponent manages only its relevant domain fields and callbacks.
- [x] No regression in character building: scores, races, backgrounds, classes, ASIs, feats, and starting grants work identically.
- [x] All unit checks, TypeScript type checks, and ESLint checks pass with 0 errors.
