import type { Character } from "../types/character.ts";
import type { GrantRequirement } from "../types/dnd5e.ts";

/** The subclass a feature belongs to, as a grant's requirement reads it. */
export interface SubclassOwner {
  className: string;
  subclassName: string;
  subclassSource: string | undefined;
}

/**
 * The rule-choice id of the choice a subclass feature offers, read from the feature's Catalog coordinates: the
 * subclass's book, the class, the subclass name, and the feature's name and level. It is the id the Rule Choice
 * rows use for the same choice, so a saved pick is found from the Catalog alone.
 */
export function subclassChoiceId(owner: SubclassOwner, feature: { name: string; level: number }): string {
  return `${owner.subclassSource ?? ""}__${owner.className}__${owner.subclassName}__${feature.name} ${feature.level}`;
}

/**
 * Whether a grant's requirement holds for the feature that carries it: true with no requirement, else the
 * character's pick on the requiring feature's choice names the carrying feature. A requirement is the
 * Catalog's: a grant on an option of an earlier feature's choice, or one the data marks as gated.
 */
export function grantRequirementMet(
  character: Character,
  owner: SubclassOwner,
  requires: GrantRequirement | undefined,
  carryingFeature: string,
): boolean {
  if (!requires) return true;
  const id = subclassChoiceId(owner, { name: requires.feature, level: requires.level });
  const picked = character.ruleChoices?.find((rc) => rc.id === id)?.picked ?? [];
  return picked.some((name) => name.toLowerCase() === carryingFeature.toLowerCase());
}
