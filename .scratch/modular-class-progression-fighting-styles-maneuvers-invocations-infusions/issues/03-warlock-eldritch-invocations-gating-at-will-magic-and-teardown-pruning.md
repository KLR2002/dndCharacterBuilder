# 03: Warlock Eldritch Invocations Gating, At-Will Magic & Teardown Pruning

**What to build:** Eldritch Invocations progression engine in `ruleChoices` scaling from 2 to 8 invocations across Warlock levels (2, 5, 7, 9, 12, 15, 18); prerequisite validation checking Warlock level, Pact Boon (*Blade*, *Tome*, *Chain*, *Talisman*), and *Eldritch Blast*; at-will spells displayed on `SpellsTab.tsx` with zero slot costs; passive damage bonuses for *Agonizing Blast*; teardown pruning of orphaned invocations with alerts in `character.needsReview`; and *Eldritch Adept* feat integration.

**Blocked by:** 01 (builds on rule choice foundations).

**Status:** closed

- [x] In `src/rules/ruleChoices.ts`, implement `warlockInvocationChoices(character: Character, activeBooks?: string[])` scaling capacity from 2 to 8 across Warlock level milestones.
- [x] Implement prerequisite validation filtering or tagging unmet requirements (Warlock level, Pact Boon, *Eldritch Blast*).
- [x] In `src/components/tabs/SpellsTab.tsx`, render at-will invocation spells (*Mage Armor*, *False Life*, *Disguise Self*, etc.) in cantrip/at-will sections with `[At Will - Invocation]` badges and no spell slot deduction.
- [x] In `src/rules/attacks.ts`, apply Charisma modifier damage bonus to *Eldritch Blast* attacks if *Agonizing Blast* is chosen.
- [x] In `src/rules/builderTransitions.ts`, validate chosen invocations during class deleveling or Pact Boon modification; prune orphaned invocations from `character.ruleChoices` and record notices in `character.needsReview`.
- [x] In `src/components/builder/AsiFeatSection.tsx`, provide an inline invocation picker for the *Eldritch Adept* feat, validating prerequisites (only accessible if character is a Warlock meeting them).
- [x] Verify with unit tests in `checks/eldritchInvocations.test.ts` covering prerequisite gating, at-will spell presentation, teardown pruning, and feat validation.
