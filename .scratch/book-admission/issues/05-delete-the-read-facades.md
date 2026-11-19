# 05: Delete the read facades and guard admission

**What to build:**

- **Delete `src/services/dndRules.ts`.** Its 7 importers import from the rules modules it re-exports (`abilities.ts`, `proficiencies.ts`, `slots.ts`, `hp.ts`, `grantedFeatures.ts`, `hitDice.ts`). Use the real names where a re-export renamed one (`calculateTotalLevel` → `totalLevel`, ...). Update `checks/spellsTabComponents.test.ts` if it allows `dndRules` imports.
- **Delete `src/services/dataService.ts`.** Its importers (`src/app/levelup/[id].tsx`, `CharacterContext.tsx`, and the components under `src/components/`) read the Compendium the way other components do:
  - `getX(activeBooks)` → `currentCompendium().for(activeBooks).x()` or `catalogListings({ activeBooks }).x()`
  - `findX` → `currentCompendium().findX`
  - `isCompendiumIntegrated()` → `currentCompendium().integrated`

  Use whichever form the file's neighbours already use.
- **Components ask `admits`.** These checks become `admits` on the listings for the active books:
  - `src/components/builder/AncestrySection.tsx` ~103-114: VRGR and TCE.
  - `src/components/tabs/FeaturesTab.tsx` ~80: MM.
  - `src/components/WildShapeModal.tsx` ~72: MM.
- **Guard.** Add `checks/bookAdmissionGuard.test.ts`. Under `src/rules`, `src/components` and `src/app`, outside `src/services/compendium.ts`, no line may:
  - upper- or lower-case a value named like books (`activeBooks`, `books`, `upperBooks`)
  - call `.includes(`, `.some(` or `.has(` on `activeBooks`
  - compare a source with `SRD_SOURCE` or `"SRD"`

  Keep an allow-list with a reason per entry. Examples: `fightingStyles.ts`'s `heldSourceOf` fallback; `CharacterContext.tsx`'s `setActiveBooks([SRD_SOURCE])`; `srdNames.ts`, whose migration renames only SRD-sourced saves. Make the guard fail on a planted violation once, then remove the plant.

**Blocked by:** 02, 03, 04

**Status:** ready-for-agent

- [ ] `ls src/services/dataService.ts src/services/dndRules.ts` fails, and `grep -rn "dataService\|dndRules" src checks` finds nothing.
- [ ] Paste the guard's allow-list.
- [ ] `npm run check:all` and `npm run check:live` pass.
- [ ] Scoped layout, `WIDTHS=393`, SRD and `-- --integrated`, green: `ONLY=Builder`, `ONLY=Features`, `ONLY="Wild Shape"`, `ONLY=Inventory`, `ONLY="Level-Up"`. Name any touched screen without a scenario.
