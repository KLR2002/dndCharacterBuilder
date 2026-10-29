import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile , teardownSubclass } from "../src/rules/characterReconciler.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import { makeChar } from "./testUtils.ts";
import {
  getSuperiorityDice,
  getManeuverSaveDc,
  getClassDice,
} from "../src/rules/combatDice.ts";
import {
  battleMasterManeuverChoices,
  getChosenManeuvers,
  pickRuleChoice,
  isManeuverChoiceId,
  subclassRuleChoices,
} from "../src/rules/ruleChoices.ts";
import { removeAsiSelection } from "../src/rules/leveling.ts";
import {
  calculateAutoResourceCounters,
  getMergedResourceCounters,
} from "../src/rules/resourceCounters.ts";

test("Battle Master level 3 offers 3 maneuvers and 4d8 superiority dice", () => {
  const bm3 = makeChar({
    classes: [
      {
        className: "Fighter",
        level: 3,
        subclassName: "Battle Master",
        hitDiceType: "d10",
      },
    ],
  });

  const dice = getSuperiorityDice(bm3);
  assert.deepEqual(dice, { battleMaster: { count: 4, die: "d8" }, bonus: null });

  const classDice = getClassDice(bm3);
  assert.deepEqual(classDice.superiorityDice, { battleMaster: { count: 4, die: "d8" }, bonus: null });

  const choices = battleMasterManeuverChoices(bm3, ALL_BOOKS);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].id, "PHB__Fighter__Battle Master__Maneuvers 3");
  assert.equal(choices[0].traitName, "Combat Superiority (3rd Level)");
  assert.equal(choices[0].choose, 3);
  assert.equal(choices[0].level, 3);
  assert.ok(choices[0].options.length > 0);

  // Wired into subclassRuleChoices
  const subChoices = subclassRuleChoices(bm3, ALL_BOOKS);
  assert.ok(subChoices.some((c) => c.id === "PHB__Fighter__Battle Master__Maneuvers 3"));
});

test("Battle Master level 7 offers +2 maneuvers and 5d8 superiority dice", () => {
  const bm7 = makeChar({
    classes: [
      {
        className: "Fighter",
        level: 7,
        subclassName: "Battle Master",
        hitDiceType: "d10",
      },
    ],
  });

  const dice = getSuperiorityDice(bm7);
  assert.deepEqual(dice, { battleMaster: { count: 5, die: "d8" }, bonus: null });

  const choices = battleMasterManeuverChoices(bm7, ALL_BOOKS);
  assert.equal(choices.length, 2);
  assert.equal(choices[0].id, "PHB__Fighter__Battle Master__Maneuvers 3");
  assert.equal(choices[0].choose, 3);

  assert.equal(choices[1].id, "PHB__Fighter__Battle Master__Maneuvers 7");
  assert.equal(choices[1].traitName, "Additional Maneuvers (7th Level)");
  assert.equal(choices[1].choose, 2);
  assert.equal(choices[1].level, 7);
});

test("Battle Master level 10 scales dice to d10 and offers +2 maneuvers", () => {
  const bm10 = makeChar({
    classes: [
      {
        className: "Fighter",
        level: 10,
        subclassName: "Battle Master",
        hitDiceType: "d10",
      },
    ],
  });

  const dice = getSuperiorityDice(bm10);
  assert.deepEqual(dice, { battleMaster: { count: 5, die: "d10" }, bonus: null });

  const choices = battleMasterManeuverChoices(bm10, ALL_BOOKS);
  assert.equal(choices.length, 3);
  assert.equal(choices[2].id, "PHB__Fighter__Battle Master__Maneuvers 10");
  assert.equal(choices[2].traitName, "Additional Maneuvers (10th Level)");
  assert.equal(choices[2].choose, 2);
  assert.equal(choices[2].level, 10);
});

test("Battle Master level 15 offers 6d10 dice and +2 maneuvers", () => {
  const bm15 = makeChar({
    classes: [
      {
        className: "Fighter",
        level: 15,
        subclassName: "Battle Master",
        hitDiceType: "d10",
      },
    ],
  });

  const dice = getSuperiorityDice(bm15);
  assert.deepEqual(dice, { battleMaster: { count: 6, die: "d10" }, bonus: null });

  const choices = battleMasterManeuverChoices(bm15, ALL_BOOKS);
  assert.equal(choices.length, 4);
  assert.equal(choices[3].id, "PHB__Fighter__Battle Master__Maneuvers 15");
  assert.equal(choices[3].traitName, "Additional Maneuvers (15th Level)");
  assert.equal(choices[3].choose, 2);
  assert.equal(choices[3].level, 15);
});

