# 05: Ancestry Builder UI Declarative Adapter Migration

**What to build:** Refactor `src/components/builder/AncestrySection.tsx` into a lean, declarative presentation component driven by `resolveAncestryState` and `applyAncestryChoice`. Strip out imperative string matching (e.g. `subraceName?.includes("High")`), synthetic ID fabrication (e.g. `"PHB__Elf__PHB__High Elf__Cantrip"`), and component-level rule branching. Reduce component length from 1,020 lines to approximately 350 lines of pure UI layout.

**Blocked by:** 04: Deep Ancestry Resolution & Rule Choices Engine.

**Status:** done

- [x] Refactor `AncestrySection.tsx` to read all traits, choices, origin feat status, and cantrip picker visibility from `resolveAncestryState`.
- [x] Dispatch user picks through `applyAncestryChoice` and `applyAncestrySelection`.
- [x] Remove hardcoded synthetic ID strings and subrace name pattern matching from the component.
- [x] Verify complete UI interactivity on mobile viewports: ancestry selection, variant feature picking, origin feat assignment, and cantrip selection.
- [x] Run `EXPO_NO_TELEMETRY=1 npm run lint`, `npx tsc --noEmit`, and `npm test` to verify zero errors and clean passes.

