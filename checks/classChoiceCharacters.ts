import { ALL_BOOKS } from "../src/constants/books.ts";
import type { Compendium } from "../src/services/compendium.ts";
import type { Character } from "../src/types/character.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import { offeredRuleChoices, pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { makeChar } from "./testUtils.ts";
import assert from "node:assert/strict";

export type ChoiceGroupName = NonNullable<AvailableRuleChoice["group"]>;

/** Picks an offered option by the choice's title, the way the Class Choices step does. */
function pick(character: Character, traitName: string, option: string, compendium: Compendium): Character {
  const choice = offeredRuleChoices(character, { activeBooks: ALL_BOOKS, compendium }).find(
    (candidate) => candidate.traitName === traitName,
  );
  assert.ok(choice, `${traitName} is not offered`);
  return pickRuleChoice(character, choice, option, compendium, ALL_BOOKS);
}

/**
 * Six characters that cover every choice group the Class Choices step shows. Each has a single class, so
 * the groups of each come from one class's builders.
 */
export function classChoiceCharacters(compendium: Compendium): { label: string; character: Character; groups: ChoiceGroupName[] }[] {
  const battleMasterFighter = pick(
    makeChar({ classes: [{ className: "Fighter", source: "PHB", subclassName: "Battle Master", level: 7 }] }),
    "Fighting Style",
    "Superior Technique",
    compendium,
  );
  const paladin = pick(
    makeChar({ classes: [{ className: "Paladin", source: "PHB", level: 2 }] }),
    "Fighting Style",
    "Blessed Warrior",
    compendium,
  );
  const ranger = pick(
    makeChar({ classes: [{ className: "Ranger", source: "PHB", level: 2 }] }),
    "Fighting Style",
    "Druidic Warrior",
    compendium,
  );
  const collegeOfSwordsBard = pick(
    makeChar({ classes: [{ className: "Bard", source: "PHB", subclassName: "College of Swords", level: 3 }] }),
    "Fighting Style",
    "Dueling",
    compendium,
  );
  const pactOfTheTomeWarlock = pick(
    pick(
      makeChar({ classes: [{ className: "Warlock", source: "PHB", subclassName: "The Archfey", level: 11 }] }),
      "Pact Boon",
      "Pact of the Tome",
      compendium,
    ),
    "Eldritch Invocations (2nd Level)",
    "Book of Ancient Secrets",
    compendium,
  );
  const artificer = makeChar({ classes: [{ className: "Artificer", source: "PHB", level: 6 }] });

  return [
    { label: "Battle Master Fighter with Superior Technique", character: battleMasterFighter, groups: ["fightingStyle", "maneuver"] },
    { label: "Paladin with Blessed Warrior", character: paladin, groups: ["fightingStyle"] },
    { label: "Ranger with Druidic Warrior", character: ranger, groups: ["fightingStyle"] },
    { label: "College of Swords Bard", character: collegeOfSwordsBard, groups: ["fightingStyle"] },
    { label: "Pact of the Tome Warlock at 11", character: pactOfTheTomeWarlock, groups: ["warlock"] },
    { label: "Artificer at 6", character: artificer, groups: ["infusion"] },
  ];
}
