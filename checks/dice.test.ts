import { test } from "node:test";
import assert from "node:assert/strict";
import { isNatural20, parseDicePool, rollDamage, rollDicePool, rollD20, type RandomSource } from "../src/rules/dice.ts";

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

test("advantage keeps the higher d20 and disadvantage the lower; both d20s are reported", () => {
  const advantage = rollD20(5, "advantage", fixedFaces([17, 9]));
  assert.equal(advantage.dice.length, 2);
  assert.deepEqual(advantage.dice.map((die) => die.face), [17, 9]);
  assert.ok(advantage.dice.every((die) => die.sides === 20));
  assert.equal(advantage.dice[0].dropped, false);
  assert.equal(advantage.dice[1].dropped, true);
  assert.equal(advantage.modifier, 5);
  assert.equal(advantage.total, 17 + 5);

  const disadvantage = rollD20(5, "disadvantage", fixedFaces([17, 9]));
  assert.equal(disadvantage.dice.length, 2);
  assert.deepEqual(disadvantage.dice.map((die) => die.face), [17, 9]);
  assert.equal(disadvantage.dice[0].dropped, true);
  assert.equal(disadvantage.dice[1].dropped, false);
  assert.equal(disadvantage.total, 9 + 5);

  const plain = rollD20(2, "none", fixedFaces([11]));
  assert.equal(plain.dice.length, 1);
  assert.equal(plain.dice[0].dropped, false);
  assert.equal(plain.total, 13);

  const tie = rollD20(0, "advantage", fixedFaces([12, 12]));
  assert.equal(tie.total, 12);
  assert.equal(tie.dice.filter((die) => !die.dropped).length, 1);
});

test("a kept natural 20 doubles the damage dice, not the flat modifier", () => {
  const criticalAttack = rollD20(7, "advantage", fixedFaces([3, 20]));
  assert.ok(isNatural20(criticalAttack));
  assert.equal(criticalAttack.total, 20 + 7);

  const damage = rollDamage("2d6+3", { critical: isNatural20(criticalAttack) }, fixedFaces([5, 2, 6, 1]));
  assert.equal(damage.dice.length, 4);
  assert.deepEqual(damage.dice.map((die) => die.face), [5, 2, 6, 1]);
  assert.ok(damage.dice.every((die) => die.sides === 6));
  assert.equal(damage.modifier, 3);
  assert.equal(damage.total, 5 + 2 + 6 + 1 + 3);

  const normalAttack = rollD20(7, "none", fixedFaces([19]));
  assert.equal(isNatural20(normalAttack), false);
  const normalDamage = rollDamage("2d6+3", { critical: isNatural20(normalAttack) }, fixedFaces([5, 2]));
  assert.equal(normalDamage.dice.length, 2);
  assert.equal(normalDamage.total, 5 + 2 + 3);

  const unkeptTwenty = rollD20(0, "disadvantage", fixedFaces([20, 4]));
  assert.equal(isNatural20(unkeptTwenty), false);
});
