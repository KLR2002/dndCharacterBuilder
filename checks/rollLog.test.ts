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
