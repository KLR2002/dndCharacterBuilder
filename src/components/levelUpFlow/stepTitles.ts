import type { LevelUpStepId } from "../../rules/levelUpFlow";

/** The on-screen title of each Level-Up Flow step. Step order comes from the plan in `src/rules/levelUpFlow.ts`; only the labels live here. */
export const LEVEL_UP_STEP_TITLES: Record<LevelUpStepId, string> = {
  class: "Class",
  hitPoints: "Hit Points",
  subclass: "Subclass",
  asiFeat: "ASI/Feat",
  classChoices: "Class Choices",
  spells: "Spells",
  review: "Review",
};
