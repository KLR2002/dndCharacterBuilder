import { test } from "node:test";
import assert from "node:assert/strict";
import { rollDicePool, type RandomSource } from "../src/rules/dice.ts";
import { MAX_ANIMATED_DICE, animatedDice, resolveDiceAnimationEnabled } from "../src/rules/diceAnimation.ts";
import { DEFAULT_SETTINGS, __setKvForTests, loadAll, loadSettings, migrateIfNeeded, updateSettings } from "../src/services/storage.ts";

/** A random source with fixed faces, cycling: the die with `sides` lands on the next queued face. */
function fixedFaces(faces: number[]): RandomSource {
  let index = 0;
  return (sides) => {
    const face = faces[index++ % faces.length];
    return Math.min(sides, Math.max(1, face));
  };
}

test("the 3D dice setting defaults to on, and off when the system asks for reduced motion and none is saved", () => {
  assert.equal(resolveDiceAnimationEnabled(undefined, false), true);
  assert.equal(resolveDiceAnimationEnabled(undefined, true), false);
});

test("a saved 3D dice setting wins over the system reduced-motion preference", () => {
  assert.equal(resolveDiceAnimationEnabled(true, true), true);
  assert.equal(resolveDiceAnimationEnabled(true, false), true);
  assert.equal(resolveDiceAnimationEnabled(false, false), false);
  assert.equal(resolveDiceAnimationEnabled(false, true), false);
});

test("at most MAX_ANIMATED_DICE dice animate; the rest still show as text chips", () => {
  assert.equal(MAX_ANIMATED_DICE, 10);
  const big = rollDicePool("20d6", fixedFaces([3]));
  assert.equal(big.dice.length, 20);
  const animated = animatedDice(big);
  assert.equal(animated.length, MAX_ANIMATED_DICE);
  assert.deepEqual(animated.map((die) => die.face), big.dice.slice(0, MAX_ANIMATED_DICE).map((die) => die.face));
});

test("a small roll animates every die, dropped ones included (the renderer mutes them)", () => {
  const roll = rollDicePool("3d8", fixedFaces([5, 2, 8]));
  roll.dice[1].dropped = true;
  const animated = animatedDice(roll);
  assert.equal(animated.length, 3);
  assert.equal(animated[1].dropped, true);
  assert.equal(animatedDice(rollDicePool("1d20", fixedFaces([11]))).length, 1);
});

test("dice3dEnabled is absent in settings saved before it existed and defaults resolve from it", () => {
  assert.equal("dice3dEnabled" in DEFAULT_SETTINGS, false);
  const migrated = migrateIfNeeded({ characters: [], folders: [], settings: { schemaVersion: 2, hasCompletedFirstRun: true } });
  assert.equal(migrated.settings.dice3dEnabled, undefined);
  assert.equal(resolveDiceAnimationEnabled(migrated.settings.dice3dEnabled, true), false);
  assert.equal(resolveDiceAnimationEnabled(migrated.settings.dice3dEnabled, false), true);
});

test("dice3dEnabled keeps an explicit on or off and rejects a non-boolean value", () => {
  const on = migrateIfNeeded({ characters: [], folders: [], settings: { dice3dEnabled: true } });
  assert.equal(on.settings.dice3dEnabled, true);
  const off = migrateIfNeeded({ characters: [], folders: [], settings: { dice3dEnabled: false } });
  assert.equal(off.settings.dice3dEnabled, false);
  assert.throws(() => migrateIfNeeded({ characters: [], folders: [], settings: { dice3dEnabled: "yes" } }), /dice3dEnabled/);
});

test("dice3dEnabled survives a settings round trip and a patch keeps it", async () => {
  const kv = new Map<string, string>();
  __setKvForTests(kv);
  await updateSettings({ dice3dEnabled: false });
  assert.equal((await loadSettings()).dice3dEnabled, false);
  await updateSettings({ fullHealOnLevelUp: false });
  const loaded = await loadSettings();
  assert.equal(loaded.dice3dEnabled, false);
  assert.equal(loaded.fullHealOnLevelUp, false);
  const res = await loadAll();
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.data.settings.dice3dEnabled, false);
});
