import type { Character } from "../types/character.ts";

/**
 * A subclass feature that is one option of a Rule Choice. The Catalog prints every option
 * as a feature of its own, so the Totem Warrior's Tiger carries its skill grant at 6th level whatever
 * the character chose. Its grants apply only while the character has picked that option.
 *
 * The choice ids are the Subclass Choice Table's frozen ids. A feature not listed here is not an option.
 */
interface OptionFeatureChoice {
  choiceId: string;
  className: string;
  subclassName: string;
  level: number;
  options: readonly string[];
}

const OPTION_FEATURE_CHOICES: readonly OptionFeatureChoice[] = [
  {
    choiceId: "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6",
    className: "Barbarian",
    subclassName: "Path of the Totem Warrior",
    level: 6,
    options: ["Bear", "Eagle", "Elk", "Tiger", "Wolf"],
  },
];

/** Whether a subclass feature's grants apply to this character: true unless the feature is an unpicked option. */
export function optionGrantApplies(
  character: Character,
  owner: { className: string; subclassName: string | undefined },
  feature: { name: string; level: number },
): boolean {
  const entry = OPTION_FEATURE_CHOICES.find(
    (choice) =>
      choice.className.toLowerCase() === owner.className.toLowerCase() &&
      choice.subclassName.toLowerCase() === (owner.subclassName ?? "").toLowerCase() &&
      choice.level === feature.level &&
      choice.options.some((option) => option.toLowerCase() === feature.name.toLowerCase()),
  );
  if (!entry) return true;
  const picked = character.ruleChoices?.find((rc) => rc.id === entry.choiceId)?.picked ?? [];
  return picked.some((name) => name.toLowerCase() === feature.name.toLowerCase());
}
