import { test } from "node:test";
import assert from "node:assert/strict";
import { damage, heal, setCurrentHp, fullHealAtLevelUp, followRaisedMaxHp, parseAmount } from "../src/rules/hitPoints.ts";

test("damage: temp HP absorbs part of the hit and current HP is untouched", () => {
  assert.deepEqual(damage({ currentHp: 10, tempHp: 5 }, 3), { currentHp: 10, tempHp: 2, deathSaves: { successes: 0, failures: 0 } });
});

test("damage: temp HP absorbs the whole hit when it is large enough", () => {
  assert.deepEqual(damage({ currentHp: 10, tempHp: 5 }, 5), { currentHp: 10, tempHp: 0, deathSaves: { successes: 0, failures: 0 } });
});

test("damage: overflow past temp HP comes off current HP", () => {
  assert.deepEqual(damage({ currentHp: 10, tempHp: 4 }, 7), { currentHp: 7, tempHp: 0, deathSaves: { successes: 0, failures: 0 } });
});

test("damage: current HP floors at 0", () => {
  assert.deepEqual(damage({ currentHp: 3, tempHp: 0 }, 50), { currentHp: 0, tempHp: 0 });
});

test("damage: amount 0 changes nothing", () => {
  assert.deepEqual(damage({ currentHp: 6, tempHp: 2 }, 0), { currentHp: 6, tempHp: 2, deathSaves: { successes: 0, failures: 0 } });
});

test("damage: reducing current HP to exactly 0 does not reset death saves", () => {
  assert.deepEqual(damage({ currentHp: 3, tempHp: 0 }, 3), { currentHp: 0, tempHp: 0 });
});

test("heal: adds to current HP and leaves temp HP alone", () => {
  assert.deepEqual(heal({ currentHp: 4, tempHp: 3 }, 5, 20), { currentHp: 9, tempHp: 3, deathSaves: { successes: 0, failures: 0 } });
});

test("heal: caps current HP at max HP", () => {
  assert.deepEqual(heal({ currentHp: 18, tempHp: 0 }, 10, 20), { currentHp: 20, tempHp: 0, deathSaves: { successes: 0, failures: 0 } });
});

test("heal: from 0 HP resets death saves", () => {
  assert.deepEqual(heal({ currentHp: 0, tempHp: 0 }, 4, 12), { currentHp: 4, tempHp: 0, deathSaves: { successes: 0, failures: 0 } });
});

test("heal: a heal of 0 from 0 HP stays at 0 and keeps death saves", () => {
  assert.deepEqual(heal({ currentHp: 0, tempHp: 0 }, 0, 12), { currentHp: 0, tempHp: 0 });
});

test("setCurrentHp: sets the total and keeps temp HP", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 4 }, 7, 20), { currentHp: 7, tempHp: 4, deathSaves: { successes: 0, failures: 0 } });
});

test("setCurrentHp: a total above max HP clamps to max HP", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 0 }, 99, 20), { currentHp: 20, tempHp: 0, deathSaves: { successes: 0, failures: 0 } });
});

test("setCurrentHp: a total of 0 sets current HP to 0 and keeps death saves", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 2 }, 0, 20), { currentHp: 0, tempHp: 2 });
});

test("setCurrentHp: a negative total clamps to 0 and keeps death saves", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 0 }, -5, 20), { currentHp: 0, tempHp: 0 });
});

test("setCurrentHp: a fractional total rounds down", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 0 }, 7.9, 20), { currentHp: 7, tempHp: 0, deathSaves: { successes: 0, failures: 0 } });
});

test("setCurrentHp: setting 5 from 0 HP resets death saves", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 0, tempHp: 0 }, 5, 20), { currentHp: 5, tempHp: 0, deathSaves: { successes: 0, failures: 0 } });
});

test("setCurrentHp: NaN leaves HP unchanged and resets death saves when HP is above 0", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 3 }, Number.NaN, 20), { currentHp: 10, tempHp: 3, deathSaves: { successes: 0, failures: 0 } });
});

test("setCurrentHp: NaN at 0 HP leaves HP at 0 and keeps death saves", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 0, tempHp: 0 }, Number.NaN, 20), { currentHp: 0, tempHp: 0 });
});

test("setCurrentHp: non-finite input leaves HP unchanged", () => {
  const state = { currentHp: 10, tempHp: 3 };
  assert.deepEqual(setCurrentHp(state, Number.POSITIVE_INFINITY, 20), { currentHp: 10, tempHp: 3, deathSaves: { successes: 0, failures: 0 } });
  assert.deepEqual(setCurrentHp(state, Number.NEGATIVE_INFINITY, 20), { currentHp: 10, tempHp: 3, deathSaves: { successes: 0, failures: 0 } });
});

test("parseAmount: accepts a non-negative integer string", () => {
  assert.equal(parseAmount("12"), 12);
  assert.equal(parseAmount("0"), 0);
});

test("fullHealAtLevelUp: sets current HP to the new max and keeps temp HP", () => {
  assert.deepEqual(fullHealAtLevelUp({ currentHp: 5, tempHp: 3 }, 12), { currentHp: 12, tempHp: 3, deathSaves: { successes: 0, failures: 0 } });
});

test("fullHealAtLevelUp: from 0 HP fills to the new max and clears death saves", () => {
  assert.deepEqual(fullHealAtLevelUp({ currentHp: 0, tempHp: 0 }, 20), { currentHp: 20, tempHp: 0, deathSaves: { successes: 0, failures: 0 } });
});

test("fullHealAtLevelUp: takes the max as given, so a max raised by Constitution or a feat fills to that higher total", () => {
  assert.deepEqual(fullHealAtLevelUp({ currentHp: 10, tempHp: 0 }, 22), { currentHp: 22, tempHp: 0, deathSaves: { successes: 0, failures: 0 } });
});

test("followRaisedMaxHp: a Constitution raise at full HP lifts current HP with the max and keeps temp HP", () => {
  assert.deepEqual(followRaisedMaxHp({ currentHp: 12, tempHp: 3 }, 12, 14), { currentHp: 14, tempHp: 3 });
});

test("followRaisedMaxHp: a Tough-style feat at full HP lifts current HP with the max", () => {
  assert.deepEqual(followRaisedMaxHp({ currentHp: 20, tempHp: 0 }, 20, 22), { currentHp: 22, tempHp: 0 });
});

test("followRaisedMaxHp: below full HP, current HP is left where it is when the max rises", () => {
  assert.deepEqual(followRaisedMaxHp({ currentHp: 9, tempHp: 0 }, 12, 14), { currentHp: 9, tempHp: 0 });
});

test("followRaisedMaxHp: no raise leaves current HP alone", () => {
  assert.deepEqual(followRaisedMaxHp({ currentHp: 12, tempHp: 0 }, 12, 12), { currentHp: 12, tempHp: 0 });
});

test("parseAmount: trims surrounding whitespace", () => {
  assert.equal(parseAmount("  7 "), 7);
});

test("parseAmount: rejects negative, fractional, empty and garbage input", () => {
  assert.equal(parseAmount("-3"), undefined);
  assert.equal(parseAmount("2.5"), undefined);
  assert.equal(parseAmount(""), undefined);
  assert.equal(parseAmount("   "), undefined);
  assert.equal(parseAmount("abc"), undefined);
  assert.equal(parseAmount("4x"), undefined);
});
