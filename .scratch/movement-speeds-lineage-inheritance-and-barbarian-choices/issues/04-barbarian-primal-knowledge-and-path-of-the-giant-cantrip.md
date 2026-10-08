# 04: Barbarian Primal Knowledge and Path of the Giant Cantrip

**What to build:** In `src/rules/ruleChoices.ts` and `ClassProgressionSection.tsx`, implement TCoE *Primal Knowledge* at Barbarian levels 3 and 10 granting a choice from unchosen Barbarian class skills when the optional feature is enabled. Implement *Path of the Giant: Giant Power* at level 3 offering *Druidcraft* vs *Thaumaturgy*, injecting the chosen cantrip with Wisdom modifier into `knownSpells` and displaying on `ActionsTab.tsx` and `SpellsTab.tsx`.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] In `src/rules/ruleChoices.ts`, add `Primal Knowledge` rule choices at Barbarian level 3 and level 10:
  - Gated by active optional feature `Primal Knowledge`.
  - Offers unchosen skills from the Barbarian 1st-level list (*Animal Handling, Athletics, Intimidation, Nature, Perception, Survival*).
  - Selected skills resolve into `character.chosenSkills` or evaluated proficiencies.
- [x] In `src/rules/ruleChoices.ts`, add `Path of the Giant: Giant Power` at Barbarian level 3 offering *Druidcraft* and *Thaumaturgy* (`choose: 1`).
- [x] When the Giant cantrip is selected, add to `knownSpells` with `ownerKey: "Barbarian__BGG"` and `ability: "wis"`.
- [x] Display the chosen cantrip with Wisdom spell save DC and spell attack bonus on `SpellsTab.tsx` and `ActionsTab.tsx`.
- [x] Tested via `checks/barbarianChoices.test.ts` including boundary checks (level 10 not offered at level 3, pre-unlock level 2 offers 0 choices).
