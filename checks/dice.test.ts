import { test } from "node:test";
import assert from "node:assert/strict";
import { isNatural20, parseDicePool, rollAbilityScores, rollDamage, rollDicePool, rollD20, type RandomSource } from "../src/rules/dice.ts";
import { rollRolledAbilities, setRolledAbilityPick } from "../src/rules/builderTransitions.ts";
import { makeChar } from "./testUtils.ts";
import { __setKvForTests, saveCharacters, loadCharacters } from "../src/services/storage.ts";

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

test("Rolled Abilities rolls six results of 4d6 dropping the lowest, every die reported", () => {
  const faces = [
    6, 2, 5, 4,
    1, 1, 3, 3,
    6, 6, 6, 5,
    2, 4, 4, 2,
    3, 5, 1, 6,
    4, 4, 4, 4,
  ];
  const expected = [
    { total: 15, droppedIndex: 1 },
    { total: 7, droppedIndex: 0 },
    { total: 18, droppedIndex: 3 },
    { total: 10, droppedIndex: 0 },
    { total: 14, droppedIndex: 2 },
    { total: 12, droppedIndex: 0 },
  ];
  const results = rollAbilityScores(fixedFaces(faces));
  assert.equal(results.length, 6);
  results.forEach((result, i) => {
    assert.equal(result.dice.length, 4);
    assert.ok(result.dice.every((die) => die.sides === 6));
    assert.deepEqual(result.dice.map((die) => die.face), faces.slice(i * 4, i * 4 + 4));
    assert.equal(result.droppedIndex, expected[i].droppedIndex);
    assert.equal(result.dice.filter((die) => die.dropped).length, 1);
    assert.equal(result.dice[result.droppedIndex].dropped, true);
    assert.equal(result.dice[result.droppedIndex].face, Math.min(...result.dice.map((die) => die.face)));
    assert.equal(result.total, expected[i].total);
    assert.ok(result.total >= 3 && result.total <= 18);
  });
});

test("each rolled result is placed on exactly one ability; a reroll replaces all six and clears placements", async () => {
  __setKvForTests(new Map());
  const facesA = [6, 2, 5, 4, 1, 1, 3, 3, 6, 6, 6, 5, 2, 4, 4, 2, 3, 5, 1, 6, 4, 4, 4, 4];
  const totalsA = [15, 7, 18, 10, 14, 12];
  const facesB = [3, 3, 3, 6, 5, 5, 5, 5, 2, 2, 6, 6, 4, 1, 4, 4, 6, 2, 3, 3, 1, 2, 3, 4];
  const totalsB = [12, 15, 14, 12, 12, 9];
  const allEights = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };

  let char = rollRolledAbilities(makeChar({ abilityMethod: "rolled" }), fixedFaces(facesA));
  assert.equal(char.rolledAbilities?.length, 6);
  assert.deepEqual(char.rolledAbilities?.map((result) => result.total), totalsA);
  assert.deepEqual(char.rolledAbilityPicks, {});
  assert.deepEqual(char.baseAbilityScores, allEights);

  char = setRolledAbilityPick(char, "str", 0);
  char = setRolledAbilityPick(char, "dex", 2);
  assert.deepEqual(char.rolledAbilityPicks, { str: 0, dex: 2 });
  assert.equal(char.baseAbilityScores.str, 15);
  assert.equal(char.baseAbilityScores.dex, 18);

  assert.equal(setRolledAbilityPick(char, "con", 0), char);
  assert.equal(setRolledAbilityPick(char, "con", 6), char);
  assert.equal(setRolledAbilityPick(char, "con", -1), char);
  assert.equal(setRolledAbilityPick(char, "con", 1.5), char);

  const unassigned = setRolledAbilityPick(char, "str", null);
  assert.deepEqual(unassigned.rolledAbilityPicks, { dex: 2 });
  assert.equal(unassigned.baseAbilityScores.str, 8);
  assert.equal(char.rolledAbilityPicks?.str, 0);

  const rerolled = rollRolledAbilities(char, fixedFaces(facesB));
  assert.deepEqual(rerolled.rolledAbilities?.map((result) => result.total), totalsB);
  assert.deepEqual(rerolled.rolledAbilityPicks, {});
  assert.deepEqual(rerolled.baseAbilityScores, allEights);

  const again = rollRolledAbilities(rerolled, fixedFaces(facesA));
  assert.deepEqual(again.rolledAbilities?.map((result) => result.total), totalsA);

  const placed = setRolledAbilityPick(rerolled, "cha", 4);
  await saveCharacters([placed]);
  const [loaded] = await loadCharacters();
  assert.equal(loaded.abilityMethod, "rolled");
  assert.deepEqual(loaded.rolledAbilityPicks, { cha: 4 });
  assert.equal(loaded.rolledAbilities?.length, 6);
  assert.equal(loaded.baseAbilityScores.cha, 12);

  await saveCharacters([makeChar()]);
  const [oldSave] = await loadCharacters();
  assert.equal(oldSave.abilityMethod, "pointBuy");
  assert.equal(oldSave.rolledAbilities, undefined);
  assert.equal(oldSave.rolledAbilityPicks, undefined);
});

test("a dice term's count is capped at 100 per term; larger counts are rejected", () => {
  assert.deepEqual(parseDicePool("100d6"), { dice: [{ count: 100, sides: 6 }], modifier: 0 });
  assert.deepEqual(parseDicePool("2d6+100d8+3"), { dice: [{ count: 2, sides: 6 }, { count: 100, sides: 8 }], modifier: 3 });
  assert.equal(parseDicePool("101d6"), null);
  assert.equal(parseDicePool("99999999999d6"), null);
});
