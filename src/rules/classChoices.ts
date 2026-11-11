import type { ActiveBooks } from "../constants/books.ts";
import type { Character, CharacterClass } from "../types/character.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { catalogListings } from "./catalogs.ts";
import type { AvailableRuleChoice } from "./choices/types.ts";
import { availableSubclassRuleChoices } from "./ruleChoices.ts";
import { proficiencyChoiceOffers } from "./proficiencyChoiceOffers.ts";
import { featuresOf, skillChoiceOffers, type SkillChoiceOffer } from "./proficiencySheet.ts";

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
