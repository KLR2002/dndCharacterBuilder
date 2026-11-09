import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { makeChar, loadTestCatalog } from "./testUtils.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { skillChoiceOffers } from "../src/rules/proficiencySheet.ts";
import { allCatalogRaces } from "../src/rules/catalogs.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import { maxHp } from "../src/rules/hp.ts";
import {
  resolveStartingEquipment,
  setStartingEquipmentItems,
  setStartingEquipmentOption,
  startingEquipmentCard,
  startingEquipmentOffers,
} from "../src/rules/startingEquipment.ts";
import type { ClassData, RaceData } from "../src/types/dnd5e.ts";
import {
  applicableCreationSteps,
  applyCreationStepChange,
  applyCreationStepEdit,
  classStepOffer,
  creationSteps,
  currentCreationStep,
  finishCreationStep,
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
  test("the offer's starting-level range drives the draft's class level", () => {
    const offer = classStepOffer();
    const draft = makeChar({ creationProgress: { currentStep: "class" } });
    const atMax = applyCreationStepChange(
      draft,
      { step: "class", className: "Fighter", source: "PHB", level: offer.startingLevel.max },
      { activeBooks: ALL_BOOKS },
    );
    assert.equal(atMax.classes[0]?.level, 20, "the offer's maximum starting level applies");
    const atDefault = applyCreationStepChange(
      draft,
      { step: "class", className: "Fighter", source: "PHB", level: offer.startingLevel.default },
      { activeBooks: ALL_BOOKS },
    );
    assert.equal(atDefault.classes[0]?.level, 1, "the offer's default starting level applies");
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

describe("Rolled Abilities is valid only when all six results are placed", () => {
  const sixResults = Array.from({ length: 6 }, (_, i) => ({ dice: [], droppedIndex: 0, total: 10 + i }));
  const base: Partial<Character> = { classes: [cl("Wizard", 1)], creationProgress: { currentStep: "abilities" } };

  test("nothing rolled, partial placements and a full placement; manual stays valid", () => {
    assert.equal(isCreationStepValid(makeChar({ ...base, abilityMethod: "rolled" }), "abilities"), false);
    assert.equal(
      isCreationStepValid(makeChar({ ...base, abilityMethod: "rolled", rolledAbilities: sixResults }), "abilities"),
      false,
      "six results with nothing placed is invalid",
    );
    assert.equal(
      isCreationStepValid(
        makeChar({
          ...base,
          abilityMethod: "rolled",
          rolledAbilities: sixResults,
          rolledAbilityPicks: { str: 0, dex: 1, con: 2, int: 3, wis: 4 },
        }),
        "abilities",
      ),
      false,
      "five of six placed is invalid",
    );
    assert.equal(
      isCreationStepValid(
        makeChar({
          ...base,
          abilityMethod: "rolled",
          rolledAbilities: sixResults,
          rolledAbilityPicks: { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 },
        }),
        "abilities",
      ),
      true,
      "all six placed is valid",
    );
    assert.equal(isCreationStepValid(makeChar({ ...base, abilityMethod: "manual" }), "abilities"), true);
  });

  test("reusing one rolled result for several abilities is invalid", () => {
    assert.equal(
      isCreationStepValid(
        makeChar({
          ...base,
          abilityMethod: "rolled",
          rolledAbilities: sixResults,
          rolledAbilityPicks: { str: 0, dex: 0, con: 1, int: 1, wis: 2, cha: 2 },
        }),
        "abilities",
      ),
      false,
      "each of the six results goes to exactly one ability, so the six indexes must be distinct",
    );
  });
});

describe("A draft that starts above level 1 opens at full HP", () => {
  const flowOpts = { activeBooks: ALL_BOOKS };
  const catalogs = () => ({ compendium: currentCompendium(), activeBooks: ALL_BOOKS });

  test("choosing Fighter level 5 and finishing every step leaves currentHp === maxHp", () => {
    const draft = makeChar({ creationProgress: { currentStep: "class" } });
    const picked = applyCreationStepChange(
      draft,
      { step: "class", className: "Fighter", source: "PHB", level: 5 },
      flowOpts,
    );
    assert.equal(picked.classes[0]?.level, 5);
    assert.equal(picked.currentHp, maxHp(picked), "picking a starting level above 1 keeps the draft at full HP");

    const human = allCatalogRaces(catalogs()).find((r) => r.name === "Human")!;
    const variant = human.subraces?.find((s) => s.source === "PHB" && s.name.trim().length > 0);
    let c = applyCreationStepChange(
      picked,
      { step: "subclass", subclassName: "Champion", subclassSource: "PHB" },
      flowOpts,
    );
    c = applyCreationStepChange(c, { step: "race", race: human, ...(variant ? { subrace: variant } : {}) }, flowOpts);
    c = applyCreationStepChange(c, { step: "background", background: { name: "Soldier", source: "PHB" } }, flowOpts);
    const scores = { str: 15, dex: 14, con: 14, int: 12, wis: 10, cha: 8 };
    c = applyCreationStepEdit(
      c,
      "abilities",
      (cur) => ({ ...cur, abilityMethod: "standardArray", standardArrayPicks: { ...scores }, baseAbilityScores: { ...scores } }),
      flowOpts,
    );
    const skillOffer = skillChoiceOffers(c, flowOpts).find((o) => o.source === "Class: Fighter")!;
    c = applyCreationStepEdit(
      c,
      "classChoices",
      (cur) => ({
        ...cur,
        skillChoices: [
          { id: skillOffer.source, origin: "class", choose: skillOffer.choose, from: skillOffer.from, picked: skillOffer.from.slice(0, skillOffer.choose) },
        ],
        chosenSkills: skillOffer.from.slice(0, skillOffer.choose),
        ruleChoices: [
          { id: "PHB__Fighter__Fighting Style", trait: "Fighting Style", origin: "class", choose: 1, from: ["Defense"], picked: ["Defense"] },
        ],
      }),
      flowOpts,
    );
    c = applyCreationStepEdit(
      c,
      "asiFeats",
      (cur) => ({ ...cur, asiSelections: [{ level: 4, className: "Fighter", classLevel: 4, type: "asi", asi: { str: 2 } }] }),
      flowOpts,
    );
    for (const offer of startingEquipmentOffers(c, catalogs())) {
      c = setStartingEquipmentOption(c, offer.slot, offer.options[0], catalogs());
    }
    for (const slot of startingEquipmentCard(c, catalogs()).slots) {
      if (slot.kind !== "choice") continue;
      const letter = c.startingEquipmentPicks?.options[String(slot.slot)];
      const option = slot.options.find((o) => o.letter === letter);
      for (const entry of option?.entries ?? []) {
        if (entry.kind === "type") {
          c = setStartingEquipmentItems(c, entry.address, entry.pool.slice(0, entry.quantity), catalogs());
        }
      }
    }
    assert.equal(resolveStartingEquipment(c, catalogs()).complete, true, "the fixture's equipment picks are complete");

    for (const id of applicableCreationSteps(c, flowOpts)) {
      assert.equal(isCreationStepValid(c, id, flowOpts), true, `${id} should be valid before finishing`);
      c = finishCreationStep(c, id, flowOpts);
    }
    assert.equal(c.creationProgress, undefined, "finishing Review finishes the character");
    assert.equal(c.currentHp, maxHp(c), "a finished new character opens at full HP");
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
