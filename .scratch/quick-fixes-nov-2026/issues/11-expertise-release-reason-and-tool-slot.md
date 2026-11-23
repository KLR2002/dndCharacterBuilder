# 11: Expertise releases give their reason, and a tool pick finds its slot

**What to build:**

- **Wrong reason.** `pruneInvalidExpertise` (`src/rules/expertise.ts`) treats "no milestone offers it" as "not proficient". So a pick released because its feat or class level went says the skill "is no longer a proficient skill or tool" while the Character still holds it. The reasons, first match wins:
  1. a grant gives its Expertise: `<X> Expertise removed: <X> already has Expertise from a grant` (unchanged);
  2. a milestone offers it, or the Character holds it and has no milestone at all: `<X> Expertise removed: no Expertise slot left`;
  3. the Character holds it and no milestone offers it (Thieves' Tools with only Bard milestones): `<X> Expertise removed: no Expertise slot takes <X>`;
  4. otherwise: `<X> Expertise removed: <X> is no longer a proficient skill or tool` (unchanged).
  "Holds" is a proficient skill from `skills(character, sheet.skills)` or a tool on the Proficiency Sheet.
- **Same wrong reason on the card.** The invalid-pick warning in `src/components/builder/ClassChoiceCards.tsx` says "The following choices are no longer proficient:". It reads "Expertise isn't available for:".
- **Lost pick.** `getMilestonePicks` fills milestones in saved order. Skill picks fill every Rogue slot, and Thieves' Tools, which only a Rogue slot takes, has none while a feat or Bard slot is open. A Rogue 5 with Skill Expert and `[Stealth, Perception, Deception]` who picks Acrobatics then Thieves' Tools at level 6 loses the tool with no notice: the plan accepts it, `toggleExpertiseChoice` refuses it on apply.
  - Placement keeps saved order and first fit. When a pick has no open milestone that takes it, the last placed pick that can move to an open milestone moves out of a milestone that takes the new pick. An arrangement that works today stays as it is.
  - `toggleExpertiseChoice` accepts an item when `getMilestonePicks` places it appended to the current picks.

**Blocked by:** None

**Status:** done

**Landed:** merge ad5dc1bf (70c8dd79, f621cf83).
- **Reasons and placement:** as above. An exhaustive check of 9906 milestone and pick arrangements found every one that placed all picks before unchanged, and every one now placed as fully as its slots allow.
- **Seen on web with the integrated catalog at 320 and 1280:** the Rogue 6 level up saves Thieves' Tools, and lowering the Rogue away gives the two new reasons. The card's warning text was not seen on screen.
- check:all, check:live and the full layout check (SRD and integrated) passed. Android not checked.
- **Found, not fixed:** a feat picked in the Level-Up Flow never adds its Expertise milestone to the plan (Skill Expert saves with the pick open); it is picked in Edit Build. Fixed in 13.

- [x] Tests in `checks/expertise.test.ts`, red first:
  - Removing the Skill Expert origin feat with the skill still proficient gives exactly "no Expertise slot left" (tighten the existing test).
  - Lowering a Rogue from 6 to 5 with no skill lost gives "no Expertise slot left".
  - Thieves' Tools held with only a Bard milestone gives "no Expertise slot takes".
  - The Rogue 5 level up above, through `planLevelUp`, `setPlanExpertisePick` and `applyLevelUpPlan`, saves all five picks in both pick orders.
  - Bard 3 with two picks, then Rogue 1 with a skill and Thieves' Tools: all four are placed and Class Choices' Expertise is filled.
- [x] The existing notices for a skill that is really lost keep their text.
- [x] `npm run check:all` and `npm run check:live` pass.
