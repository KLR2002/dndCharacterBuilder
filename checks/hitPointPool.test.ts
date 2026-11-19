import { test } from "node:test";
import assert from "node:assert/strict";
import { hitPointPatch } from "../src/rules/hitPointPool.ts";
import { makeChar } from "./testUtils.ts";

const bear = { name: "Black Bear", source: "SRD", ac: 11, currentHp: 10, maxHp: 19 };
const CLEARED_SAVES = { successes: 0, failures: 0 } as const;

test("without a form, damage takes temp HP first, then current HP", () => {
  const character = makeChar({ currentHp: 10, tempHp: 3, activeWildShape: null });
  assert.deepEqual(hitPointPatch(character, { kind: "damage", amount: 5 }, 20), {
    currentHp: 8,
    tempHp: 0,
    deathSaves: CLEARED_SAVES,
  });
});

test("with a form, damage of 4 lowers the form to 6 and leaves normal HP alone", () => {
  const character = makeChar({ currentHp: 20, tempHp: 0, activeWildShape: bear });
  const patch = hitPointPatch(character, { kind: "damage", amount: 4 }, 20);
  assert.deepEqual(patch, { activeWildShape: { ...bear, currentHp: 6 } });
});

test("with a form, damage of 14 ends the form and takes 4 from normal HP", () => {
  const character = makeChar({ currentHp: 20, tempHp: 0, activeWildShape: bear });
  assert.deepEqual(hitPointPatch(character, { kind: "damage", amount: 14 }, 20), {
    activeWildShape: null,
    currentHp: 16,
    tempHp: 0,
    deathSaves: CLEARED_SAVES,
  });
});

test("with a form, heal goes to the form and is capped at its max", () => {
  const character = makeChar({ currentHp: 20, tempHp: 0, activeWildShape: bear });
  const patch = hitPointPatch(character, { kind: "heal", amount: 50 }, 20);
  assert.deepEqual(patch, { activeWildShape: { ...bear, currentHp: 19 } });
});

test("with a form, temp HP goes to the form", () => {
  const character = makeChar({ currentHp: 20, tempHp: 0, activeWildShape: bear });
  const patch = hitPointPatch(character, { kind: "temp", amount: 5 }, 20);
  assert.deepEqual(patch, { activeWildShape: { ...bear, tempHp: 5 } });
});

test("with a form and target character, damage changes normal HP", () => {
  const character = makeChar({ currentHp: 20, tempHp: 0, activeWildShape: bear });
  const patch = hitPointPatch(character, { kind: "damage", amount: 4 }, 20, "character");
  assert.deepEqual(patch, { currentHp: 16, tempHp: 0, deathSaves: CLEARED_SAVES });
});

test("without a form, target wildShape changes nothing", () => {
  const character = makeChar({ currentHp: 20, tempHp: 0, activeWildShape: null });
  assert.deepEqual(hitPointPatch(character, { kind: "damage", amount: 4 }, 20, "wildShape"), {});
});

test("set edits the form's total when a form is active and normal HP otherwise", () => {
  const worn = makeChar({ currentHp: 20, tempHp: 0, activeWildShape: bear });
  assert.deepEqual(hitPointPatch(worn, { kind: "set", amount: 7 }, 20), {
    activeWildShape: { ...bear, currentHp: 7 },
  });
  const plain = makeChar({ currentHp: 20, tempHp: 0, activeWildShape: null });
  assert.deepEqual(hitPointPatch(plain, { kind: "set", amount: 7 }, 20), {
    currentHp: 7,
    tempHp: 0,
    deathSaves: CLEARED_SAVES,
  });
});

test("temp HP without a form sets the character's temp HP", () => {
  const character = makeChar({ currentHp: 20, tempHp: 2, activeWildShape: null });
  assert.deepEqual(hitPointPatch(character, { kind: "temp", amount: 4 }, 20), { tempHp: 4 });
});
