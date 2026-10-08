# 05: Totem Warrior Animal Choice Milestones and Rage Integration

**What to build:** In `src/rules/ruleChoices.ts` and `ClassProgressionSection.tsx`, implement 3 dedicated single-choice `RuleChoice` milestones for Path of the Totem Warrior: `Totem Spirit` at level 3, `Aspect of the Beast` at level 6, and `Totemic Attunement` at level 14. Enforce `choose: 1` per milestone, allow different animals across milestones, and gate SCAG options (*Elk*, *Tiger*) by `activeBooks`. In `ActionsTab.tsx` and `FeaturesTab.tsx`, dynamically augment the *Enter Rage* action card with Bear Totem damage resistances when Bear is chosen.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] In `src/rules/ruleChoices.ts`, define 3 separate subclass `RuleChoice` milestones for `Path of the Totem Warrior`:
  - `Totem Spirit (3rd Level)`: `choose: 1`, options: `Bear`, `Eagle`, `Wolf` (+ `Elk`, `Tiger` if SCAG active).
  - `Aspect of the Beast (6th Level)`: `choose: 1`, options: `Bear`, `Eagle`, `Wolf` (+ `Elk`, `Tiger` if SCAG active).
  - `Totemic Attunement (14th Level)`: `choose: 1`, options: `Bear`, `Eagle`, `Wolf` (+ `Elk`, `Tiger` if SCAG active).
- [x] Enforce strict single-choice per milestone while allowing distinct choices across milestones.
- [x] Gate SCAG options (*Elk*, *Tiger*) strictly by `activeBooks`.
- [x] Render milestone pickers in `ClassProgressionSection.tsx` under Subclass Choices.
- [x] In `ActionsTab.tsx` and `FeaturesTab.tsx`, augment *Enter Rage* description to state: *"While raging, Bear Totem grants resistance to all damage except psychic."* when Bear is chosen at 3rd level.
- [x] Tested via `checks/barbarianChoices.test.ts` including negative boundary cases (levels 6/14 not offered at level 3, SCAG exclusions when SCAG inactive).