test("Battle Master level 18 scales dice to d12", () => {
  const bm18 = makeChar({
    classes: [
      {
        className: "Fighter",
        level: 18,
        subclassName: "Battle Master",
        hitDiceType: "d10",
      },
    ],
  });

  const dice = getSuperiorityDice(bm18);
  assert.deepEqual(dice, { battleMaster: { count: 6, die: "d12" }, bonus: null });
});

test("Deduplication: maneuver chosen at 3 is not offered at 7", () => {
  let char = makeChar({
    classes: [
      {
        className: "Fighter",
        level: 7,
        subclassName: "Battle Master",
        hitDiceType: "d10",
      },
    ],
  });

  const choices = battleMasterManeuverChoices(char, ALL_BOOKS);
  const choice3 = choices.find((c) => c.id === "PHB__Fighter__Battle Master__Maneuvers 3")!;

  // Pick 3 maneuvers at level 3
  char = pickRuleChoice(char, choice3, "Trip Attack", undefined, ALL_BOOKS);
  char = pickRuleChoice(char, choice3, "Riposte", undefined, ALL_BOOKS);
  char = pickRuleChoice(char, choice3, "Disarming Attack", undefined, ALL_BOOKS);

  const chosen = getChosenManeuvers(char);
  assert.deepEqual(chosen.sort(), ["Disarming Attack", "Riposte", "Trip Attack"].sort());

  // Check choices at level 7: none of the 3 picked should be offered in choice 7
  const updatedChoices = battleMasterManeuverChoices(char, ALL_BOOKS);
  const choice7 = updatedChoices.find((c) => c.id === "PHB__Fighter__Battle Master__Maneuvers 7")!;
  const choice7OptionNames = choice7.options.map((o) => o.name);

  assert.ok(!choice7OptionNames.includes("Trip Attack"));
  assert.ok(!choice7OptionNames.includes("Riposte"));
  assert.ok(!choice7OptionNames.includes("Disarming Attack"));
  assert.ok(choice7OptionNames.includes("Menacing Attack"));

  // Meanwhile, choice 3 should still present its picked options so player can modify
  const choice3Updated = updatedChoices.find((c) => c.id === "PHB__Fighter__Battle Master__Maneuvers 3")!;
  const choice3OptionNames = choice3Updated.options.map((o) => o.name);
  assert.ok(choice3OptionNames.includes("Trip Attack"));
  assert.ok(choice3OptionNames.includes("Riposte"));
  assert.ok(choice3OptionNames.includes("Disarming Attack"));
});

test("Superior Technique is a separate d6 pool and offers 1 maneuver", () => {
  // Non-Battle Master with Superior Technique
  const paladinWithStyle = makeChar({
    classes: [{ className: "Paladin", level: 2, hitDiceType: "d10" }],
    ruleChoices: [
      {
        id: "PHB__Paladin__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Superior Technique"],
        picked: ["Superior Technique"],
      },
    ],
  });

  const paladinDice = getSuperiorityDice(paladinWithStyle);
  assert.deepEqual(paladinDice, { battleMaster: null, bonus: { count: 1, die: "d6" } });

  const paladinChoices = battleMasterManeuverChoices(paladinWithStyle, ALL_BOOKS);
  assert.equal(paladinChoices.length, 1);
  assert.equal(paladinChoices[0].id, "TCE__Fighter__Superior Technique__Maneuver");
  assert.equal(paladinChoices[0].choose, 1);

  // Battle Master 3 with Superior Technique -> 4d8 plus a separate 1d6
  const bm3WithStyle = makeChar({
    classes: [
      {
        className: "Fighter",
        level: 3,
        subclassName: "Battle Master",
        hitDiceType: "d10",
      },
    ],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Superior Technique"],
        picked: ["Superior Technique"],
      },
    ],
  });

  const bm3Dice = getSuperiorityDice(bm3WithStyle);
  assert.deepEqual(bm3Dice, { battleMaster: { count: 4, die: "d8" }, bonus: { count: 1, die: "d6" } });

  // Battle Master 10 with Superior Technique -> 5d10 plus a separate 1d6
  const bm10WithStyle = makeChar({
    classes: [
      {
        className: "Fighter",
        level: 10,
        subclassName: "Battle Master",
        hitDiceType: "d10",
      },
    ],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Superior Technique"],
        picked: ["Superior Technique"],
      },
    ],
  });

  const bm10Dice = getSuperiorityDice(bm10WithStyle);
  assert.deepEqual(bm10Dice, { battleMaster: { count: 5, die: "d10" }, bonus: { count: 1, die: "d6" } });
});

