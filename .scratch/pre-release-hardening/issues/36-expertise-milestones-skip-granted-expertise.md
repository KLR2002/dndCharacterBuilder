# 36: Expertise milestones do not offer a skill whose Expertise a grant gives

**What to build:** Found while merging ticket 34. A Rogue or Bard with a Knowledge Cleric level is offered, in its Expertise milestone, skills that already carry Expertise from a grant (Arcana picked in Blessings of Knowledge, Nature from Survivalist). Expertise does not stack, so a pick there wastes the slot, and the player sees the same skill doubled in two places, which is what the owner reported as "different skills on the expertise view than on the skills view".

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merged from `pr/36-expertise-milestones-skip-granted` (572d18d, 1937537). `check:all` passes on the merged tip (1212 app tests, 8 skipped, 192 scraper tests); `check:live` 54 of 54 on the branch. `getAvailableExpertiseMilestones` leaves out skills whose sheet entry has `expertise: true`; `pruneInvalidExpertise` releases a saved pick on such a skill with the notice `<skill> Expertise removed: <skill> already has Expertise from a grant`; `moveExpertisePicksToGrants` keeps a name an Expertise milestone of the character holds. `skillsBaseline.json` re-recorded through its recorder: 10 rows, the Scout Rogue's expertise-eligible list at levels 3, 6, 11, 14 and 17 in two book sets loses Nature and Survival. Open items: a Rogue pick on a Blessings-pool skill that no milestone holds still moves into a free Blessings slot (the old-save case); `review:grants` does not list `REVIEWED_NOT_A_SKILL_GRANT`; a comment in `skillsCharacterization.test.ts` about re-reviewing the allowlist may be stale.

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
