# 10: Skill Expert and Prodigy as origin feats give Expertise

**What to build:**

- **The problem.** `milestonesFromSheet` (`src/rules/expertise.ts`) looks for Skill Expert and Prodigy in `character.asiSelections` only. Taken as an origin feat (`character.originFeats`: a race's, a lineage's or a background's), neither offers its Expertise pick.
- **The fix.** Both checks ask `hasFeat(character, name)` (`src/rules/abilities.ts`), which reads both lists. Milestone ids, labels, counts and options stay as they are.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Tests in `checks/expertise.test.ts`, red first:
  - Each of the two feats as an origin feat gives its one milestone.
  - A level 1 character with Skill Expert as an origin feat: the Class Choices step applies, is incomplete until the pick, and is complete after it.
  - The pick survives `reconcile`, and removing the origin feat releases it with a notice.
  - A feat held in both lists gives one milestone; an origin entry of another feat gives none.
  - A level up does not offer the held origin feat's milestone again.
- [ ] `npm run check:all` and `npm run check:live` pass.
- [ ] Seen in the running app: a Variant Human Skill Expert picks Expertise and the skill shows it (main session).
