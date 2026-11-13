import { test } from "node:test";
import assert from "node:assert/strict";
import { rollD20, rollDicePool, type RandomSource } from "../src/rules/dice.ts";
import { entryHeading, formatRollTime, makeRollLogEntry, rollMarkers } from "../src/rules/rollLog.ts";

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

test("a label replaces the source in the heading and keeps the character prefix", () => {
  const named = makeRollLogEntry({ roll: rollD20(0, "none", fixedFaces([12])), source: "Dice tray", characterName: "Kara", label: "d20" }, 1, 0);
  assert.equal(entryHeading(named), "Kara · d20");
  assert.equal(named.label, "d20");
  const bare = makeRollLogEntry({ roll: rollD20(0, "none", fixedFaces([12])), source: "Dice tray", label: "a(d20,d20)+5" }, 2, 0);
  assert.equal(entryHeading(bare), "a(d20,d20)+5");
});

test("a single publish is a batch of one: index 0, size 1, its own batch id", () => {
  const entry = makeRollLogEntry({ roll: rollDicePool("1d6", fixedFaces([4])), source: "Dice tray" }, 7, 0);
  assert.equal(entry.batchId, 7);
  assert.equal(entry.batchIndex, 0);
  assert.equal(entry.batchSize, 1);
});

test("entries of one batch share the batch id and carry their position in it", () => {
  const batch = { batchId: 3, batchIndex: 2, batchSize: 3 };
  const entry = makeRollLogEntry({ roll: rollDicePool("1d6", fixedFaces([4])), source: "Dice tray" }, 12, 0, batch);
  assert.equal(entry.batchId, 3);
  assert.equal(entry.batchIndex, 2);
  assert.equal(entry.batchSize, 3);
  assert.equal(entry.id, 12);
});
