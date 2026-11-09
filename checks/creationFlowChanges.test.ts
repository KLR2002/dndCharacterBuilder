import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { makeChar, loadTestCatalog } from "./testUtils.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import { skillChoiceOffers } from "../src/rules/proficiencySheet.ts";
import { allCatalogClasses, allCatalogRaces } from "../src/rules/catalogs.ts";
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
  applyCreationStepEdit,
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

describe("Only steps whose picks a change released are flagged", () => {
  test("a blank draft picking a class for the first time flags no step", () => {
    const blank = makeChar({ creationProgress: { currentStep: "class" } });
    const picked = applyCreationStepChange(blank, { step: "class", className: "Fighter", source: "PHB" }, flowOpts);
    assert.equal(picked.classes[0]?.className, "Fighter");
    assert.deepEqual(picked.creationProgress?.needsAttention ?? [], []);
    for (const step of creationSteps(picked, flowOpts)) {
      assert.equal(step.needsAttention, false, `${step.id} should not be flagged: no pick of it was released`);
    }
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

  test("changing the subclass releases its rule choices and flags Class Choices even when it stays valid", () => {
    const battleMaster = makeChar({
      name: "Kara",
      classes: [cl("Fighter", 6, "Battle Master")],
      race: { name: "Human", source: "PHB", subraceName: "Variant", subraceSource: "PHB" },
      background: { name: "Soldier", source: "PHB" },
      abilityMethod: "standardArray",
      standardArrayPicks: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      baseAbilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      skillChoices: [
        { id: "Class: Fighter", origin: "class", choose: 2, from: ["Athletics", "Perception"], picked: ["Athletics", "Perception"] },
      ],
      chosenSkills: ["Athletics", "Perception"],
      ruleChoices: [
        { id: "PHB__Fighter__Fighting Style", trait: "Fighting Style", origin: "class", choose: 1, from: ["Defense"], picked: ["Defense"] },
        { id: "PHB__Fighter__Battle Master__Maneuver", trait: "Maneuvers", origin: "subclass", choose: 3, from: ["Riposte", "Parry", "Brace"], picked: ["Riposte", "Parry", "Brace"] },
      ],
      creationProgress: { currentStep: "classChoices" },
    });
    const changed = applyCreationStepChange(
      battleMaster,
      { step: "subclass", subclassName: "Champion", subclassSource: "PHB" },
      flowOpts,
    );
    assert.equal(changed.classes[0].subclassName, "Champion");
    assert.deepEqual(
      (changed.ruleChoices ?? []).map((rc) => rc.id),
      ["PHB__Fighter__Fighting Style"],
      "the Battle Master maneuvers are released, the class's own Fighting Style is kept",
    );
    assert.equal(isCreationStepValid(changed, "classChoices", flowOpts), true, "Class Choices stays valid on the new subclass");
    assert.equal(creationStepNeedsAttention(changed, "classChoices"), true, "a step whose picks were released is flagged even when valid");
    assert.equal(creationStepNeedsAttention(changed, "race"), false);
    assert.equal(currentCreationStep(changed, flowOpts), "subclass");
  });

  test("changing the background releases the spells only its list gave and flags the Spells step", () => {
    const cleric = makeChar({
      name: "Ash",
      classes: [cl("Cleric", 3, "Life Domain")],
      race: { name: "Human", source: "PHB" },
      background: { name: "Azorius Functionary", source: "GGR" },
      abilityMethod: "standardArray",
      standardArrayPicks: { str: 8, dex: 12, con: 13, int: 10, wis: 15, cha: 14 },
      baseAbilityScores: { str: 8, dex: 12, con: 13, int: 10, wis: 15, cha: 14 },
      knownSpells: [{ name: "Ensnaring Strike", source: "GGR", ownerKey: "Cleric__PHB" }],
      creationProgress: { currentStep: "spells" },
    });
    const changed = applyCreationStepChange(
      cleric,
      { step: "background", background: { name: "Hermit", source: "PHB" } },
      flowOpts,
    );
    assert.deepEqual(changed.knownSpells ?? [], [], "the spell only the old background's list gave is released");
    assert.equal(isCreationStepValid(changed, "spells", flowOpts), true, "the Spells step stays valid");
    assert.equal(creationStepNeedsAttention(changed, "spells"), true, "the Spells step is flagged because a pick of it was released");
  });

  test("changing the class releases a gold claim and flags Equipment even when the new class has no kit", () => {
    const fighter = applyStartingGrants(finishedFighter(), "gold", { goldAmount: 125, catalogs: catalogs() });
    assert.equal(fighter.startingOption, "gold");
    assert.equal(fighter.pouch.gp, 125);
    const sidekick = allCatalogClasses(catalogs()).find((c) => c.name === "Warrior Sidekick")!;
    const changed = applyCreationStepChange(
      fighter,
      { step: "class", className: "Warrior Sidekick", source: sidekick.source },
      flowOpts,
    );
    assert.deepEqual(changed.classes, [{ className: "Warrior Sidekick", source: sidekick.source, level: 6 }]);
    assert.equal(changed.startingGrantedGold, undefined);
    assert.equal(changed.startingGrantsApplied, false);
    assert.equal(changed.pouch.gp, 0, "the granted gold is released");
    assert.equal(isCreationStepValid(changed, "equipment", flowOpts), true, "the new class has no equipment kit to pick");
    assert.equal(creationStepNeedsAttention(changed, "equipment"), true, "the Equipment step is flagged because its claim was released");
  });
});

describe("Finishing a step moves the current step only forward", () => {
  test("finishing an earlier step the player went back to keeps the later current step", () => {
    const fighter = finishedFighter();
    assert.equal(currentCreationStep(fighter, flowOpts), "equipment");

    const finished = finishCreationStep(fighter, "class", flowOpts);
    assert.equal(currentCreationStep(finished, flowOpts), "equipment", "finishing Class must not move the draft back from Equipment");

    const byId = new Map(creationSteps(finished, flowOpts).map((step) => [step.id, step]));
    assert.equal(byId.get("race")?.status, "finished", "steps before the current step stay finished, not locked again");
    assert.equal(byId.get("background")?.status, "finished");
    assert.equal(byId.get("details")?.status, "locked", "steps after the current step stay locked");
  });

  test("a step needing attention stays the current step's blocker when an earlier step is finished", () => {
    const fighter = finishedFighter();
    const flagged: Character = {
      ...fighter,
      creationProgress: { currentStep: "classChoices", needsAttention: ["equipment"] },
    };
    const finished = finishCreationStep(flagged, "race", flowOpts);
    assert.equal(currentCreationStep(finished, flowOpts), "classChoices", "the flagged current step stays until it is finished");
    assert.equal(creationStepNeedsAttention(finished, "equipment"), true);
  });

  test("finishing the current step walks forward to Review and finishing Review finishes the character", () => {
    let draft = finishedFighter();
    assert.equal(currentCreationStep(draft, flowOpts), "equipment");
    draft = finishCreationStep(draft, "equipment", flowOpts);
    assert.equal(currentCreationStep(draft, flowOpts), "details");
    draft = finishCreationStep(draft, "details", flowOpts);
    assert.equal(currentCreationStep(draft, flowOpts), "review");
    assert.equal(isCreationStepValid(draft, "review", flowOpts), true);
    draft = finishCreationStep(draft, "review", flowOpts);
    assert.equal(draft.creationProgress, undefined, "finishing Review leaves no creation progress");
  });
});

describe("A generic edit on a step records the change like applyCreationStepChange", () => {
  test("an edit on an earlier step re-anchors the draft on it and flags what it released", () => {
    const fighter = finishedFighter();
    const edited = applyCreationStepEdit(
      fighter,
      "race",
      (cur) => ({ ...cur, race: { name: "Elf", source: "PHB" } }),
      flowOpts,
    );
    assert.equal(currentCreationStep(edited, flowOpts), "race");
    assert.equal(creationStepNeedsAttention(edited, "subrace"), true);
    // An edit that changes nothing leaves the character untouched.
    assert.equal(applyCreationStepEdit(fighter, "race", (cur) => cur, flowOpts), fighter);
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