test("Martial Adept is a separate d6 pool and offers 2 maneuvers", () => {
  // Rogue with Martial Adept feat in asiSelections
  const rogueWithFeat = makeChar({
    classes: [{ className: "Rogue", level: 4, hitDiceType: "d8" }],
    asiSelections: [
      {
        className: "Rogue",
        classLevel: 4,
        level: 4,
        type: "feat",
        featName: "Martial Adept",
      },
    ],
  });

  const rogueDice = getSuperiorityDice(rogueWithFeat);
  assert.deepEqual(rogueDice, { battleMaster: null, bonus: { count: 1, die: "d6" } });

  const rogueChoices = battleMasterManeuverChoices(rogueWithFeat, ALL_BOOKS);
  assert.equal(rogueChoices.length, 1);
  assert.equal(rogueChoices[0].id, "PHB__Feat__Martial Adept__Maneuvers");
  assert.equal(rogueChoices[0].choose, 2);

  // Battle Master 3 with Martial Adept -> 4d8 plus a separate 1d6
  const bm3WithFeat = makeChar({
    classes: [
      {
        className: "Fighter",
        level: 3,
        subclassName: "Battle Master",
        hitDiceType: "d10",
      },
    ],
    asiSelections: [
      {
        className: "Fighter",
        classLevel: 4,
        level: 4,
        type: "feat",
        featName: "Martial Adept",
      },
    ],
  });

  const bm3FeatDice = getSuperiorityDice(bm3WithFeat);
  assert.deepEqual(bm3FeatDice, { battleMaster: { count: 4, die: "d8" }, bonus: { count: 1, die: "d6" } });

  // Non-Battle Master with BOTH Superior Technique and Martial Adept -> 2d6 in one bonus pool
  const bothNonBm = makeChar({
    classes: [{ className: "Paladin", level: 4, hitDiceType: "d10" }],
    ruleChoices: [
      {
        id: "PHB__Paladin__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Superior Technique"],
        picked: ["Superior Technique"],
      },
    ],
    asiSelections: [
      {
        className: "Paladin",
        classLevel: 4,
        level: 4,
        type: "feat",
        featName: "Martial Adept",
      },
    ],
  });

  const bothDice = getSuperiorityDice(bothNonBm);
  assert.deepEqual(bothDice, { battleMaster: null, bonus: { count: 2, die: "d6" } });

  // Battle Master 3 with BOTH Superior Technique and Martial Adept -> 4d8 plus a separate 2d6
  const bm3Both = makeChar({
    classes: [
      {
        className: "Fighter",
        level: 3,
        subclassName: "Battle Master",
        hitDiceType: "d10",
      },
    ],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Superior Technique"],
        picked: ["Superior Technique"],
      },
    ],
    asiSelections: [
      {
        className: "Fighter",
        classLevel: 4,
        level: 4,
        type: "feat",
        featName: "Martial Adept",
      },
    ],
  });

  const bm3BothDice = getSuperiorityDice(bm3Both);
  assert.deepEqual(bm3BothDice, { battleMaster: { count: 4, die: "d8" }, bonus: { count: 2, die: "d6" } });
});

test("Battle Master 10 with Superior Technique and Martial Adept keeps 5d10 and a separate 2d6", () => {
  const bm10Both = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 10, subclassName: "Battle Master" }],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Superior Technique"],
        picked: ["Superior Technique"],
      },
    ],
    asiSelections: [
      { className: "Fighter", classLevel: 4, level: 4, type: "feat", featName: "Martial Adept" },
    ],
  });

  assert.deepEqual(getSuperiorityDice(bm10Both), {
    battleMaster: { count: 5, die: "d10" },
    bonus: { count: 2, die: "d6" },
  });
});

