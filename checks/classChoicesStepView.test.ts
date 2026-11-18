import { ALL_BOOKS } from "../src/constants/books.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { integratedTestCompendium, makeChar, resetTestCompendium } from "./testUtils.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import { classChoicesStepView } from "../src/rules/classChoices.ts";
import { isCreationStepValid } from "../src/rules/creationFlow.ts";
import { offeredRuleChoices } from "../src/rules/ruleChoices.ts";
import { proficiencyChoiceOffers, skillPickOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { skillChoiceOffers } from "../src/rules/proficiencySheet.ts";
import { classChoiceCharacters } from "./classChoiceCharacters.ts";

resetTestCompendium();
const compendium = integratedTestCompendium();
const query = { compendium, activeBooks: ALL_BOOKS };

const cl = (className: string, level: number, subclassName?: string): CharacterClass => ({
  className,
  source: "PHB",
  level,
  subclassName,
});

/** The character with its class's starting skill pick made, recorded the way the Builder's Skills card records it. */
function withStartingSkills(character: Character): Character {
  const offer = skillChoiceOffers(character, query).find((o) => o.source.startsWith("Class:"));
  assert.ok(offer, "the class offers a starting skill pick");
  const picked = offer.from.slice(0, offer.choose);
  return {
    ...character,
    chosenSkills: [...(character.chosenSkills ?? []), ...picked],
    skillChoices: [
      ...(character.skillChoices ?? []),
      { id: offer.source, origin: "class", choose: offer.choose, from: offer.from, picked },
    ],
  };
}

/** The Class Choices step as the section assembled it before the view existed: the oracle for the parity tests. */
function oldAssembly(character: Character) {
  const skillOffers = skillPickOffers(character, { activeBooks: ALL_BOOKS, compendium });
  const skillIds = new Set(skillOffers.map((offer) => offer.id));
  const rules = offeredRuleChoices(character, { activeBooks: ALL_BOOKS, compendium, origins: ["class", "subclass"] });
  const proficiencies = proficiencyChoiceOffers(character, { activeBooks: ALL_BOOKS, compendium }).filter(
    (choice) => (choice.origin === "class" || choice.origin === "subclass") && !skillIds.has(choice.id),
  );
  return {
    startingSkills: skillChoiceOffers(character, query).filter((offer) => offer.source.startsWith("Class:")),
    skillOffers,
    rules,
    others: [...rules.filter((choice) => !choice.group), ...proficiencies],
  };
}

describe("The Class Choices view lists the choices the section listed", () => {
  for (const { label, character } of classChoiceCharacters(compendium)) {
    test(`${label}: the view's cards and skill picks match the old assembly`, () => {
      const old = oldAssembly(character);
      const view = classChoicesStepView(character, query);

      assert.deepEqual(view.startingSkills, old.startingSkills);
      assert.deepEqual(view.skillPicks, old.skillOffers);
      for (const group of ["fightingStyle", "maneuver", "warlock", "infusion"] as const) {
        assert.deepEqual(
          view.cards[group],
          old.rules.filter((choice) => choice.group === group),
          `the ${group} card`,
        );
      }
      assert.deepEqual(view.cards.other, old.others, "the other card");
    });
  }
});

describe("The Class Choices view is complete when every pick it asks for is made", () => {
  test("a Rogue 1 with its skills picked is incomplete until two Expertise picks are made", () => {
    const rogue = withStartingSkills(makeChar({ classes: [cl("Rogue", 1)] }));
    const skills = skillChoiceOffers(rogue, query)[0].from;
    assert.equal(classChoicesStepView(rogue, query).complete, false, "no Expertise pick yet");

    const withExpertise = { ...rogue, chosenExpertise: skills.slice(0, 2) };
    assert.equal(classChoicesStepView(withExpertise, query).complete, true, "two Expertise picks");
  });

  test("a Barbarian 4 with only optional features offered is complete", () => {
    const barbarian = withStartingSkills(makeChar({ classes: [cl("Barbarian", 4)] }));
    const view = classChoicesStepView(barbarian, query);
    assert.ok(view.optionalFeatures.length > 0, "the Barbarian offers an optional feature");
    assert.equal(view.applies, true);
    assert.equal(view.complete, true);
  });

  test("a feat's skill picks are not listed and never block completion", () => {
    const barbarian = withStartingSkills(
      makeChar({
        classes: [cl("Barbarian", 4)],
        asiSelections: [{ level: 4, type: "feat", featName: "Skilled" }],
      }),
    );
    const view = classChoicesStepView(barbarian, query);
    assert.equal(view.skillPicks.some((offer) => offer.origin === "feat"), false, "the feat's skill pick is shown with the feat");
    assert.equal(view.complete, true);
  });
});

describe("The Creation Flow reads the view for the Class Choices step", () => {
  test("a Rogue draft is not complete at Class Choices until Expertise is picked", () => {
    const draft = withStartingSkills(makeChar({ classes: [cl("Rogue", 1)] }));
    assert.equal(isCreationStepValid(draft, "classChoices", query), false);

    const skills = skillChoiceOffers(draft, query)[0].from;
    assert.equal(isCreationStepValid({ ...draft, chosenExpertise: skills.slice(0, 2) }, "classChoices", query), true);
  });
});
