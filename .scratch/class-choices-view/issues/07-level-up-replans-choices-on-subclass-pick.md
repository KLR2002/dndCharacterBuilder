# 07: Picking the subclass in the Level-Up Flow brings its class choices

**What to build:** `planLevelUp` (`src/rules/levelUpFlow.ts` ~119-188) reads the new level's class choices (`plan.classChoices`, and whether the Class Choices step applies) from the character's held subclass. When the subclass is picked in the flow's own Subclass step (`setPlanSubclass` ~390; a Fighter 2 → 3 choosing Battle Master), the plan keeps the choices of the level without that subclass: no maneuvers, no Student of War tool pick, and no Class Choices step at all. Picking (or changing) the plan's subclass must re-derive `plan.classChoices` and the step list from the entry with that subclass, keep the picks whose ids are still offered and drop the rest, and leave every other part of the plan (hit points, ASI, spells) as it is. `levelUpClassChoicesView` (`src/rules/classChoices.ts` or `levelUpFlow.ts`) must build its entry with the plan's subclass too. Check whether the Spells step has the same problem with subclass-granted spells and report it (do not fix it here).

**Blocked by:** 05

**Status:** done

**Landed:** merge of c40d471, 52186ce, 32ff248, 46a0bca. `plannedClassEntry` (plan subclass ?? held) feeds `planLevelUp`, `setPlanSubclass(character, plan, name, source, opts)` and `levelUpClassChoicesView`; a subclass pick re-derives `plan.classChoices`, adds or removes the Class Choices step in `STEP_ORDER` and keeps only still-offered picks. Extended in review to the Spells step (`wantsSpellsStep`): picking Eldritch Knight at Fighter 3 brings the Spells step, Champion removes it and its learned spells. New integrated scenarios `Level-Up Flow subclass picks class choices` and `Level-Up Flow subclass picks spells`; `ONLY="Level-Up"` green at 393, the first also at 320 and 1280. check:all and check:live passed.

- [x] Tests (red first): a Fighter 2 → 3 plan that picks Battle Master gets a Class Choices step listing the maneuver pick (three maneuvers) and the Student of War tool pick, applied at Review; switching the plan's subclass to Champion removes the step and its picks.
- [x] Scoped layout: a Level-Up scenario for Fighter 2 → 3 Battle Master reaching the maneuver cards (add one, or extend `Level-Up Flow class choices maneuvers`) at 320, 393, 1280 with `-- --integrated`; check a screenshot. `npm run check:all` passes.
