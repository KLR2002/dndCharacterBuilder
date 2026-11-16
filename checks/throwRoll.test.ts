import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import { planLevelUp, rollPlanHitPoints } from "../src/rules/levelUpFlow.ts";
import { rollD20, rollDamage, rollDie, type RandomSource } from "../src/rules/dice.ts";
import { evaluateRolls, parseRollExpression } from "../src/rules/rollExpression.ts";
import { d100Value } from "../src/rules/diceSolids.ts";
import {
  planThrow,
  recordDice,
  replayRandom,
  runThrow,
  throwFaces,
  THROW_SOLID_CAP,
} from "../src/rules/throwRoll.ts";

/** A deterministic physics source for the throw simulation: a linear congruential generator. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test("recordDice of an attack's d20 returns its one die", () => {
  assert.deepEqual(
    recordDice((random) => rollD20(5, "none", random)),
    [20],
  );
});

test("recordDice of critical damage doubles the dice of the pool", () => {
  assert.deepEqual(
    recordDice((random) => rollDamage("1d8+3", { critical: true }, random)),
    [8, 8],
  );
});

test("recordDice of the Hit Points roll records its one Hit Die", () => {
  const character = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", source: "PHB", level: 3, subclassName: "Champion", subclass: "Champion", subclassSource: "SRD" }],
  });
  const planned = planLevelUp(character, { className: "Fighter", hitPoints: { mode: "roll" } });
  if (!planned.ok) assert.fail(planned.reason);
  assert.deepEqual(
    recordDice((random) => rollPlanHitPoints(planned.plan, character, random).roll),
    [10],
  );
});

test("the dice count and order do not depend on the faces the random source returns", () => {
  const rolls = parseRollExpression("2d6+d20,a(d20,d20)+d4");
  if (!rolls.ok) assert.fail(rolls.message);
  const make = (random: RandomSource) => evaluateRolls(rolls.rolls, random);
  const sidesOf = (random: RandomSource) => make(random).flatMap((evaluated) => evaluated.roll.dice.map((die) => die.sides));
  const recorded = recordDice(make);
  assert.deepEqual(recorded, [6, 6, 20, 20, 20, 4]);
  assert.deepEqual(sidesOf(() => 1), recorded);
  assert.deepEqual(sidesOf((sides) => sides), recorded);
});

test("replayRandom returns the replayed faces in order, then the fallback for the rest and for undefined entries", () => {
  const fallbackCalls: number[] = [];
  const random = replayRandom([5, undefined, 3], (sides) => {
    fallbackCalls.push(sides);
    return 2;
  });
  assert.equal(random(20), 5);
  assert.equal(random(6), 2);
  assert.equal(random(8), 3);
  assert.equal(random(4), 2);
  assert.deepEqual(fallbackCalls, [6, 4]);
});

test("planThrow gives standard dice one body, a d100 two and every other die none, up to the cap", () => {
  assert.equal(THROW_SOLID_CAP, 20);
  const thrown = planThrow([6, 6, 100, 3, 20], THROW_SOLID_CAP);
  assert.equal(thrown.plan.filter((p) => p.solid).length, 4);
  assert.deepEqual(thrown.owner, [0, 1, 2, 2, 4]);
  assert.equal(thrown.geos.length, 5);
  assert.deepEqual(thrown.geos.map((geo) => geo.kind), ["std", "std", "tens", "units", "std"]);
});

test("planThrow leaves a die digital once the cap has no bodies left for it", () => {
  const thrown = planThrow([20, 20, 6], 1);
  assert.deepEqual(thrown.plan.map((p) => p.solid), [true, false, false]);
  assert.deepEqual(thrown.owner, [0]);
});

test("throwFaces combines a d100's two bodies and reads a standard die's body value", () => {
  const thrown = planThrow([100, 6], THROW_SOLID_CAP);
  // Body values in owner order: tens reading 3, units reading 7, then the d6's face 4.
  assert.deepEqual(throwFaces(thrown, [3, 7, 4], 2), [d100Value(3, 7), 4]);
  assert.equal(d100Value(3, 7), 37);
});

test("throwFaces leaves a die with no body undefined so the replay falls back to the generator", () => {
  const thrown = planThrow([3, 6], THROW_SOLID_CAP);
  assert.deepEqual(throwFaces(thrown, [4], 2), [undefined, 4]);
});

test("runThrow returns the Roll whose faces are the settled dice of the simulation", () => {
  const world = { W: 800, H: 600 };
  const result = runThrow(
    (random) => ({ roll: rollD20(0, "none", random) }),
    { world, origin: [700, 500], size: 30, physics: seededRandom(7), fallback: () => 1 },
  );
  assert.ok(result.thrown);
  assert.equal(result.thrown.results.length, 1);
  assert.equal(result.result.roll.dice[0].face, result.thrown.results[0].value);
});

test("runThrow maps a thrown d100 to the face of its two settled bodies", () => {
  const world = { W: 800, H: 600 };
  const result = runThrow(
    (random) => ({ roll: { dice: [{ sides: 100, face: rollDie(100, random), dropped: false }], modifier: 0, total: 0 } }),
    { world, origin: [700, 500], size: 30, physics: seededRandom(11), fallback: () => 1 },
  );
  assert.ok(result.thrown);
  assert.equal(result.thrown.results.length, 2);
  const [tens, units] = result.thrown.results.map((r) => r.value);
  assert.equal(result.result.roll.dice[0].face, d100Value(tens, units));
});

test("runThrow without a solid die decides every face with the fallback and returns no throw", () => {
  const result = runThrow((random) => rollDie(3, random), {
    world: { W: 800, H: 600 },
    origin: [700, 500],
    size: 30,
    physics: seededRandom(1),
    fallback: () => 2,
  });
  assert.equal(result.result, 2);
  assert.equal(result.thrown, null);
});
