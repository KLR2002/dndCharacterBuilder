import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDicePool, rollD20, rollDicePool, type RandomSource } from "../src/rules/dice.ts";
import {
  addDieToPool,
  entryHeading,
  formatRollTime,
  isSingleD20,
  makeRollLogEntry,
  poolExpression,
  poolLabel,
  removePoolTerm,
  rollMarkers,
  type PoolTerm,
} from "../src/rules/rollLog.ts";

/** A random source with fixed faces, cycling: each die lands on the next queued face. */
function fixedFaces(faces: number[]): RandomSource {
  let index = 0;
  return (sides) => {
    const face = faces[index++ % faces.length];
    return Math.min(sides, Math.max(1, face));
  };
}

test("an entry names its character and source; a tray roll has no character", () => {
  const attack = makeRollLogEntry(
    { roll: rollD20(5, "none", fixedFaces([15])), source: "Longsword attack", characterName: "Kara", d20Mode: "none" },
    1,
    0,
  );
  assert.equal(entryHeading(attack), "Kara · Longsword attack");
  assert.equal(attack.characterName, "Kara");
  assert.equal(attack.source, "Longsword attack");
  assert.equal(attack.d20Mode, "none");
  assert.equal(attack.critical, false);
  assert.equal(attack.time, 0);

  const tray = makeRollLogEntry({ roll: rollDicePool("1d6", fixedFaces([4])), source: "Dice tray" }, 2, 1000);
  assert.equal(entryHeading(tray), "Dice tray");
  assert.equal(tray.characterName, undefined);
  assert.equal(tray.d20Mode, "none");
});

test("markers: Natural 20 and Natural 1 on a kept d20, Critical on critical damage, nothing else", () => {
  const nat20 = makeRollLogEntry({ roll: rollD20(5, "none", fixedFaces([20])), source: "Longsword attack", characterName: "Kara" }, 1, 0);
  assert.deepEqual(rollMarkers(nat20), ["natural20"]);

  const nat1 = makeRollLogEntry({ roll: rollD20(0, "none", fixedFaces([1])), source: "Longsword attack", characterName: "Kara" }, 2, 0);
  assert.deepEqual(rollMarkers(nat1), ["natural1"]);

  // A dropped d20 showing 20 is not a natural 20: disadvantage kept the lower die.
  const dropped20 = makeRollLogEntry({ roll: rollD20(0, "disadvantage", fixedFaces([20, 5])), source: "Longsword attack", characterName: "Kara", d20Mode: "disadvantage" }, 3, 0);
  assert.deepEqual(rollMarkers(dropped20), []);
  assert.equal(dropped20.d20Mode, "disadvantage");

  const crit = makeRollLogEntry({ roll: rollDicePool("2d8+3", fixedFaces([7, 8])), source: "Longsword damage", characterName: "Kara", critical: true }, 4, 0);
  assert.deepEqual(rollMarkers(crit), ["critical"]);

  const pool = makeRollLogEntry({ roll: rollDicePool("2d6+1d8+3", fixedFaces([4, 6, 7])), source: "Dice tray" }, 5, 0);
  assert.deepEqual(rollMarkers(pool), []);
});

test("Natural 20 / Natural 1 appear only on a d20 test, never on a multi-d20 or mixed pool", () => {
  // A tray pool of 2d20 is not a d20 test: no advantage was chosen, so no Natural 20 marker.
  const twoD20 = makeRollLogEntry({ roll: rollDicePool("2d20", fixedFaces([20, 5])), source: "Dice tray" }, 6, 0);
  assert.deepEqual(rollMarkers(twoD20), []);
  const mixed = makeRollLogEntry({ roll: rollDicePool("1d20+1d6", fixedFaces([20, 4])), source: "Dice tray" }, 7, 0);
  assert.deepEqual(rollMarkers(mixed), []);
  // A lone-d20 tray roll and a badge's d20 roll (plain, advantage or disadvantage) are d20 tests.
  const lone = makeRollLogEntry({ roll: rollD20(0, "none", fixedFaces([20])), source: "Dice tray", d20Mode: "none" }, 8, 0);
  assert.deepEqual(rollMarkers(lone), ["natural20"]);
  const adv = makeRollLogEntry({ roll: rollD20(0, "advantage", fixedFaces([20, 3])), source: "Longsword attack", d20Mode: "advantage" }, 9, 0);
  assert.deepEqual(rollMarkers(adv), ["natural20"]);
  const nat1 = makeRollLogEntry({ roll: rollD20(0, "none", fixedFaces([1])), source: "Dice tray", d20Mode: "none" }, 10, 0);
  assert.deepEqual(rollMarkers(nat1), ["natural1"]);
});

