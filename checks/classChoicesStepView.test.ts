import { ALL_BOOKS } from "../src/constants/books.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { integratedTestCompendium, makeChar, resetTestCompendium, startingSkillPickOf } from "./testUtils.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import { classChoicesLevelView, classChoicesStepView } from "../src/rules/classChoices.ts";
import { isCreationStepValid } from "../src/rules/creationFlow.ts";
import { offeredRuleChoices } from "../src/rules/ruleChoices.ts";
import { proficiencyChoiceOffers, skillPickOffers } from "../src/rules/proficiencyChoiceOffers.ts";
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

/** The character with its class's starting skill pick made, recorded as a pick of that Proficiency Choice. */
function withStartingSkills(character: Character): Character {
  const offer = startingSkillPickOf(character, query);
  assert.ok(offer, "the class offers a starting skill pick");
  return { ...character, proficiencyPicks: { [offer.id]: offer.from.slice(0, offer.choose) } };
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
    const skills = startingSkillPickOf(rogue, query)!.from;
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

describe("The Level-Up view lists the choices of one class's new level", () => {
  test("a Battle Master Fighter 6 to 7 gets the maneuver card and nothing else", () => {
    const fighter = makeChar({ classes: [cl("Fighter", 6, "Battle Master")] });
    const view = classChoicesLevelView(fighter, cl("Fighter", 7, "Battle Master"), 6, query);
    assert.deepEqual(view.cards.maneuver.map((choice) => choice.traitName), ["Additional Maneuvers (7th Level)"]);
    assert.deepEqual(view.skillPicks, []);
    assert.deepEqual(view.expertise, { picks: [], invalidPicks: [] });
    assert.deepEqual(view.optionalFeatures, []);
    assert.equal(view.applies, true);
    assert.equal(view.complete, false, "the maneuvers are not picked yet");
  });

  test("a class's first level lists its starting skill pick", () => {
    const view = classChoicesLevelView(makeChar(), cl("Rogue", 1), 0, query);
    assert.deepEqual(view.skillPicks.map((offer) => offer.traitName), ["Rogue starting skills"]);
    assert.equal(view.applies, true);
  });

  test("a later class's multiclass skill pick is listed with the skill picks, not the cards", () => {
    const fighter = makeChar({ classes: [cl("Fighter", 1)] });
    const view = classChoicesLevelView(fighter, cl("Ranger", 1), 0, query);
    assert.deepEqual(view.skillPicks.map((offer) => offer.traitName), ["Ranger multiclass skill"]);
    assert.equal(
      Object.values(view.cards).flat().some((choice) => choice.categories?.includes("skills")),
      false,
      "no skill pick is a card",
    );
  });

  test("a level with no choice does not apply", () => {
    const view = classChoicesLevelView(makeChar({ classes: [cl("Fighter", 1)] }), cl("Fighter", 2), 1, query);
    assert.equal(view.applies, false);
    assert.equal(view.complete, true);
  });
});

describe("The Creation Flow reads the view for the Class Choices step", () => {
  test("a Rogue draft is not complete at Class Choices until Expertise is picked", () => {
    const draft = withStartingSkills(makeChar({ classes: [cl("Rogue", 1)] }));
    assert.equal(isCreationStepValid(draft, "classChoices", query), false);

    const skills = startingSkillPickOf(draft, query)!.from;
    assert.equal(isCreationStepValid({ ...draft, chosenExpertise: skills.slice(0, 2) }, "classChoices", query), true);
  });
});
