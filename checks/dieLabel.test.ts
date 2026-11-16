import { test } from "node:test";
import assert from "node:assert/strict";
import { dieLabel } from "../src/components/dice/dieLabel.ts";

test("a die is named by its sides and the face it shows", () => {
  assert.equal(dieLabel(20, 14, false), "d20 showing 14");
  assert.equal(dieLabel(6, 3, false), "d6 showing 3");
});

test("a d100 is named d100 with its whole face", () => {
  assert.equal(dieLabel(100, 40, false), "d100 showing 40");
});

test("a dropped die says so after its face", () => {
  assert.equal(dieLabel(20, 3, true), "d20 showing 3, dropped");
  assert.equal(dieLabel(100, 40, true), "d100 showing 40, dropped");
});
