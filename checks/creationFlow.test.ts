import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { makeChar, loadTestCatalog } from "./testUtils.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { skillChoiceOffers } from "../src/rules/proficiencySheet.ts";
import type { ClassData, RaceData } from "../src/types/dnd5e.ts";
import {
  applicableCreationSteps,
  classStepOffer,
  creationSteps,
  currentCreationStep,
  isCreationFinished,
  isCreationStepValid,
} from "../src/rules/creationFlow.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";

const cl = (className: string, level: number, subclassName?: string): CharacterClass => ({
  className,
  source: "PHB",
  level,
  subclassName,
});

describe("Creation Steps follow the order and skip what does not apply", () => {
  test("Wizard 1 lists Class, Race, Background, Abilities, Class Choices, Spells, Equipment, Details, Review", () => {
    const wizard1 = makeChar({ classes: [cl("Wizard", 1)] });
    assert.deepEqual(applicableCreationSteps(wizard1), [
      "class",
      "race",
      "background",
      "abilities",
      "classChoices",
      "spells",
      "equipment",
      "details",
      "review",
    ]);
  });

  test("Cleric 1 adds Subclass right after Class, and Class Choices after Abilities", () => {
    const cleric1 = makeChar({ classes: [cl("Cleric", 1)] });
    assert.deepEqual(applicableCreationSteps(cleric1), [
      "class",
      "subclass",
      "race",
      "background",
      "abilities",
      "classChoices",
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
    for (const id of ["background", "abilities", "classChoices", "spells", "equipment", "details", "review"] as const) {
      assert.equal(byId.get(id)?.status, "locked", `${id} should report locked`);
    }
  });
});

describe("Class Choices holds the class's skill and proficiency picks", () => {
  test("a Wizard 1 with no skills picked reports Class Choices invalid; with both picked, valid", () => {
    const wizard1 = makeChar({ classes: [cl("Wizard", 1)] });
    const skillOffer = skillChoiceOffers(wizard1, { activeBooks: ALL_BOOKS }).find((offer) => offer.source.startsWith("Class:"));
    assert.ok(skillOffer, "the class offers a starting skill pick at level 1");

    assert.equal(isCreationStepValid(wizard1, "classChoices"), false);

    const bothPicked = makeChar({
      classes: [cl("Wizard", 1)],
      skillChoices: [
        {
          id: skillOffer.source,
          origin: "class",
          choose: skillOffer.choose,
          from: skillOffer.from,
          picked: skillOffer.from.slice(0, skillOffer.choose),
        },
      ],
    });
    assert.equal(isCreationStepValid(bothPicked, "classChoices"), true);
  });
});

describe("A draft resumes at its step", () => {
  test("a draft left on the Background step reports Background as its current step", () => {
    const draft = makeChar({
      classes: [cl("Wizard", 1)],
      race: { name: "Human", source: "PHB" },
      creationProgress: { currentStep: "background" },
    });
    assert.equal(currentCreationStep(draft), "background");
  });
});

describe("Details asks only for name, gender and alignment", () => {
  test("an empty name leaves Details invalid and Review locked, while empty gender and alignment do not", () => {
    const base: Partial<Character> = { classes: [cl("Wizard", 1)], creationProgress: { currentStep: "details" } };

    const unnamed = makeChar({ ...base, name: "" });
    assert.equal(isCreationStepValid(unnamed, "details"), false);
    const unnamedSteps = new Map(creationSteps(unnamed).map((step) => [step.id, step]));
    assert.equal(unnamedSteps.get("details")?.valid, false);
    assert.equal(unnamedSteps.get("review")?.status, "locked");

    const named = makeChar({ ...base, name: "Kara", gender: "", alignment: "" });
    assert.equal(isCreationStepValid(named, "details"), true);
    const namedSteps = new Map(creationSteps(named).map((step) => [step.id, step]));
    assert.equal(namedSteps.get("details")?.valid, true);
  });
});

describe("Characters from the old builder count as finished", () => {
  const roundTrip = (raw: object) =>
    migrateCharacter(JSON.parse(JSON.stringify(raw)), loadTestCatalog<RaceData[]>("races"), loadTestCatalog<ClassData[]>("classes"), ALL_BOOKS);

  test("a save with no creation progress loads as finished, and the existing fixtures gain none", () => {
    const fixtures = [
      makeChar(),
      makeChar({ classes: [cl("Fighter", 4, "Champion")], race: { name: "Human", source: "PHB" }, background: { name: "Soldier", source: "PHB" } }),
      makeChar({ classes: [cl("Cleric", 1, "Life Domain")], knownSpells: [{ name: "Cure Wounds", source: "PHB" }] }),
      makeChar({ classes: [cl("Rogue", 10)], asiSelections: [{ level: 4, type: "asi", asi: { dex: 2 } }] }),
    ];
    for (const fixture of fixtures) {
      const migrated = roundTrip(fixture);
      assert.equal(migrated.creationProgress, undefined);
      assert.equal(isCreationFinished(migrated), true);
      assert.equal(currentCreationStep(migrated), null);
    }
  });

  test("a save that carries creation progress keeps it as a draft, and a malformed record is rejected", () => {
    const draft = makeChar({ classes: [cl("Wizard", 1)], creationProgress: { currentStep: "background" } });
    const migrated = roundTrip(draft);
    assert.deepEqual(migrated.creationProgress, { currentStep: "background" });
    assert.equal(isCreationFinished(migrated), false);
    assert.equal(currentCreationStep(migrated), "background");

    assert.throws(() => roundTrip({ ...draft, creationProgress: { currentStep: "not-a-step" } }), /creationProgress/);
    assert.throws(() => roundTrip({ ...draft, creationProgress: { currentStep: 4 } }), /creationProgress/);
  });
});
