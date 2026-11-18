import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { integratedTestCompendium, resetTestCompendium } from "./testUtils.ts";
import type { Character } from "../src/types/character.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import { offeredRuleChoices } from "../src/rules/ruleChoices.ts";
import { proficiencyChoiceOffers, skillPickOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { classChoiceCharacters } from "./classChoiceCharacters.ts";

resetTestCompendium();
const compendium = integratedTestCompendium();

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

for (const { label, character, groups } of classChoiceCharacters(compendium)) {
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