test("Battle Master 18 with Superior Technique keeps d12 for its pool and d6 for the bonus", () => {
  const bm18WithStyle = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 18, subclassName: "Battle Master" }],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Superior Technique"],
        picked: ["Superior Technique"],
      },
    ],
  });

  assert.deepEqual(getSuperiorityDice(bm18WithStyle), {
    battleMaster: { count: 6, die: "d12" },
    bonus: { count: 1, die: "d6" },
  });
});

const SUPERIORITY_STYLE_CHOICE = {
  id: "PHB__Fighter__Fighting Style",
  trait: "Fighting Style",
  origin: "class" as const,
  choose: 1,
  from: ["Superior Technique"],
  picked: ["Superior Technique"],
};

test("superiority counters: the Battle Master pool and the bonus pool are two counters", () => {
  const bm3WithStyle = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 3, subclassName: "Battle Master" }],
    ruleChoices: [SUPERIORITY_STYLE_CHOICE],
  });

  const counters = calculateAutoResourceCounters(bm3WithStyle, {});
  assert.deepEqual(counters.superiority_dice, {
    id: "superiority_dice",
    name: "Superiority Dice [d8]",
    current: 4,
    max: 4,
    resetOn: "short",
  });
  assert.deepEqual(counters.superiority_dice_d6, {
    id: "superiority_dice_d6",
    name: "Superiority Dice [d6]",
    current: 1,
    max: 1,
    resetOn: "short",
  });
});

test("superiority counters: a non-Battle Master holds only the d6 counter", () => {
  const paladinWithStyle = makeChar({
    classes: [{ className: "Paladin", source: "PHB", level: 2 }],
    ruleChoices: [{ ...SUPERIORITY_STYLE_CHOICE, id: "PHB__Paladin__Fighting Style" }],
  });

  const counters = calculateAutoResourceCounters(paladinWithStyle, {});
  assert.equal(counters.superiority_dice, undefined);
  assert.equal(counters.superiority_dice_d6?.name, "Superiority Dice [d6]");
  assert.equal(counters.superiority_dice_d6?.max, 1);
});

test("superiority counters: a saved Battle Master spent count survives and clamps to the new max", () => {
  const bm3WithStyle = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 3, subclassName: "Battle Master" }],
    ruleChoices: [SUPERIORITY_STYLE_CHOICE],
    resourceCounters: {
      superiority_dice: { id: "superiority_dice", name: "Superiority Dice [d8]", current: 2, max: 5, resetOn: "short" },
    },
  });
  const merged = getMergedResourceCounters(bm3WithStyle, calculateAutoResourceCounters(bm3WithStyle, {}));
  assert.equal(merged.superiority_dice.current, 2);
  assert.equal(merged.superiority_dice.max, 4);
  assert.equal(merged.superiority_dice_d6.current, 1);

  const overSpent = makeChar({
    ...bm3WithStyle,
    resourceCounters: {
      superiority_dice: { id: "superiority_dice", name: "Superiority Dice [d8]", current: 9, max: 9, resetOn: "short" },
    },
  });
  const clamped = getMergedResourceCounters(overSpent, calculateAutoResourceCounters(overSpent, {}));
  assert.equal(clamped.superiority_dice.current, 4);
});

test("superiority counters: a saved spent count moves to the d6 counter when the Battle Master pool is gone", () => {
  const paladinWithStyle = makeChar({
    classes: [{ className: "Paladin", source: "PHB", level: 2 }],
    ruleChoices: [{ ...SUPERIORITY_STYLE_CHOICE, id: "PHB__Paladin__Fighting Style" }],
    resourceCounters: {
      superiority_dice: { id: "superiority_dice", name: "Superiority Dice [d6]", current: 0, max: 1, resetOn: "short" },
    },
  });
  const merged = getMergedResourceCounters(paladinWithStyle, calculateAutoResourceCounters(paladinWithStyle, {}));
  assert.equal(merged.superiority_dice, undefined);
  assert.equal(merged.superiority_dice_d6.current, 0);
});

test("superiority counters: a character with no superiority pool drops both counters", () => {
  const wiz = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 5 }],
    resourceCounters: {
      superiority_dice: { id: "superiority_dice", name: "Superiority Dice [d8]", current: 1, max: 4, resetOn: "short" },
    },
  });
  const merged = getMergedResourceCounters(wiz, calculateAutoResourceCounters(wiz, {}));
  assert.equal(merged.superiority_dice, undefined);
  assert.equal(merged.superiority_dice_d6, undefined);
});

