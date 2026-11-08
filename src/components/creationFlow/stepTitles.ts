import type { CreationStepId } from "../../types/character";

/** The on-screen title of each Creation Step. Step order and status come from `src/rules/creationFlow.ts`; only the labels live here. */
export const STEP_TITLES: Record<CreationStepId, string> = {
  class: "Class",
  subclass: "Subclass",
  race: "Race",
  subrace: "Subrace",
  background: "Background",
  abilities: "Abilities",
  classChoices: "Class Choices",
  asiFeats: "ASI/Feats",
  spells: "Spells",
  equipment: "Equipment",
  details: "Details",
  review: "Review",
};
