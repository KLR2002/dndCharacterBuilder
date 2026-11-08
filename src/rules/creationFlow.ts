import type { ActiveBooks } from "../constants/books.ts";
import type { Character, CharacterClass, CreationStepId } from "../types/character.ts";
import type { ClassData, RaceData } from "../types/dnd5e.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { allCatalogClasses, allCatalogRaces } from "./catalogs.ts";
import { heldClass } from "./classData.ts";
import { asiLevels, subclassLevel } from "./leveling.ts";
import { availableSubclassRuleChoices } from "./ruleChoices.ts";
import { findHeldRace } from "./raceLookup.ts";
import { isCastingClass } from "./spellcasting.ts";

/**
 * The Creation Flow's steps, in the order the flow walks them: identity first (class, subclass, ancestry),
 * then the rest, name last. A step the character does not qualify for is skipped, so it never appears in
 * `applicableCreationSteps`. Creation builds a single class; Multiclassing enters only through the Level-Up
 * Flow.
 */
export const CREATION_STEP_ORDER: readonly CreationStepId[] = [
  "class",
  "subclass",
  "race",
  "subrace",
  "background",
  "abilities",
  "classChoices",
  "asiFeats",
  "spells",
  "equipment",
  "details",
  "review",
];

/** The catalogs the flow reads: defaults to the process-wide Compendium, unscoped. */
export interface CreationFlowOptions {
  compendium?: Compendium;
  activeBooks?: ActiveBooks;
}

/** The one class a creation builds: the first entry, while the character holds at most one. */
function classEntryOf(character: Character): CharacterClass | undefined {
  return character.classes?.[0];
}

/**
 * Whether the Subclass step applies: the class's level has reached its subclass level and the catalog does
 * not hold the class with an empty subclass list (the same check `getPendingLevelChoices` makes).
 */
function offersSubclass(entry: CharacterClass | undefined, classes: readonly ClassData[]): boolean {
  if (!entry) return false;
  if (entry.level < subclassLevel(entry.className)) return false;
  const held = heldClass(entry, classes);
  if (held && Array.isArray(held.subclasses) && held.subclasses.length === 0) return false;
  return true;
}

/**
 * Whether the Subrace step applies: the held race resolves to a catalog record that lists more than one
 * subrace, the same threshold the ancestry section uses to offer a subrace picker.
 */
function offersSubrace(character: Character, races: readonly RaceData[], activeBooks: ActiveBooks): boolean {
  const { race } = findHeldRace(races, character.race, activeBooks);
  return Boolean(race && (race.subraces?.length ?? 0) > 1);
}

/** Whether the Class Choices step applies: the class or subclass offers a rule choice at the character's level. */
function offersClassChoices(character: Character, activeBooks: ActiveBooks, compendium: Compendium): boolean {
  return availableSubclassRuleChoices(character, activeBooks, compendium).length > 0;
}

/** Whether the ASI/Feats step applies: the class's level has reached one of its ASI levels. */
function offersAsiFeats(entry: CharacterClass | undefined): boolean {
  return Boolean(entry && asiLevels(entry.className).some((level) => entry.level >= level));
}

/** Whether the Spells step applies: the class holds a Spellcasting Profile at its level, a subclass's included. */
function offersSpells(entry: CharacterClass | undefined, classes: readonly ClassData[]): boolean {
  return Boolean(entry && isCastingClass(entry, classes));
}

/**
 * The Creation Steps that apply to the character, in flow order, skipping the ones it does not qualify for.
 * Step order and skipping are decided here only; components read this list and never decide it.
 */
export function applicableCreationSteps(character: Character, opts: CreationFlowOptions = {}): CreationStepId[] {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks;
  const classes = allCatalogClasses({ compendium, activeBooks });
  const races = allCatalogRaces({ compendium, activeBooks });
  const entry = classEntryOf(character);
  const steps: CreationStepId[] = ["class"];
  if (offersSubclass(entry, classes)) steps.push("subclass");
  steps.push("race");
  if (offersSubrace(character, races, activeBooks)) steps.push("subrace");
  steps.push("background", "abilities");
  if (offersClassChoices(character, activeBooks, compendium)) steps.push("classChoices");
  if (offersAsiFeats(entry)) steps.push("asiFeats");
  if (offersSpells(entry, classes)) steps.push("spells");
  steps.push("equipment", "details", "review");
  return steps;
}
