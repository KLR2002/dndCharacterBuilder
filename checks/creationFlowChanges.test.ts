import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { makeChar, loadTestCatalog } from "./testUtils.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import { skillChoiceOffers } from "../src/rules/proficiencySheet.ts";
import { allCatalogRaces } from "../src/rules/catalogs.ts";
import { applyStartingGrants } from "../src/rules/builderTransitions.ts";
import {
  resolveStartingEquipment,
  setStartingEquipmentItems,
  setStartingEquipmentOption,
  startingEquipmentCard,
  startingEquipmentOffers,
} from "../src/rules/startingEquipment.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import {
  applyCreationStepChange,
  creationStepNeedsAttention,
  creationSteps,
  currentCreationStep,
  finishCreationStep,
  isCreationStepValid,
} from "../src/rules/creationFlow.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import type { ClassData, RaceData } from "../src/types/dnd5e.ts";

const cl = (className: string, level: number, subclassName?: string): CharacterClass => ({
  className,
  source: "PHB",
  level,
  subclassName,
});

const flowOpts = { activeBooks: ALL_BOOKS };
const catalogs = () => ({ compendium: currentCompendium(), activeBooks: ALL_BOOKS });

/**
 * A Fighter 6 that finished every Creation Step up to Equipment: its class skills, a Fighting Style, an ASI at
 * level 4 and a feat at level 6, and a claimed starting kit, with Human, Variant Human, Soldier and a full
 * standard array behind them.
 */
function finishedFighter(): Character {
  const human = allCatalogRaces(catalogs()).find((r) => r.name === "Human")!;
  const subrace = human.subraces!.find((s) => s.source === "PHB" && s.name.trim().length > 0)!;
  const base = makeChar({
    name: "Kara",
    classes: [cl("Fighter", 6, "Champion")],
    race: { name: "Human", source: "PHB", subraceName: subrace.name, subraceSource: subrace.source },
    background: { name: "Soldier", source: "PHB" },
    abilityMethod: "standardArray",
    standardArrayPicks: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    baseAbilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Defense"],
        picked: ["Defense"],
      },
    ],
    asiSelections: [
      { level: 4, className: "Fighter", classLevel: 4, type: "asi", asi: { str: 2 } },
      { level: 6, className: "Fighter", classLevel: 6, type: "feat", featName: "Grappler", featSource: "PHB" },
    ],
    creationProgress: { currentStep: "equipment" },
  });
  const skillOffer = skillChoiceOffers(base, flowOpts).find((offer) => offer.source === "Class: Fighter")!;
  const withSkills: Character = {
    ...base,
    skillChoices: [
      {
        id: skillOffer.source,
        origin: "class",
        choose: skillOffer.choose,
        from: skillOffer.from,
        picked: skillOffer.from.slice(0, skillOffer.choose),
      },
    ],
    chosenSkills: skillOffer.from.slice(0, skillOffer.choose),
  };
  // Complete the starting equipment picks and claim the kit, as the Equipment step does.
  let equipped = withSkills;
  for (const offer of startingEquipmentOffers(equipped, catalogs())) {
    equipped = setStartingEquipmentOption(equipped, offer.slot, offer.options[0], catalogs());
  }
  for (const slot of startingEquipmentCard(equipped, catalogs()).slots) {
    if (slot.kind !== "choice") continue;
    const letter = equipped.startingEquipmentPicks?.options[String(slot.slot)];
    const option = slot.options.find((o) => o.letter === letter);
    for (const entry of option?.entries ?? []) {
      if (entry.kind === "type") {
        equipped = setStartingEquipmentItems(equipped, entry.address, entry.pool.slice(0, entry.quantity), catalogs());
      }
    }
  }
  assert.equal(resolveStartingEquipment(equipped, catalogs()).complete, true, "the fixture's equipment picks are complete");
  return applyStartingGrants(equipped, "equipment", { catalogs: catalogs() });
}

