# 12: A step with open picks shows no tick

**What to build:**

- **The problem.** `src/app/build/[id].tsx` ticks a step when `status === "finished"`. A finished Character reports every step finished, so Edit Build ticks Class Choices with picks open, and a draft keeps its tick when the player goes back and clears a pick.
- **The fix.** `CreationStep` in `src/rules/creationFlow.ts` gains `done`: the status is finished and, for Subclass, Class Choices and ASI/Feats, the step is valid. The build screen reads `done: step.done`.
- **Why only those three.** Their validity asks only for picks (ASI/Feats for its slots, not for a feat's own picks). The other steps' validity is a creation gate that a finished Character can fail with nothing to pick: Equipment after its claim on an older save, Spells with a scribed spellbook, Review through either. Those keep their tick.
- Status, validity, the needs-attention marks and the buttons stay as they are.

**Blocked by:** None

**Status:** done

**Landed:** merge 2db0a0c4 (7668296d), and 2f7312eb for the comment.
- **No false untick found:** 1187 class, subclass and level builds and 26 optional features on the live catalog all reach a ticked Class Choices, and so do the four old skill-pick save shapes tried through the load path.
- **Seen on web with the integrated catalog at 320 and 1280:** Class Choices has no tick with the Expertise pick open and gains it on the pick.
- check:all, check:live and the full layout check (SRD and integrated) passed. Android not checked.
- **Found, not fixed:** Race and Background keep their tick with their own picks open (a background's languages, a race's skill), and ASI/Feats with a chosen feat's own picks open (Skill Expert's skill). No rule says whether those picks are complete; `isCreationStepValid` asks only that the record is picked.

- [x] Tests in `checks/creationFlow.test.ts`, red first:
  - A finished Character: Class Choices, Subclass and ASI/Feats are each not done with a pick open and done once picked.
  - A finished Character whose Equipment step is invalid still has it done.
  - A draft: a finished Class Choices step with a cleared pick is not done; current and locked steps are never done.
  - A finished Character with an Expertise pick open (a Skill Expert origin feat) has Class Choices not done.
- [x] `npm run check:all` passes.
- [x] Seen in the running app at 320 and 1280 (main session).
