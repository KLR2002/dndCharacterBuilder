import { test } from "node:test";
import assert from "node:assert/strict";
import { damageWildShape, healWildShape, setWildShapeHp } from "../src/rules/wildShapeHp.ts";

const bear = (currentHp: number) => ({ name: "Black Bear", source: "SRD", ac: 11, currentHp, maxHp: 19 });
const DEATH_SAVES_CLEARED = { successes: 0, failures: 0 } as const;

test("damageWildShape: damage below beast HP only lowers the beast HP", () => {
  const character = { currentHp: 20, tempHp: 3, activeWildShape: bear(10) };
  assert.deepEqual(damageWildShape(character, 4), { activeWildShape: { ...bear(10), currentHp: 6 } });
});

test("damageWildShape: damage exactly equal to beast HP ends the form with no carry-over", () => {
  const character = { currentHp: 20, tempHp: 3, activeWildShape: bear(6) };
  assert.deepEqual(damageWildShape(character, 6), { activeWildShape: null });
});

test("damageWildShape: excess carries over to normal HP after temp HP absorbs first", () => {
  const character = { currentHp: 20, tempHp: 3, activeWildShape: bear(5) };
  // 9 damage: 5 ends the form, 4 carries over; temp HP takes 3, so 1 comes off current HP.
  assert.deepEqual(damageWildShape(character, 9), {
    activeWildShape: null,
    currentHp: 19,
    tempHp: 0,
    deathSaves: DEATH_SAVES_CLEARED,
  });
});

test("damageWildShape: excess that takes normal HP to 0 leaves death saves alone", () => {
  const character = { currentHp: 3, tempHp: 0, activeWildShape: bear(2) };
  assert.deepEqual(damageWildShape(character, 7), { activeWildShape: null, currentHp: 0, tempHp: 0 });
});

test("damageWildShape: excess that leaves normal HP above 0 clears death saves", () => {
  const character = { currentHp: 8, tempHp: 0, activeWildShape: bear(4) };
  assert.deepEqual(damageWildShape(character, 6), {
    activeWildShape: null,
    currentHp: 6,
    tempHp: 0,
    deathSaves: DEATH_SAVES_CLEARED,
  });
});

test("damageWildShape: a non-finite or negative amount changes nothing", () => {
  const character = { currentHp: 20, tempHp: 3, activeWildShape: bear(10) };
  assert.deepEqual(damageWildShape(character, Number.NaN), {});
  assert.deepEqual(damageWildShape(character, -2), {});
});

test("healWildShape: heal is capped at the beast max HP", () => {
  assert.deepEqual(healWildShape(bear(15), 10), { activeWildShape: { ...bear(15), currentHp: 19 } });
});

test("healWildShape: heal adds to beast HP and returns only the form", () => {
  assert.deepEqual(healWildShape(bear(4), 5), { activeWildShape: { ...bear(4), currentHp: 9 } });
});

test("healWildShape: a non-finite amount changes nothing", () => {
  assert.deepEqual(healWildShape(bear(4), Number.POSITIVE_INFINITY), {});
});

test("setWildShapeHp: sets the beast total and keeps the form", () => {
  assert.deepEqual(setWildShapeHp(bear(10), 7), { activeWildShape: { ...bear(10), currentHp: 7 } });
});

test("setWildShapeHp: a total above max clamps to max", () => {
  assert.deepEqual(setWildShapeHp(bear(10), 99), { activeWildShape: { ...bear(10), currentHp: 19 } });
});

test("setWildShapeHp: a fractional total rounds down", () => {
  assert.deepEqual(setWildShapeHp(bear(10), 7.9), { activeWildShape: { ...bear(10), currentHp: 7 } });
});

test("setWildShapeHp: a total of 0 ends the form with no carry-over", () => {
  assert.deepEqual(setWildShapeHp(bear(10), 0), { activeWildShape: null });
});

test("setWildShapeHp: a negative total clamps to 0 and ends the form", () => {
  assert.deepEqual(setWildShapeHp(bear(10), -5), { activeWildShape: null });
});

test("setWildShapeHp: a non-finite total changes nothing", () => {
  assert.deepEqual(setWildShapeHp(bear(10), Number.NaN), {});
  assert.deepEqual(setWildShapeHp(bear(10), Number.POSITIVE_INFINITY), {});
});
