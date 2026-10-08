import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { getTacticalActionLedger } from "../src/rules/tacticalActions.ts";

test("getTacticalActionLedger derives Fighter 1 combat actions including Second Wind", () => {
  const char = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
  });
  const evaluated = evaluateCharacter(char);
  const ledger = getTacticalActionLedger(char, evaluated);

  assert.equal(ledger.extraAttackCount, 1);
  assert.equal(ledger.standardActions.length, 10);

  const secondWind = ledger.bonusActions.find((b) => b.name === "Second Wind");
  assert.ok(secondWind);
  assert.equal(secondWind.source, "Fighter 1");

  const oppAttack = ledger.reactions.find((r) => r.name === "Opportunity Attack");
  assert.ok(oppAttack);
});

test("getTacticalActionLedger derives Rogue 5 combat actions including Cunning Action, Uncanny Dodge, and Sneak Attack", () => {
  const char = makeChar({
    classes: [{ className: "Rogue", source: "PHB", level: 5 }],
  });
  const evaluated = evaluateCharacter(char);
  const ledger = getTacticalActionLedger(char, evaluated);

  assert.equal(ledger.sneakAttackDice, "3d6");

  const cunning = ledger.bonusActions.find((b) => b.name === "Cunning Action");
  assert.ok(cunning);

  const uncanny = ledger.reactions.find((r) => r.name === "Uncanny Dodge");
  assert.ok(uncanny);
});

test("getTacticalActionLedger derives Monk 3 Ki actions and Deflect Missiles", () => {
  const char = makeChar({
    classes: [{ className: "Monk", source: "PHB", level: 3 }],
  });
  const evaluated = evaluateCharacter(char);
  const ledger = getTacticalActionLedger(char, evaluated);

  const martialArts = ledger.bonusActions.find((b) => b.name.includes("Martial Arts Strike"));
  assert.ok(martialArts);

  const flurry = ledger.bonusActions.find((b) => b.name.includes("Flurry of Blows"));
  assert.ok(flurry);

  const patient = ledger.bonusActions.find((b) => b.name.includes("Patient Defense"));
  assert.ok(patient);

  const step = ledger.bonusActions.find((b) => b.name.includes("Step of the Wind"));
  assert.ok(step);

  const deflect = ledger.reactions.find((r) => r.name === "Deflect Missiles");
  assert.ok(deflect);
});

test("getTacticalActionLedger categorizes Battle Master maneuvers into tactical slots", () => {
  const char = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 3, subclassName: "Battle Master" }],
    ruleChoices: [
      {
        id: "PHB__Fighter__Battle Master__Maneuvers 3",
        trait: "Combat Superiority",
        picked: ["Riposte", "Rally", "Trip Attack"],
        choose: 3,
        options: [],
        origin: "class",
      },
    ],
  });
  const evaluated = evaluateCharacter(char);
  const ledger = getTacticalActionLedger(char, evaluated);

  assert.equal(ledger.maneuvers.length, 3);

  const riposte = ledger.maneuvers.find((m) => m.name === "Riposte");
  assert.ok(riposte);
  assert.equal(riposte.category, "Reaction");

  const rally = ledger.maneuvers.find((m) => m.name === "Rally");
  assert.ok(rally);
  assert.equal(rally.category, "Bonus Action");

  const trip = ledger.maneuvers.find((m) => m.name === "Trip Attack");
  assert.ok(trip);
  assert.equal(trip.category, "Attack Rider");
  assert.ok(trip.dc !== undefined); // Trip attack forces a save, must include DC

  // Check that Riposte was added to reactions and Rally was added to bonusActions
  assert.ok(ledger.reactions.some((r) => r.name.includes("Riposte")));
  assert.ok(ledger.bonusActions.some((b) => b.name.includes("Rally")));
});

test("getTacticalActionLedger detects dual wielding off-hand attack in bonus actions", () => {
  const char = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    items: [
      { id: "w1", name: "Shortsword", source: "PHB", isEquipped: true, section: "equipped", quantity: 1 },
      { id: "w2", name: "Scimitar", source: "PHB", isEquipped: true, section: "equipped", quantity: 1 },
    ],
  });
  const evaluated = evaluateCharacter(char);
  const ledger = getTacticalActionLedger(char, evaluated);

  assert.equal(ledger.dualWield.isDualWielding, true);
  const offHand = ledger.bonusActions.find((b) => b.name.includes("Off-Hand Attack"));
  assert.ok(offHand);
});
