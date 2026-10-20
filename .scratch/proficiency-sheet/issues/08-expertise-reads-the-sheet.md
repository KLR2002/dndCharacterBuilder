# 08: Expertise reads the Proficiency Sheet

**What to build:** Expertise options come from the Proficiency Sheet, so background-granted proficiencies and Added Proficiencies (tools) are eligible. An Expertise pick whose proficiency is no longer on the sheet is released from its feature by `reconcile()`, with a notice, and the feature shows fewer picks used (for example 1/2). Nothing re-marks Expertise when a proficiency returns; the player decides. Read the Comment on quick fix 04 (background expertise) first and keep what it found working.

**Blocked by:** 06, quick fix 04

**Status:** ready-for-agent

- [ ] Expertise options for Rogue, Bard, Knowledge Cleric, Ranger and Skill Expert include sheet proficiencies and Added tools.
- [ ] Releasing a pick leaves the feature showing one fewer pick; nothing is re-marked later.
- [ ] Reconciling a valid character returns it unchanged.
- [ ] Tests run at the sheet function and at `reconcile()`.
- [ ] `npm run check:all` passes.
