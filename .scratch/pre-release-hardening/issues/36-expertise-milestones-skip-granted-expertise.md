# 36: Expertise milestones do not offer a skill whose Expertise a grant gives

**What to build:** Found while merging ticket 34. A Rogue or Bard with a Knowledge Cleric level is offered, in its Expertise milestone, skills that already carry Expertise from a grant (Arcana picked in Blessings of Knowledge, Nature from Survivalist). Expertise does not stack, so a pick there wastes the slot, and the player sees the same skill doubled in two places, which is what the owner reported as "different skills on the expertise view than on the skills view".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Design notes

- `getAvailableExpertiseMilestones` (`src/rules/expertise.ts`) reads skills from the Proficiency Sheet. Sheet skill entries carry `expertise: true` when a grant gives it (ticket 34). Leave those skills out of every milestone's skill options. Tool options are untouched.
- `pruneInvalidExpertise` releases a saved pick that is no longer offered, with a review notice. The notice for a skill that is still proficient must not say "no longer a proficient skill or tool": it should say the skill already has Expertise from a grant. Check the existing notices and make the new case read right.
- Do not release silently a pick a character saved before this ticket: the notice is the way the player learns the slot is free again.
- The load-time move `moveExpertisePicksToGrants` (`src/rules/proficiencyPicks.ts`) takes a saved Expertise name into a free slot of a marked choice, on every reconcile. Keep it for the old Knowledge milestone picks, and stop it from taking a name another Expertise milestone of the same character holds: a Rogue/Knowledge Cleric who picked Rogue Expertise on a skill in the Blessings pool, with a Blessings slot still free, must keep the pick in the Rogue milestone. A test over an invented class and subclass pins both cases: an old save with no milestone for the name moves it; a character whose Rogue milestone holds the name keeps it there.
- Test first at the milestone seam with invented records.

## Acceptance criteria

- [ ] A skill that carries Expertise from a grant is not offered by the Rogue, Bard, Ranger or feat milestones.
- [ ] A saved pick on such a skill is released with a notice that names the real reason.
- [ ] A Rogue Expertise pick on a skill in a marked choice's pool stays in the Rogue milestone while the choice has a free slot.
- [ ] `npm run check:all` passes.