test("Maneuver Save DC equals 8 + PB + max(Str, Dex)", () => {
  // Level 3 BM, Str 16 (+3), Dex 14 (+2), PB 2 -> 8 + 2 + 3 = 13
  const bmStr = makeChar({
    baseAbilityScores: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", level: 3, hitDiceType: "d10", subclassName: "Battle Master" }],
  });
  assert.equal(getManeuverSaveDc(bmStr), 13);

  // Level 7 BM, Str 10 (+0), Dex 18 (+4), PB 3 -> 8 + 3 + 4 = 15
  const bmDex = makeChar({
    baseAbilityScores: { str: 10, dex: 18, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", level: 7, hitDiceType: "d10", subclassName: "Battle Master" }],
  });
  assert.equal(getManeuverSaveDc(bmDex), 15);

  // Level 17 BM, Str 20 (+5), Dex 12 (+1), PB 6 -> 8 + 6 + 5 = 19
  const bmHigh = makeChar({
    baseAbilityScores: { str: 20, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", level: 17, hitDiceType: "d10", subclassName: "Battle Master" }],
  });
  assert.equal(getManeuverSaveDc(bmHigh), 19);

  // Negative modifiers: Str 8 (-1), Dex 8 (-1), PB 2 -> 8 + 2 - 1 = 9
  const bmLow = makeChar({
    baseAbilityScores: { str: 8, dex: 8, con: 10, int: 10, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", level: 1, hitDiceType: "d10" }],
  });
  assert.equal(getManeuverSaveDc(bmLow), 9);
});

test("Negative boundaries: Level gating and non-Battle Master classes", () => {
  // Fighter level 2 (before subclass milestone)
  const f2 = makeChar({ classes: [{ className: "Fighter", level: 2, hitDiceType: "d10" }] });
  assert.equal(getSuperiorityDice(f2), null);
  assert.equal(battleMasterManeuverChoices(f2, ALL_BOOKS).length, 0);

  // Fighter level 3 Champion (different subclass)
  const champ3 = makeChar({
    classes: [{ className: "Fighter", level: 3, hitDiceType: "d10", subclassName: "Champion" }],
  });
  assert.equal(getSuperiorityDice(champ3), null);
  assert.equal(battleMasterManeuverChoices(champ3, ALL_BOOKS).length, 0);

  // Wizard level 5 with no feats or styles
  const wiz = makeChar({ classes: [{ className: "Wizard", level: 5, hitDiceType: "d6" }] });
  assert.equal(getSuperiorityDice(wiz), null);
  assert.equal(battleMasterManeuverChoices(wiz, ALL_BOOKS).length, 0);
});

test("reconcile: trims choices and picks upon de-leveling or subclass change", () => {
  // Character at Battle Master 7 with picks in Maneuvers 3 and Maneuvers 7
  const bm7 = makeChar({
    classes: [{ className: "Fighter", level: 7, hitDiceType: "d10", subclassName: "Battle Master" }],
    ruleChoices: [
      {
        id: "PHB__Fighter__Battle Master__Maneuvers 3",
        trait: "Combat Superiority (3rd Level)",
        origin: "subclass",
        choose: 3,
        from: ["Trip Attack", "Riposte", "Disarming Attack"],
        picked: ["Trip Attack", "Riposte", "Disarming Attack"],
      },
      {
        id: "PHB__Fighter__Battle Master__Maneuvers 7",
        trait: "Additional Maneuvers (7th Level)",
        origin: "subclass",
        choose: 2,
        from: ["Menacing Attack", "Feinting Attack"],
        picked: ["Menacing Attack", "Feinting Attack"],
      },
    ],
  });

  // De-level to 6
  const deLeveled = reconcile({
    ...bm7,
    classes: [{ className: "Fighter", level: 6, hitDiceType: "d10", subclassName: "Battle Master" }],
  }, currentCompendium(), { activeBooks: ALL_BOOKS });

  assert.equal(deLeveled.ruleChoices?.length, 1);
  assert.equal(deLeveled.ruleChoices?.[0].id, "PHB__Fighter__Battle Master__Maneuvers 3");
  assert.deepEqual(deLeveled.ruleChoices?.[0].picked, ["Trip Attack", "Riposte", "Disarming Attack"]);

  // De-level to 2 (loses Battle Master entirely)
  const lvl2 = reconcile({
    ...bm7,
    classes: [{ className: "Fighter", level: 2, hitDiceType: "d10" }],
  }, currentCompendium(), { activeBooks: ALL_BOOKS });
  assert.equal(lvl2.ruleChoices?.length, 0);

  // Subclass teardown: changing Battle Master to Champion
  const toreDown = teardownSubclass(bm7, "Fighter", "Battle Master", undefined, ALL_BOOKS);
  assert.equal(
    toreDown.ruleChoices?.filter((rc) => isManeuverChoiceId(rc.id)).length,
    0,
    "Battle Master maneuver choices must be removed on subclass teardown"
  );
});

test("removeAsiSelection clears Martial Adept rule choices when feat is removed", () => {
  const charWithFeat = makeChar({
    classes: [{ className: "Fighter", level: 4, hitDiceType: "d10" }],
    asiSelections: [
      {
        className: "Fighter",
        classLevel: 4,
        level: 4,
        type: "feat",
        featName: "Martial Adept",
      },
    ],
    ruleChoices: [
      {
        id: "PHB__Feat__Martial Adept__Maneuvers",
        trait: "Martial Adept Maneuvers",
        origin: "class",
        choose: 2,
        from: ["Trip Attack", "Parry"],
        picked: ["Trip Attack", "Parry"],
      },
    ],
  });

  const updated = removeAsiSelection(charWithFeat, "Fighter", 4, undefined, ALL_BOOKS);
  assert.equal(updated.asiSelections?.length, 0);
  assert.equal(
    updated.ruleChoices?.filter((rc) => rc.id.includes("Martial Adept")).length,
    0,
    "Martial Adept rule choices must be pruned when feat is removed"
  );
});

test("Active books gating: PHB only excludes TCE maneuvers", () => {
  const bm = makeChar({
    classes: [{ className: "Fighter", level: 3, hitDiceType: "d10", subclassName: "Battle Master" }],
  });

  const phbOnly = battleMasterManeuverChoices(bm, ["PHB"]);
  const phbOptions = phbOnly[0].options.map((o) => o.name);
  assert.ok(phbOptions.includes("Trip Attack"));
  assert.ok(phbOptions.includes("Riposte"));
  assert.ok(!phbOptions.includes("Brace"), "Brace is TCE and must be excluded in PHB-only");
  assert.ok(!phbOptions.includes("Ambush"), "Ambush is TCE and must be excluded in PHB-only");

  const withTce = battleMasterManeuverChoices(bm, ["PHB", "TCE"]);
  const tceOptions = withTce[0].options.map((o) => o.name);
  assert.ok(tceOptions.includes("Trip Attack"));
  assert.ok(tceOptions.includes("Brace"));
  assert.ok(tceOptions.includes("Ambush"));
});

test("Saving throw maneuvers set strictly contains only maneuvers forcing a save", () => {
  const SAVING_THROW_MANEUVERS = new Set([
    "disarming attack",
    "goading attack",
    "menacing attack",
    "pushing attack",
    "sweeping attack",
    "trip attack",
  ]);

  // Maneuvers that force a saving throw
  assert.ok(SAVING_THROW_MANEUVERS.has("disarming attack"));
  assert.ok(SAVING_THROW_MANEUVERS.has("goading attack"));
  assert.ok(SAVING_THROW_MANEUVERS.has("menacing attack"));
  assert.ok(SAVING_THROW_MANEUVERS.has("pushing attack"));
  assert.ok(SAVING_THROW_MANEUVERS.has("sweeping attack"));
  assert.ok(SAVING_THROW_MANEUVERS.has("trip attack"));

  // Maneuvers that do NOT force a saving throw
  assert.ok(!SAVING_THROW_MANEUVERS.has("riposte"));
  assert.ok(!SAVING_THROW_MANEUVERS.has("parry"));
  assert.ok(!SAVING_THROW_MANEUVERS.has("brace"));
  assert.ok(!SAVING_THROW_MANEUVERS.has("feinting attack"));
  assert.ok(!SAVING_THROW_MANEUVERS.has("precision attack"));
  assert.ok(!SAVING_THROW_MANEUVERS.has("rally"));
});

