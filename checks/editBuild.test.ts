import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { loadTestCatalog, makeChar } from "./testUtils.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import {
  applyStartingGrants,
  removeClassLevel,
} from "../src/rules/builderTransitions.ts";
import {
  resolveStartingEquipment,
  setStartingEquipmentItems,
  setStartingEquipmentOption,
  startingEquipmentCard,
  startingEquipmentOffers,
} from "../src/rules/startingEquipment.ts";
import { skillChoiceOffers } from "../src/rules/proficiencySheet.ts";
import { allCatalogRaces } from "../src/rules/catalogs.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { rolledHitPointsKey } from "../src/rules/hp.ts";
import {
  applyBuildStepUpdate,
  applyCreationStepChange,
  applyCreationStepEdit,
  classStepMinLevel,
  creationStepNeedsAttention,
  creationSteps,
  finishCreationStep,
  isCreationFinished,
  isCreationStepValid,
} from "../src/rules/creationFlow.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import type { RaceData } from "../src/types/dnd5e.ts";

const flowOpts = { activeBooks: ALL_BOOKS };
const catalogs = () => ({ compendium: currentCompendium(), activeBooks: ALL_BOOKS });

/**
 * A finished Fighter 3 / Wizard 2 (no creation progress, so finished): the Fighter holds its skills, Fighting
 * Style and Battle Master maneuvers and a claimed kit; the Wizard holds its Evocation school (the subclass came
 * at 2), learned spells including a 2nd-level one, and rolled hit points for every level of both classes.
 */
