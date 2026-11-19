# 03: Level-Up Spells step counts

**What to build:**

- **What is due.** `buildLevelUpPlan` (`src/rules/levelUpFlow.ts`) computes, for the planned class owner, the new cantrips and new spells due. That is `spellCounts` due at `toLevel` minus due at `fromLevel` (0 at a new class's first level; ticket 02's module). For a spellbook, it is the gain at `toLevel`. Store them on the plan, for example `plan.spellsDue: { cantrips, spells } | null`.
- **When the step appears.** Replace `wantsSpellsStep` (~430) so the step appears only when a due count is above 0, or ticket 04's replacement is allowed (leave a hook returning false for now). With no counts (stale catalog, or no numbers), keep today's rule. `setPlanSubclass` re-derives the step (it already calls `wantsSpellsStep`); keep that working for an Eldritch Knight picked during level-up.
- **Completion.** `levelUpStepComplete` "spells" (~797) is true when the plan's `learnedSpells` hold exactly the due cantrips (level 0) and due spells (level 1+). With no counts, true as today.
- **The step's screen.** `SpellsStep` (`src/components/levelUpFlow/SpellsStep.tsx`) shows `"Cantrips 0/1"` and `"Spells 1/2"` above the list. `SpellLearnList` (`src/components/spells/SpellLearnList.tsx`) gets a way to disable unselected rows once a count is full: a per-row disabled predicate, or separate full flags for cantrips and spells. Cantrips and spells fill separately.
- **Review.** The Review step lists the learned spells (check what it shows today).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Tests:
  - A Sorcerer 3 → 4: cantrips due 1, spells due 1. The step is incomplete with 1 spell, and complete with 1 cantrip and 1 spell.
  - A Wizard 2 → 3: spells due 2, cantrips due 0.
  - A Cleric 1 → 2: no Spells step. A Cleric 3 → 4: a Spells step with 1 cantrip.
  - A Fighter 2 → 3 picking Eldritch Knight in the flow (integrated test compendium): the step appears with cantrips 2 and spells 3.
  - A stale compendium: a Sorcerer 3 → 4 has the step and it completes with no picks.
- [ ] `npm run check:all` passes.
- [ ] Scoped layout: `ONLY="Level-Up" WIDTHS=393 npm run layout:check` green, SRD and `-- --integrated`. Scenarios that complete a Spells step with too few or too many picks must be updated to pick the due number; say which. Open the `Level-Up Flow subclass picks spells` screenshot and describe the counters.
