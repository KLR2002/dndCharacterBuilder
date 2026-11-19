import { test } from "node:test";
import assert from "node:assert/strict";
import { integratedTestCompendium, makeChar } from "./testUtils.ts";
import {
  artificerInfusionChoices,
  battleMasterManeuverChoices,
  fightingStyleRuleChoices,
  warlockInvocationChoices,
  warlockPactBoonChoices,
} from "../src/rules/ruleChoices.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";

const BOOKS = ["PHB", "XGE", "TCE"];
const compendium = integratedTestCompendium();

const warlock = (level: number) => makeChar({ classes: [{ className: "Warlock", source: "PHB", level }] });
const fighter = (level: number, subclassName?: string) =>
  makeChar({ classes: [{ className: "Fighter", source: "PHB", level, subclassName }] });
const artificer = (level: number) => makeChar({ classes: [{ className: "Artificer", source: "PHB", level }] });

const offeredNames = (choices: AvailableRuleChoice[]) => choices.flatMap((c) => c.options.map((o) => o.name));

test("characterization: Pact Boon offers the PHB boons and the TCE boon with books PHB, XGE, TCE", () => {
  const [choice] = warlockPactBoonChoices(warlock(3), BOOKS, compendium);
  assert.deepEqual(offeredNames([choice]), [
    "Pact of the Blade",
    "Pact of the Chain",
    "Pact of the Talisman",
    "Pact of the Tome",
  ]);
});

test("characterization: Eldritch Invocations at level 2 offer the prerequisite-eligible PHB, XGE and TCE invocations", () => {
  const [choice] = warlockInvocationChoices(warlock(2), BOOKS, compendium);
  assert.equal(choice.id, "PHB__Warlock__Invocations 2");
  assert.deepEqual(offeredNames([choice]), [
    "Armor of Shadows",
    "Beast Speech",
    "Beguiling Influence",
    "Devil's Sight",
    "Eldritch Mind",
    "Eldritch Sight",
    "Eyes of the Rune Keeper",
    "Fiendish Vigor",
    "Gaze of Two Minds",
    "Mask of Many Faces",
    "Misty Visions",
    "Thief of Five Fates",
  ]);
});

test("characterization: Fighter's Fighting Style offers the PHB, XGE and TCE styles", () => {
  const [choice] = fightingStyleRuleChoices(fighter(1), BOOKS, compendium);
  assert.equal(choice.id, "PHB__Fighter__Fighting Style");
  assert.deepEqual(offeredNames([choice]), [
    "Archery",
    "Blind Fighting",
    "Defense",
    "Dueling",
    "Great Weapon Fighting",
    "Interception",
    "Protection",
    "Superior Technique",
    "Thrown Weapon Fighting",
    "Two-Weapon Fighting",
    "Unarmed Fighting",
  ]);
});

test("characterization: Battle Master maneuvers offer the same list at level 3 and level 7", () => {
  const expected = [
    "Ambush",
    "Bait and Switch",
    "Brace",
    "Commander's Strike",
    "Commanding Presence",
    "Disarming Attack",
    "Distracting Strike",
    "Evasive Footwork",
    "Feinting Attack",
    "Goading Attack",
    "Grappling Strike",
    "Lunging Attack",
    "Maneuvering Attack",
    "Menacing Attack",
    "Parry",
    "Precision Attack",
    "Pushing Attack",
    "Quick Toss",
    "Rally",
    "Riposte",
    "Sweeping Attack",
    "Tactical Assessment",
    "Trip Attack",
  ];
  const level3 = battleMasterManeuverChoices(fighter(3, "Battle Master"), BOOKS, compendium);
  assert.equal(level3[0].id, "PHB__Fighter__Battle Master__Maneuvers 3");
  assert.deepEqual(offeredNames([level3[0]]), expected);

  const level7 = battleMasterManeuverChoices(fighter(7, "Battle Master"), BOOKS, compendium);
  assert.deepEqual(offeredNames([level7[0]]), expected);
});

test("characterization: Artificer infusions at level 6 offer the TCE infusions with books PHB, XGE, TCE", () => {
  const choices = artificerInfusionChoices(artificer(6), BOOKS, compendium);
  const [level2] = choices.filter((c) => c.id === "TCE__Artificer__Infusions 2");
  assert.deepEqual(offeredNames([level2]), [
    "Armor of Magical Strength",
    "Boots of the Winding Path",
    "Enhanced Arcane Focus",
    "Enhanced Defense",
    "Enhanced Weapon",
    "Homunculus Servant",
    "Mind Sharpener",
    "Radiant Weapon",
    "Repeating Shot",
    "Replicate Magic Item",
    "Repulsion Shield",
    "Resistant Armor",
    "Returning Weapon",
    "Spell-Refueling Ring",
  ]);
});
