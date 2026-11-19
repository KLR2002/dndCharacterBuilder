import test from "node:test";
import assert from "node:assert/strict";
import { POINT_BUY_BUDGET, canSetPointBuyScore, pointBuySpent, pointBuyValid } from "../src/rules/pointBuy.ts";

const allEights = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
const threeFifteens = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 };

test("all 8s spend nothing and fit the budget", () => {
  assert.equal(pointBuySpent(allEights), 0);
  assert.equal(pointBuyValid(allEights), true);
});

test("15/15/15/8/8/8 spends the whole budget, and raising an 8 to 9 is refused", () => {
  assert.equal(POINT_BUY_BUDGET, 27);
  assert.equal(pointBuySpent(threeFifteens), 27);
  assert.equal(pointBuyValid(threeFifteens), true);
  assert.equal(canSetPointBuyScore(threeFifteens, "int", 9), false);
});

test("a score of 16 is refused", () => {
  assert.equal(canSetPointBuyScore(allEights, "str", 16), false);
  assert.equal(pointBuyValid({ ...allEights, str: 16 }), false);
});

test("lowering is allowed down to 8", () => {
  let scores: Record<string, number> = { ...threeFifteens };
  for (let next = 14; next >= 8; next--) {
    assert.equal(canSetPointBuyScore(scores, "str", next), true, `str lowered to ${next}`);
    scores = { ...scores, str: next };
  }
  assert.equal(canSetPointBuyScore(threeFifteens, "int", 7), false);
});

test("a set that spends more than the budget is not valid", () => {
  assert.equal(pointBuyValid({ str: 15, dex: 15, con: 15, int: 15, wis: 8, cha: 8 }), false);
});
