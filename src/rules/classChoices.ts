import type { ActiveBooks } from "../constants/books.ts";
import type { Character, CharacterClass } from "../types/character.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { catalogListings } from "./catalogs.ts";
import type { AvailableRuleChoice, ChoiceGroup } from "./choices/types.ts";
import { availableSubclassRuleChoices } from "./ruleChoices.ts";
import { proficiencyChoiceOffers, skillPickOffers, type SkillPickOffer } from "./proficiencyChoiceOffers.ts";
import { featuresOf, skillChoiceOffers, type SkillChoiceOffer } from "./proficiencySheet.ts";
import { getAvailableExpertiseMilestones, getMilestonePicks } from "./expertise.ts";
import { getAvailableOptionalFeatures, type OptionalFeatureOption } from "./optionalFeatures.ts";

/**
 * The one answer to "which choices does this class bring at this level for this character": the choices
 * the class brings for the levels after `fromLevel` up to the entry's level - its starting skill pick
 * when it is the character's first class, its class and subclass Proficiency Choices (a later class's
 * multiclass skill pick included), and its class and subclass rule choices. The Creation Flow reads it
 * over the whole held level, the Level-Up Flow over the one new level, so the two flows cannot disagree
 * about a Class Choices step. The Proficiency Sheet stays the one reader of the proficiency sources.
 */

export interface ClassChoicesQuery {
  compendium?: Compendium;
  activeBooks?: ActiveBooks;
}