describe("Changing an earlier step releases what it invalidates", () => {
  test("the fixture finished every step up to Equipment", () => {
    const fighter = finishedFighter();
    for (const step of creationSteps(fighter, flowOpts)) {
      if (step.id === "review" || step.id === "details") continue;
      assert.equal(step.valid, true, `${step.id} should be valid`);
      assert.notEqual(step.status, "locked", `${step.id} should not be locked`);
    }
    assert.equal(currentCreationStep(fighter, flowOpts), "equipment");
    assert.ok(fighter.items.some((item) => item.id.startsWith("start_")), "the starting kit is claimed");
  });

  test("changing a finished Fighter's class to Rogue releases the class-dependent picks and flags their steps", () => {
    const fighter = finishedFighter();
    const rogue = applyCreationStepChange(fighter, { step: "class", className: "Rogue", source: "PHB" }, flowOpts);

    // The class changed, keeping the starting level.
    assert.deepEqual(rogue.classes, [{ className: "Rogue", source: "PHB", level: 6 }]);

    // Class skills are released.
    assert.deepEqual(rogue.skillChoices ?? [], []);
    assert.deepEqual(rogue.chosenSkills, []);

    // Class Choices are released: the Fighter's Fighting Style rule choice is gone.
    assert.deepEqual((rogue.ruleChoices ?? []).map((rc) => rc.id), []);
    assert.equal(isCreationStepValid(rogue, "classChoices", flowOpts), false);

    // Out-of-range ASI/Feats are released: the level-6 feat goes, the in-range level-4 ASI is kept under Rogue.
    assert.deepEqual(
      (rogue.asiSelections ?? []).map((s) => [s.className, s.classLevel ?? s.level, s.type]),
      [["Rogue", 4, "asi"]],
    );

    // Starting equipment is released: the picks, the claim markers and the granted start_ items.
    assert.equal(rogue.startingEquipmentPicks, undefined);
    assert.equal(rogue.startingGrantsApplied, false);
    assert.deepEqual(rogue.items.filter((item) => item.id.startsWith("start_")), []);

    // Race, background and abilities are kept.
    assert.deepEqual(rogue.race, fighter.race);
    assert.deepEqual(rogue.background, fighter.background);
    assert.equal(rogue.abilityMethod, fighter.abilityMethod);
    assert.deepEqual(rogue.standardArrayPicks, fighter.standardArrayPicks);
    assert.deepEqual(rogue.baseAbilityScores, fighter.baseAbilityScores);

    // The steps holding the released picks report needing attention; the kept ones do not.
    for (const id of ["subclass", "classChoices", "asiFeats", "equipment", "review"] as const) {
      assert.equal(creationStepNeedsAttention(rogue, id), true, `${id} should need attention`);
    }
    for (const id of ["race", "subrace", "background", "abilities", "details"] as const) {
      assert.equal(creationStepNeedsAttention(rogue, id), false, `${id} should not need attention`);
    }
    const byId = new Map(creationSteps(rogue, flowOpts).map((step) => [step.id, step]));
    assert.equal(byId.get("classChoices")?.needsAttention, true);
    assert.equal(byId.get("asiFeats")?.needsAttention, true);
    assert.equal(byId.get("equipment")?.needsAttention, true);
    assert.equal(byId.get("abilities")?.needsAttention, false);
    assert.equal(byId.get("background")?.needsAttention, false);

    // The draft sits on the changed step again.
    assert.equal(currentCreationStep(rogue, flowOpts), "class");
  });

  test("finishing a flagged step again clears its mark", () => {
    const fighter = finishedFighter();
    const rogue = applyCreationStepChange(fighter, { step: "class", className: "Rogue", source: "PHB" }, flowOpts);

    // An invalid step cannot be finished and keeps its mark.
    assert.equal(finishCreationStep(rogue, "classChoices", flowOpts), rogue);
    assert.equal(creationStepNeedsAttention(rogue, "classChoices"), true);

    // Re-pick the Rogue's class skills, then finish the step.
    const offer = skillChoiceOffers(rogue, flowOpts).find((o) => o.source === "Class: Rogue")!;
    const rePicked: Character = {
      ...rogue,
      skillChoices: [
        { id: offer.source, origin: "class", choose: offer.choose, from: offer.from, picked: offer.from.slice(0, offer.choose) },
      ],
      chosenSkills: offer.from.slice(0, offer.choose),
    };
    assert.equal(isCreationStepValid(rePicked, "classChoices", flowOpts), true);
    const finished = finishCreationStep(rePicked, "classChoices", flowOpts);
    assert.equal(creationStepNeedsAttention(finished, "classChoices"), false);
    assert.equal(creationStepNeedsAttention(finished, "asiFeats"), true, "the other marks stay");
    assert.equal(currentCreationStep(finished, flowOpts), "asiFeats");
  });
});

describe("Changing the ancestry or the background", () => {
  test("changing the race flags the Subrace step the new race leaves unpicked and keeps the rest", () => {
    const fighter = finishedFighter();
    const elf = allCatalogRaces(catalogs()).find((r) => r.name === "Elf")!;
    const changed = applyCreationStepChange(fighter, { step: "race", race: elf }, flowOpts);
    assert.equal(changed.race?.name, "Elf");
    assert.equal(changed.race?.subraceName, undefined);
    assert.equal(creationStepNeedsAttention(changed, "subrace"), true);
    assert.equal(creationStepNeedsAttention(changed, "background"), false);
    assert.equal(creationStepNeedsAttention(changed, "abilities"), false);
    assert.equal(creationStepNeedsAttention(changed, "classChoices"), false);
    assert.equal(currentCreationStep(changed, flowOpts), "race");
  });

  test("changing the background swaps it and flags no later step that stays valid", () => {
    const fighter = finishedFighter();
    const changed = applyCreationStepChange(
      fighter,
      { step: "background", background: { name: "Acolyte", source: "PHB" } },
      flowOpts,
    );
    assert.deepEqual(changed.background, { name: "Acolyte", source: "PHB" });
    assert.equal(creationStepNeedsAttention(changed, "classChoices"), false);
    assert.equal(creationStepNeedsAttention(changed, "equipment"), false);
    assert.equal(currentCreationStep(changed, flowOpts), "background");
  });
});

describe("The attention marks survive a save round-trip", () => {
  const roundTrip = (raw: object) =>
    migrateCharacter(
      JSON.parse(JSON.stringify(raw)),
      loadTestCatalog<RaceData[]>("races"),
      loadTestCatalog<ClassData[]>("classes"),
      ALL_BOOKS,
    );

  test("a draft with attention marks keeps them, and a malformed mark list is rejected", () => {
    const draft = makeChar({
      classes: [cl("Rogue", 6)],
      creationProgress: { currentStep: "class", needsAttention: ["classChoices", "equipment"] },
    });
    const migrated = roundTrip(draft);
    assert.deepEqual(migrated.creationProgress, { currentStep: "class", needsAttention: ["classChoices", "equipment"] });

    assert.throws(
      () => roundTrip({ ...draft, creationProgress: { currentStep: "class", needsAttention: ["not-a-step"] } }),
      /creationProgress/,
    );
    assert.throws(
      () => roundTrip({ ...draft, creationProgress: { currentStep: "class", needsAttention: "classChoices" } }),
      /creationProgress/,
    );
  });
});
