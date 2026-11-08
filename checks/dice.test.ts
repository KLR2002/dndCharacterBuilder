import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDicePool, rollDicePool, type RandomSource } from "../src/rules/dice.ts";

/** A random source with fixed faces, cycling: the die with `sides` lands on the next queued face. */
function fixedFaces(faces: number[]): RandomSource {
  let index = 0;
  return (sides) => {
    const face = faces[index++ % faces.length];
    return Math.min(sides, Math.max(1, face));
  };
}

test("a Roll totals a dice pool and a flat modifier", () => {
  const roll = rollDicePool("2d6+1d8+3", fixedFaces([4, 6, 7]));
  assert.deepEqual(roll.dice.map((die) => die.sides), [6, 6, 8]);
  assert.deepEqual(roll.dice.map((die) => die.face), [4, 6, 7]);
  assert.ok(roll.dice.every((die) => !die.dropped));
  assert.equal(roll.modifier, 3);
  assert.equal(roll.total, 4 + 6 + 7 + 3);
});

test("pool text parses with whitespace, a bare die and a negative modifier; junk does not", () => {
  assert.deepEqual(parseDicePool(" 2d6 + 1d8 + 3 "), { dice: [{ count: 2, sides: 6 }, { count: 1, sides: 8 }], modifier: 3 });
  assert.deepEqual(parseDicePool("d20-2"), { dice: [{ count: 1, sides: 20 }], modifier: -2 });
  assert.deepEqual(parseDicePool("3d4"), { dice: [{ count: 3, sides: 4 }], modifier: 0 });
  for (const junk of ["", "  ", "2d6+", "+3", "abc", "2x6", "0d6", "2d0", "1d6++2", "-2d6"]) {
    assert.equal(parseDicePool(junk), null, `expected null for ${JSON.stringify(junk)}`);
  }
});
