import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, integratedTestCompendium, resetTestCompendium } from "./testUtils.ts";
import type { Character } from "../src/types/character.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import {
  isInfusionChoiceId,
  isInvocationChoiceId,
  isManeuverChoiceId,
  offeredRuleChoices,
  pickRuleChoice,
} from "../src/rules/ruleChoices.ts";
import { proficiencyChoiceOffers, skillPickOffers } from "../src/rules/proficiencyChoiceOffers.ts";

resetTestCompendium();
const compendium = integratedTestCompendium();

type Card = "fightingStyle" | "maneuver" | "warlock" | "infusion" | "other";

// The id predicates the Class Choices step sorted its cards by, copied as they were before the group tags.
const ID_PREDICATES: readonly [Exclude<Card, "other">, (id: string) => boolean][] = [
  [
    "fightingStyle",
    (id) => id.includes("Fighting Style") || id.includes("Blessed Warrior") || id.includes("Druidic Warrior"),
  ],
  [
    "maneuver",
    (id) => isManeuverChoiceId(id) || id.includes("Maneuver") || id.includes("Superior Technique"),
  ],
  [
    "warlock",
    (id) =>
      id.includes("Pact Boon") ||
      id.includes("Pact of the Tome") ||
      id.includes("Ancient Secrets") ||
      id.includes("Mystic Arcanum") ||
      isInvocationChoiceId(id),
  ],
  ["infusion", (id) => isInfusionChoiceId(id)],
];

/** The card the old id checks put a choice in: the first predicate that matches, else other. */
function idCardOf(id: string): Card {
  return ID_PREDICATES.find(([, matches]) => matches(id))?.[0] ?? "other";
}

/** The card a choice gets from its group tag. A choice with no group is in the other card. */
function groupCardOf(choice: AvailableRuleChoice): Card {
  return choice.group ?? "other";
}

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

const CHARACTERS: { label: string; character: Character }[] = [
  { label: "Battle Master Fighter with Superior Technique", character: battleMasterFighter },
  { label: "Paladin with Blessed Warrior", character: paladin },
  { label: "Ranger with Druidic Warrior", character: ranger },
  { label: "College of Swords Bard", character: collegeOfSwordsBard },
  { label: "Pact of the Tome Warlock at 11", character: pactOfTheTomeWarlock },
  { label: "Artificer at 6", character: artificer },
];

for (const { label, character } of CHARACTERS) {
  test(`${label}: each listed choice is in the card its id checks put it in`, () => {
    const listed = classChoicesListed(character);
    assert.ok(listed.length > 0, "the character lists choices");
    const mismatches = listed
      .filter((choice) => groupCardOf(choice) !== idCardOf(choice.id))
      .map((choice) => `${choice.id}: group ${choice.group ?? "(none)"}, id checks ${idCardOf(choice.id)}`);
    assert.deepEqual(mismatches, []);
  });

  test(`${label}: no listed choice matches two id predicates`, () => {
    const doubled = classChoicesListed(character)
      .map((choice) => ({
        id: choice.id,
        matches: ID_PREDICATES.filter(([, matches]) => matches(choice.id)).map(([card]) => card),
      }))
      .filter((row) => row.matches.length > 1);
    assert.deepEqual(doubled, []);
  });
}

test("the characters list a choice in every group", () => {
  const listed = CHARACTERS.flatMap(({ character }) => classChoicesListed(character).map(groupCardOf));
  for (const card of ["fightingStyle", "maneuver", "warlock", "infusion"] as const) {
    assert.ok(listed.includes(card), `no listed choice is in the ${card} group`);
  }
});
