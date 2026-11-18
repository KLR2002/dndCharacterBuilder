import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, integratedTestCompendium, resetTestCompendium } from "./testUtils.ts";
import type { Character } from "../src/types/character.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import { offeredRuleChoices, pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { proficiencyChoiceOffers, skillPickOffers } from "../src/rules/proficiencyChoiceOffers.ts";

resetTestCompendium();
const compendium = integratedTestCompendium();

type Group = NonNullable<AvailableRuleChoice["group"]>;

/** The choices the Class Choices step lists, built the way the section builds them. */
function classChoicesListed(character: Character): AvailableRuleChoice[] {
  const skillIds = new Set(
    skillPickOffers(character, { activeBooks: ALL_BOOKS, compendium }).map((offer) => offer.id),
  );
  return [
    ...offeredRuleChoices(character, { activeBooks: ALL_BOOKS, compendium, origins: ["class", "subclass"] }),
    ...proficiencyChoiceOffers(character, { activeBooks: ALL_BOOKS, compendium }).filter(
      (choice) =>
        (choice.origin === "class" || choice.origin === "subclass" || choice.origin === "feat") &&
        !skillIds.has(choice.id),
    ),
  ];
}

/** Picks an offered option by the choice's title, the way the Class Choices step does. */
function pick(character: Character, traitName: string, option: string): Character {
  const choice = offeredRuleChoices(character, { activeBooks: ALL_BOOKS, compendium }).find(
    (candidate) => candidate.traitName === traitName,
  );
  assert.ok(choice, `${traitName} is not offered`);
  return pickRuleChoice(character, choice, option, compendium, ALL_BOOKS);
}

const battleMasterFighter = pick(
  makeChar({ classes: [{ className: "Fighter", source: "PHB", subclassName: "Battle Master", level: 7 }] }),
  "Fighting Style",
  "Superior Technique",
);

const paladin = pick(
  makeChar({ classes: [{ className: "Paladin", source: "PHB", level: 2 }] }),
  "Fighting Style",
  "Blessed Warrior",
);

const ranger = pick(
  makeChar({ classes: [{ className: "Ranger", source: "PHB", level: 2 }] }),
  "Fighting Style",
  "Druidic Warrior",
);

const collegeOfSwordsBard = pick(
  makeChar({ classes: [{ className: "Bard", source: "PHB", subclassName: "College of Swords", level: 3 }] }),
  "Fighting Style",
  "Dueling",
);

const pactOfTheTomeWarlock = pick(
  pick(
    makeChar({ classes: [{ className: "Warlock", source: "PHB", subclassName: "The Archfey", level: 11 }] }),
    "Pact Boon",
    "Pact of the Tome",
  ),
  "Eldritch Invocations (2nd Level)",
  "Book of Ancient Secrets",
);

const artificer = makeChar({ classes: [{ className: "Artificer", source: "PHB", level: 6 }] });

const CHARACTERS: { label: string; character: Character; groups: Group[] }[] = [
  { label: "Battle Master Fighter with Superior Technique", character: battleMasterFighter, groups: ["fightingStyle", "maneuver"] },
  { label: "Paladin with Blessed Warrior", character: paladin, groups: ["fightingStyle"] },
  { label: "Ranger with Druidic Warrior", character: ranger, groups: ["fightingStyle"] },
  { label: "College of Swords Bard", character: collegeOfSwordsBard, groups: ["fightingStyle"] },
  { label: "Pact of the Tome Warlock at 11", character: pactOfTheTomeWarlock, groups: ["warlock"] },
  { label: "Artificer at 6", character: artificer, groups: ["infusion"] },
];

for (const { label, character, groups } of CHARACTERS) {
  test(`${label}: its choices fall in the groups its class builds, and proficiency choices in none`, () => {
    const listed = classChoicesListed(character);
    const tagged = [...new Set(listed.flatMap((choice) => (choice.group ? [choice.group] : [])))].sort();
    assert.deepEqual(tagged, [...groups].sort());
    assert.deepEqual(
      listed.filter((choice) => choice.pick === "proficiency" && choice.group).map((choice) => choice.id),
      []
    );
  });
}
