# 12: A step with open picks shows no tick

**What to build:**

- **The problem.** `src/app/build/[id].tsx` ticks a step when `status === "finished"`. A finished Character reports every step finished, so Edit Build ticks Class Choices with picks open, and a draft keeps its tick when the player goes back and clears a pick.
- **The fix.** `CreationStep` in `src/rules/creationFlow.ts` gains `done`: the status is finished and, for Subclass, Class Choices and ASI/Feats, the step is valid. The build screen reads `done: step.done`.
- **Why only those three.** Their validity means exactly "a pick is open". The other steps' validity is a creation gate that a finished Character can fail with nothing to pick: Equipment after its claim on an older save, Spells with a scribed spellbook, Review through either. Those keep their tick.
- Status, validity, the needs-attention marks and the buttons stay as they are.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Tests in `checks/creationFlow.test.ts`, red first:
  - A finished Character: Class Choices, Subclass and ASI/Feats are each not done with a pick open and done once picked.
  - A finished Character whose Equipment step is invalid still has it done.
  - A draft: a finished Class Choices step with a cleared pick is not done; current and locked steps are never done.
  - A finished Character with an Expertise pick open (a Skill Expert origin feat) has Class Choices not done.
- [ ] `npm run check:all` passes.
- [ ] Seen in the running app at 320 and 1280 (main session).
