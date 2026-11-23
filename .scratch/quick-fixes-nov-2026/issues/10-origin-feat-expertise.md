# 10: Skill Expert and Prodigy as origin feats give Expertise

**What to build:**

- **The problem.** `milestonesFromSheet` (`src/rules/expertise.ts`) looks for Skill Expert and Prodigy in `character.asiSelections` only. Taken as an origin feat (`character.originFeats`: a race's, a lineage's or a background's), neither offers its Expertise pick.
- **The fix.** Both checks ask `hasFeat(character, name)` (`src/rules/abilities.ts`), which reads both lists. Milestone ids, labels, counts and options stay as they are.

**Blocked by:** None

**Status:** done

**Landed:** merge b64e6497 (cb7d182e) and a review fix to one test.
- **Fix:** both checks ask `hasFeat`. Five tests, three red before the fix.
- **Seen on web with the integrated catalog at 1280:** a Variant Human Skill Expert picks Stealth on Class Choices; the pick saves and Stats shows +4.
- **Found, not fixed:** when an Expertise pick's feat or class level goes, `pruneInvalidExpertise` says the skill "is no longer a proficient skill or tool" even when it still is. Edit Build shows Class Choices ticked while picks are open.
- check:all, check:live and the full layout check (SRD and integrated) passed.

- [x] Tests in `checks/expertise.test.ts`, red first:
  - Each of the two feats as an origin feat gives its one milestone.
  - A level 1 character with Skill Expert as an origin feat: the Class Choices step applies, is incomplete until the pick, and is complete after it.
  - The pick survives `reconcile`, and removing the origin feat releases it with a notice.
  - A feat held in both lists gives one milestone; an origin entry of another feat gives none.
  - A level up does not offer the held origin feat's milestone again.
- [x] `npm run check:all` and `npm run check:live` pass.
- [x] Seen in the running app: a Variant Human Skill Expert picks Expertise and the skill shows it (main session).
