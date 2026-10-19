import { test } from "node:test";
import assert from "node:assert/strict";
import { damage, heal, setCurrentHp, parseAmount } from "../src/rules/hitPoints.ts";

test("damage: temp HP absorbs part of the hit and current HP is untouched", () => {
  assert.deepEqual(damage({ currentHp: 10, tempHp: 5 }, 3), { currentHp: 10, tempHp: 2 });
});

test("damage: temp HP absorbs the whole hit when it is large enough", () => {
  assert.deepEqual(damage({ currentHp: 10, tempHp: 5 }, 5), { currentHp: 10, tempHp: 0 });
});

test("damage: overflow past temp HP comes off current HP", () => {
  assert.deepEqual(damage({ currentHp: 10, tempHp: 4 }, 7), { currentHp: 7, tempHp: 0 });
});

test("damage: current HP floors at 0", () => {
  assert.deepEqual(damage({ currentHp: 3, tempHp: 0 }, 50), { currentHp: 0, tempHp: 0 });
});

test("damage: amount 0 changes nothing", () => {
  assert.deepEqual(damage({ currentHp: 6, tempHp: 2 }, 0), { currentHp: 6, tempHp: 2 });
});

test("heal: adds to current HP and leaves temp HP alone", () => {
  assert.deepEqual(heal({ currentHp: 4, tempHp: 3 }, 5, 20), { currentHp: 9, tempHp: 3 });
});

test("heal: caps current HP at max HP", () => {
  assert.deepEqual(heal({ currentHp: 18, tempHp: 0 }, 10, 20), { currentHp: 20, tempHp: 0 });
});

test("heal: from 0 HP", () => {
  assert.deepEqual(heal({ currentHp: 0, tempHp: 0 }, 4, 12), { currentHp: 4, tempHp: 0 });
});

test("setCurrentHp: sets the total and keeps temp HP", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 4 }, 7, 20), { currentHp: 7, tempHp: 4 });
});

test("setCurrentHp: a total above max HP clamps to max HP", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 0 }, 99, 20), { currentHp: 20, tempHp: 0 });
});

test("setCurrentHp: a total of 0 sets current HP to 0", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 2 }, 0, 20), { currentHp: 0, tempHp: 2 });
});

test("setCurrentHp: a negative total clamps to 0", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 0 }, -5, 20), { currentHp: 0, tempHp: 0 });
});

test("setCurrentHp: a fractional total rounds down", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 0 }, 7.9, 20), { currentHp: 7, tempHp: 0 });
});

test("setCurrentHp: NaN leaves HP unchanged", () => {
  assert.deepEqual(setCurrentHp({ currentHp: 10, tempHp: 3 }, Number.NaN, 20), { currentHp: 10, tempHp: 3 });
});

test("setCurrentHp: non-finite input leaves HP unchanged", () => {
  const state = { currentHp: 10, tempHp: 3 };
  assert.deepEqual(setCurrentHp(state, Number.POSITIVE_INFINITY, 20), { currentHp: 10, tempHp: 3 });
  assert.deepEqual(setCurrentHp(state, Number.NEGATIVE_INFINITY, 20), { currentHp: 10, tempHp: 3 });
});

test("parseAmount: accepts a non-negative integer string", () => {
  assert.equal(parseAmount("12"), 12);
  assert.equal(parseAmount("0"), 0);
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
