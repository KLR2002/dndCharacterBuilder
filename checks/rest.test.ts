import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import { applyShortRest, applyLongRest } from "../src/rules/rest.ts";
import type { CharacterClass, ResourceCounter } from "../src/types/character.ts";

const cl = (className: string, level: number, source = "PHB"): CharacterClass => ({
  className,
  source,
  level,
});

const counter = (
  id: string,
  name: string,
  current: number,
  max: number,
  resetOn: "short" | "long"
): ResourceCounter => ({
  id,
  name,
  current,
  max,
  resetOn,
});

test("applyShortRest resets warlock pact slots (pactSlotsUsed and usedPactSlots)", () => {
  const char = makeChar({
    classes: [cl("Warlock", 5)],
    pactSlotsUsed: 2,
    usedPactSlots: 2,
  });

  const rested = applyShortRest(char);
  assert.equal(rested.pactSlotsUsed, 0);
  assert.equal(rested.usedPactSlots, 0);
  // Original is not mutated
  assert.equal(char.pactSlotsUsed, 2);
  assert.equal(char.usedPactSlots, 2);
});

test("applyShortRest resets short-rest resource counters and preserves long-rest counters", () => {
  const char = makeChar({
    classes: [cl("Fighter", 2), cl("Barbarian", 2)],
    resourceCounters: {
      actionSurge: counter("actionSurge", "Action Surge", 0, 1, "short"),
      secondWind: counter("secondWind", "Second Wind", 0, 1, "short"),
      rage: counter("rage", "Rage", 1, 2, "long"),
    },
  });

  const rested = applyShortRest(char);
  // Short rest resources reset to max
  assert.equal(rested.resourceCounters.actionSurge.current, 1);
  assert.equal(rested.resourceCounters.secondWind.current, 1);
  // Long rest resources remain at their current count
  assert.equal(rested.resourceCounters.rage.current, 1);

  // Original character is unmodified
  assert.equal(char.resourceCounters.actionSurge.current, 0);
});

test("applyShortRest heals currentHp capped at maxHp(character)", () => {
  // Fighter 1 with 10 CON -> maxHp = 10
  const char = makeChar({
    classes: [cl("Fighter", 1)],
    currentHp: 4,
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  });

  // Partial heal
  const healedPartial = applyShortRest(char, { healedHp: 3 });
  assert.equal(healedPartial.currentHp, 7);

  // Overheal capped at maxHp (10)
  const healedOver = applyShortRest(char, { healedHp: 20 });
  assert.equal(healedOver.currentHp, 10);

  // No healedHp provided leaves HP unchanged
  const noHeal = applyShortRest(char);
  assert.equal(noHeal.currentHp, 4);
});

test("applyShortRest records spent hit dice into usedHitDice", () => {
  const char = makeChar({
    classes: [cl("Fighter", 3), cl("Rogue", 2)],
    usedHitDice: { d10: 1 },
  });

  const rested = applyShortRest(char, {
    healedHp: 12,
    spentDice: { d10: 1, d8: 2 },
  });

  assert.equal(rested.usedHitDice.d10, 2);
  assert.equal(rested.usedHitDice.d8, 2);
  // Original is unmodified
  assert.equal(char.usedHitDice.d10, 1);
  assert.equal(char.usedHitDice.d8, undefined);
});

test("applyShortRest supports positional parameters (healedHp, spentDice)", () => {
  const char = makeChar({
    classes: [cl("Fighter", 2)],
    currentHp: 5,
    usedHitDice: { d10: 0 },
  });

  const rested = applyShortRest(char, 4, { d10: 1 });
  assert.equal(rested.currentHp, 9);
  assert.equal(rested.usedHitDice.d10, 1);
});

test("applyLongRest restores currentHp to full maxHp and clears tempHp", () => {
  // Barbarian 1 with 14 CON (+2) -> maxHp = 12 + 2 = 14
  const char = makeChar({
    classes: [cl("Barbarian", 1)],
    baseAbilityScores: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    currentHp: 2,
    tempHp: 8,
  });

  const rested = applyLongRest(char);
  assert.equal(rested.currentHp, 14);
  assert.equal(rested.tempHp, 0);
  assert.equal(char.currentHp, 2);
  assert.equal(char.tempHp, 8);
});

test("applyLongRest resets spell slots, pact slots, sorcery points, and death saves", () => {
  const char = makeChar({
    classes: [cl("Sorcerer", 3), cl("Warlock", 2)],
    usedSpellSlots: { 1: 3, 2: 1 },
    pactSlotsUsed: 2,
    usedPactSlots: 2,
    sorceryPointsUsed: 3,
    deathSaves: { successes: 2, failures: 1 },
  });

  const rested = applyLongRest(char);
  assert.deepEqual(rested.usedSpellSlots, {});
  assert.equal(rested.pactSlotsUsed, 0);
  assert.equal(rested.usedPactSlots, 0);
  assert.equal(rested.sorceryPointsUsed, 0);
  assert.deepEqual(rested.deathSaves, { successes: 0, failures: 0 });
});