test("a follow-up action travels with the entry", () => {
  const followUp = { label: "Roll damage", onPress: () => {} };
  const entry = makeRollLogEntry({ roll: rollD20(5, "none", fixedFaces([15])), source: "Longsword attack", characterName: "Kara", followUp }, 1, 0);
  assert.equal(entry.followUp?.label, "Roll damage");
  assert.equal(typeof entry.followUp?.onPress, "function");
});

test("formatRollTime renders a 24-hour HH:MM:SS clock", () => {
  const time = new Date(2026, 10, 9, 8, 5, 3).getTime();
  assert.equal(formatRollTime(time), "08:05:03");
  const evening = new Date(2026, 10, 9, 23, 59, 58).getTime();
  assert.equal(formatRollTime(evening), "23:59:58");
});

test("the pool builder adds one die per tap, merging equal sides, and removes a whole term", () => {
  let terms = addDieToPool([], 6);
  assert.deepEqual(terms, [{ count: 1, sides: 6 }]);
  terms = addDieToPool(terms, 6);
  assert.deepEqual(terms, [{ count: 2, sides: 6 }]);
  terms = addDieToPool(terms, 8);
  assert.deepEqual(terms, [{ count: 2, sides: 6 }, { count: 1, sides: 8 }]);
  terms = removePoolTerm(terms, 6);
  assert.deepEqual(terms, [{ count: 1, sides: 8 }]);
  assert.deepEqual(removePoolTerm([], 20), []);
});

test("a die's count in the tray pool is capped at 100, so the pool still parses and rolls", () => {
  let terms: PoolTerm[] = [];
  for (let i = 0; i < 105; i++) terms = addDieToPool(terms, 6);
  assert.deepEqual(terms, [{ count: 100, sides: 6 }]);
  // The capped pool is still a parseable pool, so rolling it cannot throw "Not a dice pool".
  assert.equal(poolExpression(terms, 0), "100d6");
  assert.deepEqual(parseDicePool(poolExpression(terms, 0)), { dice: [{ count: 100, sides: 6 }], modifier: 0 });
  assert.equal(rollDicePool(poolExpression(terms, 0), fixedFaces([3])).total, 300);
});

test("only a pool of exactly one d20 is a d20 roll", () => {
  assert.equal(isSingleD20([{ count: 1, sides: 20 }]), true);
  assert.equal(isSingleD20([{ count: 2, sides: 20 }]), false);
  assert.equal(isSingleD20([{ count: 1, sides: 20 }, { count: 1, sides: 6 }]), false);
  assert.equal(isSingleD20([{ count: 1, sides: 6 }]), false);
  assert.equal(isSingleD20([]), false);
});

test("the pool's expression parses back to the same pool, and the label reads like the roll button", () => {
  const terms = [{ count: 2, sides: 6 }, { count: 1, sides: 8 }];
  assert.equal(poolExpression(terms, 3), "2d6+1d8+3");
  assert.deepEqual(parseDicePool(poolExpression(terms, 3)), { dice: terms, modifier: 3 });
  assert.equal(poolExpression([{ count: 1, sides: 20 }], -2), "1d20-2");
  assert.deepEqual(parseDicePool(poolExpression([{ count: 1, sides: 20 }], -2)), { dice: [{ count: 1, sides: 20 }], modifier: -2 });
  assert.equal(poolExpression(terms, 0), "2d6+1d8");

  assert.equal(poolLabel(terms, 3), "2d6 + 1d8 + 3");
  assert.equal(poolLabel([{ count: 1, sides: 20 }], -2), "1d20 − 2");
  assert.equal(poolLabel([{ count: 1, sides: 6 }], 0), "1d6");
});