export interface ClassLevelChoices {
  /** The starting skill pick, when the class is the character's first and the range includes level 1. */
  skillChoices: SkillChoiceOffer[];
  /** The class's and subclass's Proficiency Choices in the level range. */
  proficiencyChoices: AvailableRuleChoice[];
  /** The class's and subclass's rule choices in the level range. */
  ruleChoices: AvailableRuleChoice[];
  /** Whether every choice listed above is fully picked on the character. */
  allPicked: boolean;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The character as it would hold `entry`: the entry replaces the class it names, or joins as a later class. */
function holding(character: Character, entry: CharacterClass): Character {
  const index = character.classes.findIndex((c) => sameName(c.className, entry.className));
  const classes =
    index === -1
      ? [...character.classes, entry]
      : character.classes.map((c, i) => (i === index ? entry : c));
  return { ...character, classes };
}

/**
 * The choices one class brings for the levels after `fromLevel` up to `entry.level`. A class the
 * character does not hold yet is evaluated as a later class, so its multiclass skill pick is listed.
 */
export function classChoicesAtLevel(
  character: Character,
  entry: CharacterClass,
  fromLevel: number,
  query: ClassChoicesQuery = {},
): ClassLevelChoices {
  const compendium = query.compendium ?? currentCompendium();
  const activeBooks = query.activeBooks;
  const planned = holding(character, entry);
  const inRange = (level: number) => level > fromLevel && level <= entry.level;

  // The starting skill pick belongs to the first class only; a later class's skill pick is its
  // multiclass Proficiency Choice, listed with the proficiency choices below.
  const isFirst = planned.classes.length > 0 && sameName(planned.classes[0].className, entry.className);
  const skillChoices = isFirst && inRange(1) ? skillChoiceOffers(planned, { compendium, activeBooks }) : [];

  // The grants of the entry's own class and subclass features, so another held class's choices do not leak in.
  const ownGrantIds = new Set(
    featuresOf(planned, catalogListings({ compendium, activeBooks }), activeBooks)
      .filter((feature) => (feature.origin === "Class" || feature.origin === "Subclass") && sameName(feature.className ?? "", entry.className))
      .flatMap((feature) => (feature.grants ?? []).map((grant) => grant.id)),
  );
  const proficiencyChoices = proficiencyChoiceOffers(planned, { compendium, activeBooks }).filter(
    (offer) => ownGrantIds.has(offer.id) && inRange(offer.level),
  );

  // Rule choices are read with the entry alone, so another held class's rule choices do not leak in either.
  const ruleChoices = availableSubclassRuleChoices({ ...character, classes: [entry] }, activeBooks, compendium).filter(
    (choice) => inRange(choice.level),
  );

  const skillPicked = skillChoices.every((offer) => {
    const picked = character.skillChoices?.find((saved) => saved.id === offer.source && saved.origin === "class")?.picked ?? [];
    return picked.length >= offer.choose;
  });
  const proficiencyPicked = proficiencyChoices.every(
    (offer) => (character.proficiencyPicks?.[offer.id] ?? []).length >= offer.choose,
  );
  const rulePicked = ruleChoices.every((choice) => {
    const picked = character.ruleChoices?.find((rc) => rc.id === choice.id)?.picked ?? [];
    return picked.length >= choice.choose;
  });

  return {
    skillChoices,
    proficiencyChoices,
    ruleChoices,
    allPicked: skillPicked && proficiencyPicked && rulePicked,
  };
}

/** Whether the class brings any choice at all in the level range. */
export function hasClassChoices(choices: ClassLevelChoices): boolean {
  return choices.skillChoices.length > 0 || choices.proficiencyChoices.length > 0 || choices.ruleChoices.length > 0;
}

/** The cards of the Class Choices step: one per choice group, and the other card. */
export type ClassChoiceCard = ChoiceGroup | "other";

/** An Expertise milestone with the picks made in it, as `getMilestonePicks` reads them. */
export type ExpertiseMilestonePick = ReturnType<typeof getMilestonePicks>[number];

/**
 * What the Class Choices step shows and asks for, over every held class. The Creation Flow decides the
 * step's skip and completeness from it, and the Class tab's section renders its lists.
 */
export interface ClassChoicesStepView {
  /** The first class's starting skill pick, shown first in the Skills card. */
  startingSkills: SkillChoiceOffer[];
  /** The skill Proficiency Choices: class, subclass and multiclass picks. A feat's pick is shown with the feat. */
  skillPicks: SkillPickOffer[];
  /** The rule and Proficiency Choices by card. */
  cards: Record<ClassChoiceCard, AvailableRuleChoice[]>;
  expertise: {
    picks: ExpertiseMilestonePick[];
    /** Saved Expertise picks that no milestone offers any more. */
    invalidPicks: string[];
  };
  optionalFeatures: OptionalFeatureOption[];
  /** Whether the step has anything to show. */
  applies: boolean;
  /** Whether every pick the step asks for is made. Optional features never block. */
  complete: boolean;
}

/**
 * The Class Choices step's view: each held class's choices from `classChoicesAtLevel` at level 0, Expertise milestones
 * and their picks, and the optional features the held classes offer. A feat's Proficiency Choices are not listed here.
 */
export function classChoicesStepView(character: Character, query: ClassChoicesQuery = {}): ClassChoicesStepView {
  const compendium = query.compendium ?? currentCompendium();
  const activeBooks = query.activeBooks;
  const catalogs = { compendium, activeBooks };
  const perClass = (character.classes ?? []).map((entry) =>
    classChoicesAtLevel(character, entry, 0, { compendium, activeBooks }),
  );

  const startingSkills = perClass.flatMap((choices) => choices.skillChoices);
  const skillPicks = skillPickOffers(character, { compendium, activeBooks });
  const skillIds = new Set(skillPicks.map((offer) => offer.id));
  const ruleChoices = perClass.flatMap((choices) => choices.ruleChoices);
  const classProficiencies = perClass
    .flatMap((choices) => choices.proficiencyChoices)
    .filter((choice) => !skillIds.has(choice.id));
  const cards: Record<ClassChoiceCard, AvailableRuleChoice[]> = {
    fightingStyle: ruleChoices.filter((choice) => choice.group === "fightingStyle"),
    maneuver: ruleChoices.filter((choice) => choice.group === "maneuver"),
    warlock: ruleChoices.filter((choice) => choice.group === "warlock"),
    infusion: ruleChoices.filter((choice) => choice.group === "infusion"),
    other: [...ruleChoices.filter((choice) => !choice.group), ...classProficiencies],
  };

  const milestones = getAvailableExpertiseMilestones(character, catalogs);
  const picks = getMilestonePicks(milestones, character.chosenExpertise ?? []);
  const offered = new Set(milestones.flatMap((milestone) => milestone.options.map((option) => option.toLowerCase())));
  const invalidPicks = (character.chosenExpertise ?? []).filter((pick) => !offered.has(pick.toLowerCase()));

  const optionalFeatures = getAvailableOptionalFeatures(character, catalogListings(catalogs).classes());

  const pickedEnough = (picked: readonly string[] | undefined, choose: number) => (picked ?? []).length >= choose;
  const startingPicked = startingSkills.every((offer) =>
    pickedEnough(
      character.skillChoices?.find((saved) => saved.id === offer.source && saved.origin === "class")?.picked,
      offer.choose,
    ),
  );
  const proficiencyPicked = (offer: AvailableRuleChoice) => pickedEnough(character.proficiencyPicks?.[offer.id], offer.choose);
  const rulePicked = ruleChoices.every((choice) =>
    pickedEnough(character.ruleChoices?.find((saved) => saved.id === choice.id)?.picked, choice.choose),
  );
  const expertisePicked = picks.every(({ milestone, chosen, from }) => chosen.length >= Math.min(milestone.count, from.length));

  return {
    startingSkills,
    skillPicks,
    cards,
    expertise: { picks, invalidPicks },
    optionalFeatures,
    applies:
      startingSkills.length > 0 ||
      skillPicks.length > 0 ||
      classProficiencies.length > 0 ||
      ruleChoices.length > 0 ||
      milestones.length > 0 ||
      optionalFeatures.length > 0,
    complete: startingPicked && skillPicks.every(proficiencyPicked) && classProficiencies.every(proficiencyPicked) && rulePicked && expertisePicked,
  };
}