function finishedFighterWizard(): Character {
  const base = makeChar({
    name: "Sera",
    classes: [
      { className: "Fighter", source: "PHB", level: 3, subclassName: "Battle Master", subclassSource: "PHB" },
      { className: "Wizard", source: "PHB", level: 2, subclassName: "Evocation", subclassSource: "PHB" },
    ],
    race: { name: "Human", source: "PHB" },
    background: { name: "Acolyte", source: "PHB" },
    abilityMethod: "standardArray",
    standardArrayPicks: { str: 15, dex: 14, con: 13, int: 16, wis: 10, cha: 8 },
    baseAbilityScores: { str: 15, dex: 14, con: 13, int: 16, wis: 10, cha: 8 },
    knownSpells: [
      { name: "Fire Bolt", source: "PHB", ownerKey: "Wizard__PHB" },
      { name: "Magic Missile", source: "PHB", ownerKey: "Wizard__PHB" },
      { name: "Misty Step", source: "PHB", ownerKey: "Wizard__PHB" },
    ],
    preparedSpells: ["Magic Missile__PHB__Wizard__PHB", "Misty Step__PHB__Wizard__PHB"],
    rolledHitPoints: {
      [rolledHitPointsKey("Fighter", 1)]: 8,
      [rolledHitPointsKey("Fighter", 2)]: 6,
      [rolledHitPointsKey("Fighter", 3)]: 7,
      [rolledHitPointsKey("Wizard", 1)]: 5,
      [rolledHitPointsKey("Wizard", 2)]: 4,
    },
    ruleChoices: [
      { id: "PHB__Fighter__Fighting Style", trait: "Fighting Style", origin: "class", choose: 1, from: ["Defense"], picked: ["Defense"] },
      { id: "PHB__Fighter__Battle Master__Maneuver", trait: "Maneuvers", origin: "subclass", choose: 3, from: ["Riposte", "Parry", "Brace"], picked: ["Riposte", "Parry", "Brace"] },
    ],
  });
  const skillOffer = skillChoiceOffers(base, flowOpts).find((offer) => offer.source === "Class: Fighter")!;
  let equipped: Character = {
    ...base,
    skillChoices: [
      { id: skillOffer.source, origin: "class", choose: skillOffer.choose, from: skillOffer.from, picked: skillOffer.from.slice(0, skillOffer.choose) },
    ],
    chosenSkills: skillOffer.from.slice(0, skillOffer.choose),
  };
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

describe("Edit Build on a finished character keeps it finished", () => {
  test("a finished character reports every step as finished, so every step is reachable", () => {
    const fw = finishedFighterWizard();
    assert.equal(isCreationFinished(fw), true);
    for (const step of creationSteps(fw, flowOpts)) {
      assert.equal(step.status, "finished", `${step.id} is reachable in Edit Build`);
      assert.equal(step.needsAttention, false);
    }
  });

  test("an edit-build change records the attention marks while the character stays finished", () => {
    const fw = finishedFighterWizard();
    const elf = allCatalogRaces(catalogs()).find((r) => r.name === "Elf")!;
    const changed = applyCreationStepChange(fw, { step: "race", race: elf }, { ...flowOpts, editBuild: true });
    assert.equal(changed.race?.name, "Elf");
    assert.equal(isCreationFinished(changed), true, "the character stays finished");
    assert.equal(changed.creationProgress?.editBuild, true);
    assert.equal(creationStepNeedsAttention(changed, "subrace"), true, "the Subrace step is flagged");
    for (const step of creationSteps(changed, flowOpts)) {
      assert.equal(step.status, "finished", `${step.id} stays reachable, not locked`);
    }
  });
});

describe("Lowering a class level in Edit Build releases that level's picks and never adds", () => {
  test("lowering Wizard 2 to 1 releases the level's subclass, learned spell and rolled hit points record", () => {
    const fw = finishedFighterWizard();
    const lowered = applyCreationStepEdit(
      fw,
      "class",
      (cur) => removeClassLevel(cur, "Wizard", currentCompendium(), ALL_BOOKS),
      { ...flowOpts, editBuild: true },
    );

    // The class level drops and the subclass that came at 2 is torn down with it.
    const wizard = lowered.classes.find((c) => c.className === "Wizard") as CharacterClass;
    assert.equal(wizard.level, 1);
    assert.equal(wizard.subclassName, undefined, "the Evocation school that came at level 2 is released");
    assert.equal(lowered.classes.find((c) => c.className === "Fighter")?.level, 3, "the other class is untouched");

    // The removed level's rolled Hit Points record goes with it; the other levels' records stay.
    assert.equal(lowered.rolledHitPoints?.[rolledHitPointsKey("Wizard", 2)], undefined);
    assert.equal(lowered.rolledHitPoints?.[rolledHitPointsKey("Wizard", 1)], 5);
    assert.equal(lowered.rolledHitPoints?.[rolledHitPointsKey("Fighter", 3)], 7);

    // The spell learned at level 2 (above the new maximum spell level) is released; the lower-level ones stay.
    assert.deepEqual(
      (lowered.knownSpells ?? []).map((k) => k.name).sort(),
      ["Fire Bolt", "Magic Missile"],
      "Misty Step, learned at Wizard 2, is released",
    );
    assert.deepEqual(
      lowered.preparedSpells ?? [],
      ["Magic Missile__PHB__Wizard__PHB"],
      "the released spell's prepared key goes with it",
    );

    // The change is flagged like a draft's, and the character stays finished.
    assert.equal(isCreationFinished(lowered), true);
    assert.equal(lowered.creationProgress?.editBuild, true);
    assert.ok((lowered.creationProgress?.needsAttention ?? []).length > 0, "later steps are flagged");
    assert.equal(creationStepNeedsAttention(lowered, "review"), true);
    for (const step of creationSteps(lowered, flowOpts)) {
      assert.equal(step.status, "finished", `${step.id} stays reachable`);
    }
  });

  test("a flagged step of a finished character is finished again, clearing its mark and keeping it finished", () => {
    // A single-class finished Fighter 3 / Battle Master: lowering to 2 releases the level-3 maneuvers.
    const fw = finishedFighterWizard();
    const fighterOnly: Character = { ...fw, classes: [fw.classes[0]] };
    const lowered = applyCreationStepEdit(
      fighterOnly,
      "class",
      (cur) => removeClassLevel(cur, "Fighter", currentCompendium(), ALL_BOOKS),
      { ...flowOpts, editBuild: true },
    );
    assert.equal(lowered.classes[0].level, 2);
    assert.equal(lowered.classes[0].subclassName, undefined, "below the subclass level the Battle Master is torn down");
    assert.deepEqual(
      (lowered.ruleChoices ?? []).map((rc) => rc.id),
      ["PHB__Fighter__Fighting Style"],
      "the level-3 maneuvers are released, the Fighting Style stays",
    );
    assert.equal(creationStepNeedsAttention(lowered, "classChoices"), true, "Class Choices is flagged");
    assert.equal(isCreationFinished(lowered), true);

    // The flagged step can be finished again once valid: its mark clears and the character stays finished.
    const finished = finishCreationStep(lowered, "classChoices", flowOpts);
    assert.equal(creationStepNeedsAttention(finished, "classChoices"), false);
    assert.equal(isCreationFinished(finished), true, "finishing a step of a finished character keeps it finished");

    // Finishing the last flagged step drops the record entirely: plain finished again.
    assert.equal(finished.creationProgress, undefined);
    assert.equal(isCreationFinished(finished), true);
  });

  test("lowering a later class reads every held class: Class stays valid and only released steps are flagged", () => {
    // A finished Fighter 3 / Wizard 2 whose every step is valid.
    const fw: Character = makeChar({
      name: "Sera",
      classes: [
        { className: "Fighter", source: "PHB", level: 3, subclassName: "Champion", subclassSource: "PHB" },
        { className: "Wizard", source: "PHB", level: 2, subclassName: "Evocation", subclassSource: "PHB" },
      ],
      race: { name: "Human", source: "PHB" },
      background: { name: "Acolyte", source: "PHB" },
      abilityMethod: "standardArray",
      standardArrayPicks: { str: 15, dex: 14, con: 13, int: 16, wis: 10, cha: 8 },
      baseAbilityScores: { str: 15, dex: 14, con: 13, int: 16, wis: 10, cha: 8 },
      startingOption: "gold",
      knownSpells: [
        { name: "Fire Bolt", source: "PHB", ownerKey: "Wizard__PHB" },
        { name: "Magic Missile", source: "PHB", ownerKey: "Wizard__PHB" },
        { name: "Misty Step", source: "PHB", ownerKey: "Wizard__PHB" },
      ],
      preparedSpells: ["Magic Missile__PHB__Wizard__PHB", "Misty Step__PHB__Wizard__PHB"],
      ruleChoices: [
        { id: "PHB__Fighter__Fighting Style", trait: "Fighting Style", origin: "class", choose: 1, from: ["Defense"], picked: ["Defense"] },
      ],
      skillChoices: [
        { id: "Class: Fighter", origin: "class", choose: 2, from: ["Athletics", "Perception"], picked: ["Athletics", "Perception"] },
      ],
      chosenSkills: ["Athletics", "Perception"],
    });
    assert.equal(isCreationStepValid(fw, "class", flowOpts), true, "the Class step is valid for a multiclass character");
    assert.equal(isCreationStepValid(fw, "review", flowOpts), true, "every step of the fixture is valid");

    const lowered = applyCreationStepEdit(
      fw,
      "class",
      (cur) => removeClassLevel(cur, "Wizard", currentCompendium(), ALL_BOOKS),
      { ...flowOpts, editBuild: true },
    );
    assert.equal(isCreationStepValid(lowered, "class", flowOpts), true, "the Class step stays valid after the change");
    assert.equal(isCreationStepValid(lowered, "review", flowOpts), true, "Review is not falsely flagged");
    assert.deepEqual(
      lowered.creationProgress?.needsAttention ?? [],
      ["subclass", "spells"],
      "only the steps whose picks were released are flagged: the torn-down subclass and the released spell",
    );
    assert.equal(creationStepNeedsAttention(lowered, "classChoices"), false, "the Fighter's picks were not released");
  });

  test("a mark from an earlier edit survives a later edit on another step", () => {
    const fw = finishedFighterWizard();
    const fighterOnly: Character = { ...fw, classes: [fw.classes[0]] };
    const lowered = applyCreationStepEdit(
      fighterOnly,
      "class",
      (cur) => removeClassLevel(cur, "Fighter", currentCompendium(), ALL_BOOKS),
      { ...flowOpts, editBuild: true },
    );
    assert.equal(creationStepNeedsAttention(lowered, "classChoices"), true, "lowering Fighter 3->2 released the level-3 maneuvers");
    const edited = applyCreationStepChange(
      lowered,
      { step: "background", background: { name: "Hermit", source: "PHB" } },
      { ...flowOpts, editBuild: true },
    );
    assert.equal(
      creationStepNeedsAttention(edited, "classChoices"),
      true,
      "the Class Choices mark persists until that step is finished again, not until the next edit",
    );
  });

  test("Edit Build refuses a raised level and an added class; Level up allows both", () => {
    const fw = finishedFighterWizard();
    const raised: Character = { ...fw, classes: fw.classes.map((c, i) => (i === 0 ? { ...c, level: c.level + 1 } : c)) };
    assert.equal(applyBuildStepUpdate(fw, raised, "class", "edit", flowOpts), fw, "Edit Build does not raise a level");
    const added: Character = { ...fw, classes: [...fw.classes, { className: "Rogue", source: "PHB", level: 1 }] };
    assert.equal(applyBuildStepUpdate(fw, added, "class", "edit", flowOpts), fw, "Edit Build does not add a class");
    assert.equal(applyBuildStepUpdate(fw, raised, "class", "levelup", flowOpts).classes[0].level, 4, "Level up raises the level");
    assert.equal(applyBuildStepUpdate(fw, added, "class", "levelup", flowOpts).classes.length, 3, "Level up adds the class");
  });

  test("Edit Build lowers a non-first class below 1, removing it; the first class stays at least 1", () => {
    assert.equal(classStepMinLevel("edit", 0), 1, "the first class stays at least level 1 in Edit Build");
    assert.equal(classStepMinLevel("edit", 1), 0, "a later class can be lowered below 1, which removes it");
    const fw = finishedFighterWizard();
    const withWizard1: Character = { ...fw, classes: [fw.classes[0], { className: "Wizard", source: "PHB", level: 1 }] };
    const lowered = applyCreationStepEdit(
      withWizard1,
      "class",
      (cur) => removeClassLevel(cur, "Wizard", currentCompendium(), ALL_BOOKS),
      { ...flowOpts, editBuild: true },
    );
    assert.deepEqual(lowered.classes.map((c) => c.className), ["Fighter"], "lowering the level-1 Wizard below 1 removes it");
    assert.equal(isCreationFinished(lowered), true);
  });
});

describe("The edit-build progress record survives a save round-trip", () => {
  const roundTrip = (raw: object) =>
    migrateCharacter(
      JSON.parse(JSON.stringify(raw)),
      loadTestCatalog<RaceData[]>("races"),
      loadTestCatalog("classes"),
      ALL_BOOKS,
    );

  test("a finished character with edit-build marks keeps them, and a malformed marker is rejected", () => {
    const fw = finishedFighterWizard();
    const edited: Character = {
      ...fw,
      creationProgress: { currentStep: "class", editBuild: true, needsAttention: ["review"] },
    };
    const migrated = roundTrip(edited);
    assert.deepEqual(migrated.creationProgress, { currentStep: "class", editBuild: true, needsAttention: ["review"] });
    assert.equal(isCreationFinished(migrated), true);

    assert.throws(
      () => roundTrip({ ...edited, creationProgress: { currentStep: "class", editBuild: "yes" } }),
      /creationProgress/,
    );
  });
});
