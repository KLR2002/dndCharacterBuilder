import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import { applicableCreationSteps, classStepOffer, creationSteps } from "../src/rules/creationFlow.ts";
import type { CharacterClass } from "../src/types/character.ts";

const cl = (className: string, level: number, subclassName?: string): CharacterClass => ({
  className,
  source: "PHB",
  level,
  subclassName,
});

describe("Creation Steps follow the order and skip what does not apply", () => {
  test("Wizard 1 lists Class, Race, Background, Abilities, Spells, Equipment, Details, Review", () => {
    const wizard1 = makeChar({ classes: [cl("Wizard", 1)] });
    assert.deepEqual(applicableCreationSteps(wizard1), [
      "class",
      "race",
      "background",
      "abilities",
      "spells",
      "equipment",
      "details",
      "review",
    ]);
  });

  test("Cleric 1 adds Subclass right after Class", () => {
    const cleric1 = makeChar({ classes: [cl("Cleric", 1)] });
    assert.deepEqual(applicableCreationSteps(cleric1), [
      "class",
      "subclass",
      "race",
      "background",
      "abilities",
      "spells",
      "equipment",
      "details",
      "review",
    ]);
  });

  test("Fighter 4 adds Subclass after Class and ASI/Feats after Class Choices, with no Spells step", () => {
    const fighter4 = makeChar({ classes: [cl("Fighter", 4)] });
    assert.deepEqual(applicableCreationSteps(fighter4), [
      "class",
      "subclass",
      "race",
      "background",
      "abilities",
      "classChoices",
      "asiFeats",
      "equipment",
      "details",
      "review",
    ]);
  });

  test("a Fighter 4 Eldritch Knight gains the Spells step, and a race with subraces gains Subrace after Race", () => {
    const ek = makeChar({
      classes: [cl("Fighter", 4, "Eldritch Knight")],
      race: { name: "Elf", source: "PHB" },
    });
    assert.deepEqual(applicableCreationSteps(ek), [
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
    ]);
  });
});

describe("The Class step offers one class and a starting level", () => {
  test("the offer sets the starting level from 1 to 20 defaulting to 1, with no add-class action", () => {
    const offer = classStepOffer();
    assert.deepEqual(offer.startingLevel, { min: 1, max: 20, default: 1 });
    assert.equal(offer.canAddClass, false);
  });
});

describe("Later steps stay locked until the current step is valid", () => {
  test("with no race picked, Background and every later step report locked while earlier steps report finished", () => {
    const draft = makeChar({
      classes: [cl("Wizard", 1)],
      creationProgress: { currentStep: "race" },
    });
    const byId = new Map(creationSteps(draft).map((step) => [step.id, step]));
    assert.equal(byId.get("class")?.status, "finished");
    assert.equal(byId.get("race")?.status, "current");
    for (const id of ["background", "abilities", "spells", "equipment", "details", "review"] as const) {
      assert.equal(byId.get(id)?.status, "locked", `${id} should report locked`);
    }
  });
});
