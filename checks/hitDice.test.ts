import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import {
  getHitDicePools,
  spendHitDie,
  recoverHitDie,
  recoverHitDiceLongRest,
} from "../src/rules/hitDice.ts";

const cl = (className: string, level: number) => ({ className, source: "PHB", level });
const scores = (overrides: Record<string, number>) => ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...overrides });

test("getHitDicePools pools multiclass Barbarian 1 / Bard 1 into d12 and d8", () => {
  const char = makeChar({
    classes: [cl("Barbarian", 1), cl("Bard", 1)],
    usedHitDice: { d12: 0, d8: 1 },
  });
  const pools = getHitDicePools(char);
  assert.deepEqual(pools, {
    d12: { total: 1, used: 0, remaining: 1 },
    d8: { total: 1, used: 1, remaining: 0 },
  });
});

test("spendHitDie rolls die + CON modifier and heals HP capped at maxHp", () => {
  const char = makeChar({
    classes: [cl("Barbarian", 1)],
    baseAbilityScores: scores({ con: 14 }), // +2 CON mod
    currentHp: 5,
    maxHpOverride: 14,
  });

  const res = spendHitDie(char, "d12", { roll: 6 });
  // healed: 6 (roll) + 2 (con) = 8. currentHp: 5 + 8 = 13 (within 14).
  assert.equal(res.healed, 8);
  assert.equal(res.character.currentHp, 13);
  assert.equal(res.character.usedHitDice.d12, 1);
});

test("spendHitDie enforces 2014 minimum 0 HP healing with negative CON modifier", () => {
  const char = makeChar({
    classes: [cl("Wizard", 1)],
    baseAbilityScores: scores({ con: 6 }), // -2 CON mod
    currentHp: 4,
    maxHpOverride: 6,
  });

  // Roll 1 + (-2) = -1, PHB 2014 minimum healing is 0. HP remains 4, but die is spent.
  const res = spendHitDie(char, "d6", { roll: 1 });
  assert.equal(res.healed, 0);
  assert.equal(res.character.currentHp, 4);
  assert.equal(res.character.usedHitDice.d6, 1);
});

test("spendHitDie clamps healed HP to maxHp and reports actual HP gained", () => {
  const char = makeChar({
    classes: [cl("Barbarian", 1)],
    baseAbilityScores: scores({ con: 14 }), // +2 CON mod
    currentHp: 13,
    maxHpOverride: 14,
  });

  // Roll 6 + 2 = 8, but max is 14 so only 1 HP is actually gained
  const res = spendHitDie(char, "d12", { roll: 6 });
  assert.equal(res.healed, 1);
  assert.equal(res.character.currentHp, 14);
  assert.equal(res.character.usedHitDice.d12, 1);
});

test("spendHitDie does not spend die when character is already at maxHp", () => {
  const char = makeChar({
    classes: [cl("Barbarian", 1)],
    currentHp: 14,
    maxHpOverride: 14,
  });

  const res = spendHitDie(char, "d12", { roll: 6 });
  assert.equal(res.healed, 0);
  assert.equal(res.character.currentHp, 14);
  assert.equal(res.character.usedHitDice?.d12 ?? 0, 0);
});

test("spendHitDie rejects invalid die tokens", () => {
  const char = makeChar({
    classes: [cl("Barbarian", 1)],
    currentHp: 5,
    maxHpOverride: 14,
  });

  const res = spendHitDie(char, "Barbarian", { roll: 6 });
  assert.equal(res.healed, 0);
  assert.equal(res.character.currentHp, 5);
  assert.equal(res.character.usedHitDice?.Barbarian, undefined);
});

test("spendHitDie does not allow spending when no dice remaining", () => {
  const char = makeChar({
    classes: [cl("Fighter", 1)],
    usedHitDice: { d10: 1 },
    currentHp: 5,
    maxHpOverride: 12,
  });

  const res = spendHitDie(char, "d10", { roll: 8 });
  assert.equal(res.healed, 0);
  assert.equal(res.character.currentHp, 5);
  assert.equal(res.character.usedHitDice.d10, 1);
});

test("recoverHitDie decrements used dice for specific die token", () => {
  const char = makeChar({
    classes: [cl("Barbarian", 1), cl("Bard", 1)],
    usedHitDice: { d12: 1, d8: 1 },
  });

  const recoveredD12 = recoverHitDie(char, "d12");
  assert.equal(recoveredD12.usedHitDice.d12, 0);
  assert.equal(recoveredD12.usedHitDice.d8, 1);

  const recoveredD8 = recoverHitDie(recoveredD12, "d8");
  assert.equal(recoveredD8.usedHitDice.d8, 0);
});

test("recoverHitDiceLongRest recovers up to floor(totalLevel / 2) largest dice first", () => {
  const char = makeChar({
    classes: [cl("Barbarian", 2), cl("Bard", 2)], // Total level 4 -> recovers 2 dice
    usedHitDice: { d12: 2, d8: 2 },
  });

  const rested = recoverHitDiceLongRest(char);
  // Recovers 2 dice, priority is largest: recovers 2 of d12, d8 remains at 2 used
  assert.equal(rested.usedHitDice.d12, 0);
  assert.equal(rested.usedHitDice.d8, 2);
});
