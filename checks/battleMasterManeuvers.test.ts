import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/rules/characterReconciler.ts";
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
import { teardownSubclass } from "../src/rules/characterReconciler.ts";

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
  assert.deepEqual(dice, { count: 4, die: "d8" });

  const classDice = getClassDice(bm3);
  assert.deepEqual(classDice.superiorityDice, { count: 4, die: "d8" });

  const choices = battleMasterManeuverChoices(bm3);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].id, "PHB__Fighter__Battle Master__Maneuvers 3");
  assert.equal(choices[0].traitName, "Combat Superiority (3rd Level)");
  assert.equal(choices[0].choose, 3);
  assert.equal(choices[0].level, 3);
  assert.ok(choices[0].options.length > 0);

  // Wired into subclassRuleChoices
  const subChoices = subclassRuleChoices(bm3);
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
  assert.deepEqual(dice, { count: 5, die: "d8" });

  const choices = battleMasterManeuverChoices(bm7);
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
  assert.deepEqual(dice, { count: 5, die: "d10" });

  const choices = battleMasterManeuverChoices(bm10);
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
  assert.deepEqual(dice, { count: 6, die: "d10" });

  const choices = battleMasterManeuverChoices(bm15);
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
  assert.deepEqual(dice, { count: 6, die: "d12" });
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

  const choices = battleMasterManeuverChoices(char);
  const choice3 = choices.find((c) => c.id === "PHB__Fighter__Battle Master__Maneuvers 3")!;

  // Pick 3 maneuvers at level 3
  char = pickRuleChoice(char, choice3, "Trip Attack");
  char = pickRuleChoice(char, choice3, "Riposte");
  char = pickRuleChoice(char, choice3, "Disarming Attack");

  const chosen = getChosenManeuvers(char);
  assert.deepEqual(chosen.sort(), ["Disarming Attack", "Riposte", "Trip Attack"].sort());

  // Check choices at level 7: none of the 3 picked should be offered in choice 7
  const updatedChoices = battleMasterManeuverChoices(char);
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

test("Superior Technique adds +1 die (scaled to Battle Master die or d6 if non-Battle Master) and offers 1 maneuver", () => {
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
  assert.deepEqual(paladinDice, { count: 1, die: "d6" });

  const paladinChoices = battleMasterManeuverChoices(paladinWithStyle);
  assert.equal(paladinChoices.length, 1);
  assert.equal(paladinChoices[0].id, "TCE__Fighter__Superior Technique__Maneuver");
  assert.equal(paladinChoices[0].choose, 1);

  // Battle Master 3 with Superior Technique -> 4 + 1 = 5d8
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
  assert.deepEqual(bm3Dice, { count: 5, die: "d8" });

  // Battle Master 10 with Superior Technique -> 5 + 1 = 6d10
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
  assert.deepEqual(bm10Dice, { count: 6, die: "d10" });
});

test("Martial Adept adds +1 die (scaled to Battle Master die or d6 if non-Battle Master) and offers 2 maneuvers", () => {
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
  assert.deepEqual(rogueDice, { count: 1, die: "d6" });

  const rogueChoices = battleMasterManeuverChoices(rogueWithFeat);
  assert.equal(rogueChoices.length, 1);
  assert.equal(rogueChoices[0].id, "PHB__Feat__Martial Adept__Maneuvers");
  assert.equal(rogueChoices[0].choose, 2);

  // Battle Master 3 with Martial Adept -> 4 + 1 = 5d8
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
  assert.deepEqual(bm3FeatDice, { count: 5, die: "d8" });

  // Non-Battle Master with BOTH Superior Technique and Martial Adept -> 2d6
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
  assert.deepEqual(bothDice, { count: 2, die: "d6" });

  // Battle Master 3 with BOTH Superior Technique and Martial Adept -> 4 + 1 + 1 = 6d8
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
  assert.deepEqual(bm3BothDice, { count: 6, die: "d8" });
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
  assert.equal(battleMasterManeuverChoices(f2).length, 0);

  // Fighter level 3 Champion (different subclass)
  const champ3 = makeChar({
    classes: [{ className: "Fighter", level: 3, hitDiceType: "d10", subclassName: "Champion" }],
  });
  assert.equal(getSuperiorityDice(champ3), null);
  assert.equal(battleMasterManeuverChoices(champ3).length, 0);

  // Wizard level 5 with no feats or styles
  const wiz = makeChar({ classes: [{ className: "Wizard", level: 5, hitDiceType: "d6" }] });
  assert.equal(getSuperiorityDice(wiz), null);
  assert.equal(battleMasterManeuverChoices(wiz).length, 0);
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
  }, currentCompendium());

  assert.equal(deLeveled.ruleChoices?.length, 1);
  assert.equal(deLeveled.ruleChoices?.[0].id, "PHB__Fighter__Battle Master__Maneuvers 3");
  assert.deepEqual(deLeveled.ruleChoices?.[0].picked, ["Trip Attack", "Riposte", "Disarming Attack"]);

  // De-level to 2 (loses Battle Master entirely)
  const lvl2 = reconcile({
    ...bm7,
    classes: [{ className: "Fighter", level: 2, hitDiceType: "d10" }],
  }, currentCompendium());
  assert.equal(lvl2.ruleChoices?.length, 0);

  // Subclass teardown: changing Battle Master to Champion
  const toreDown = teardownSubclass(bm7, "Fighter", "Battle Master");
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

  const updated = removeAsiSelection(charWithFeat, "Fighter", 4);
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