test("applyLongRest resets all resource counters (short and long reset)", () => {
  const char = makeChar({
    classes: [cl("Paladin", 3), cl("Fighter", 2)],
    resourceCounters: {
      actionSurge: counter("actionSurge", "Action Surge", 0, 1, "short"),
      channelDivinity: counter("channelDivinity", "Channel Divinity", 0, 1, "short"),
      layOnHands: counter("layOnHands", "Lay on Hands", 5, 15, "long"),
    },
  });

  const rested = applyLongRest(char);
  assert.equal(rested.resourceCounters.actionSurge.current, 1);
  assert.equal(rested.resourceCounters.channelDivinity.current, 1);
  assert.equal(rested.resourceCounters.layOnHands.current, 15);
});

test("applyLongRest recovers at most floor(totalLevel / 2) hit dice (min 1) automatically", () => {
  // Level 1 character: floor(1/2) = 0 -> minimum 1 hit die recovered
  const lvl1Char = makeChar({
    classes: [cl("Wizard", 1)],
    usedHitDice: { d6: 1 },
  });
  const restedLvl1 = applyLongRest(lvl1Char);
  assert.equal(restedLvl1.usedHitDice.d6, 0);

  // Level 5 character: floor(5/2) = 2 hit dice recovered
  const lvl5Char = makeChar({
    classes: [cl("Fighter", 5)],
    usedHitDice: { d10: 4 },
  });
  const restedLvl5 = applyLongRest(lvl5Char);
  assert.equal(restedLvl5.usedHitDice.d10, 2);

  // Multiclass Level 6 character (floor(6/2) = 3): automatic recovery prioritizes larger dice
  const multiChar = makeChar({
    classes: [cl("Fighter", 4), cl("Wizard", 2)],
    usedHitDice: { d10: 2, d6: 2 },
  });
  const restedMulti = applyLongRest(multiChar);
  // Regains 2 d10 (largest die) and 1 d6
  assert.equal(restedMulti.usedHitDice.d10, 0);
  assert.equal(restedMulti.usedHitDice.d6, 1);
});

test("applyLongRest respects optional diceToRecover within limit", () => {
  // Level 6 character: can recover up to 3 dice
  const char = makeChar({
    classes: [cl("Fighter", 3), cl("Rogue", 3)],
    usedHitDice: { d10: 3, d8: 3 },
  });

  // Specifically recover 1 d10 and 2 d8 (total 3)
  const restedSpecific = applyLongRest(char, { d10: 1, d8: 2 });
  assert.equal(restedSpecific.usedHitDice.d10, 2);
  assert.equal(restedSpecific.usedHitDice.d8, 1);

  // Attempting to recover more than allowed (4 requested, limit 3) caps at 3
  const restedOver = applyLongRest(char, { d10: 4 });
  assert.equal(restedOver.usedHitDice.d10, 0); // 3 recovered, 0 remaining
  assert.equal(restedOver.usedHitDice.d8, 3); // untouched
});

test("applyLongRest decrements Exhaustion conditions and preserves other conditions", () => {
  // Exhaustion 2 -> Exhaustion 1, preserving other conditions
  const c1 = makeChar({
    conditions: ["Poisoned", "Exhaustion 2", "Blinded"],
  });
  const r1 = applyLongRest(c1);
  assert.deepEqual(r1.conditions, ["Poisoned", "Exhaustion 1", "Blinded"]);

  // Exhaustion 1 -> removed
  const c2 = makeChar({
    conditions: ["Poisoned", "Exhaustion 1", "Paralyzed"],
  });
  const r2 = applyLongRest(c2);
  assert.deepEqual(r2.conditions, ["Poisoned", "Paralyzed"]);

  // Bare "Exhaustion" -> removed
  const c3 = makeChar({
    conditions: ["Exhaustion", "Frightened"],
  });
  const r3 = applyLongRest(c3);
  assert.deepEqual(r3.conditions, ["Frightened"]);

  // Exhaustion 3 -> Exhaustion 2
  const c4 = makeChar({
    conditions: ["Exhaustion 3"],
  });
  const r4 = applyLongRest(c4);
  assert.deepEqual(r4.conditions, ["Exhaustion 2"]);

  // No exhaustion present leaves conditions untouched
  const c5 = makeChar({
    conditions: ["Stunned", "Prone"],
  });
  const r5 = applyLongRest(c5);
  assert.deepEqual(r5.conditions, ["Stunned", "Prone"]);
});

test("applyLongRest resets activeWildShape to null", () => {
  const char = makeChar({
    classes: [cl("Druid", 4)],
    activeWildShape: {
      name: "Brown Bear",
      source: "MM",
      currentHp: 20,
      maxHp: 34,
      ac: 11,
    },
    resourceCounters: {
      wild_shape: counter("wild_shape", "Wild Shape", 0, 2, "short"),
    },
  });

  const rested = applyLongRest(char);
  assert.equal(rested.activeWildShape, null);
  assert.equal(rested.resourceCounters.wild_shape.current, 2);
});
