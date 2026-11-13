import { test } from "node:test";
import assert from "node:assert/strict";
import { rollDicePool, type RandomSource } from "../src/rules/dice.ts";
import { MAX_ANIMATED_DICE, animatedDice, resolveDiceAnimation } from "../src/rules/diceAnimation.ts";
import { DEFAULT_SETTINGS, __setKvForTests, loadAll, loadSettings, migrateIfNeeded, updateSettings } from "../src/services/storage.ts";

/** A random source with fixed faces, cycling: the die with `sides` lands on the next queued face. */
function fixedFaces(faces: number[]): RandomSource {
  let index = 0;
  return (sides) => {
    const face = faces[index++ % faces.length];
    return Math.min(sides, Math.max(1, face));
  };
}

test("a saved dice animation wins over the system reduced-motion preference", () => {
  assert.equal(resolveDiceAnimation("off", false), "off");
  assert.equal(resolveDiceAnimation("off", true), "off");
  assert.equal(resolveDiceAnimation("tumble", false), "tumble");
  assert.equal(resolveDiceAnimation("tumble", true), "tumble");
  assert.equal(resolveDiceAnimation("throw", true), "throw");
});

test("with no saved dice animation it is tumble, or off under reduced motion", () => {
  assert.equal(resolveDiceAnimation(undefined, false), "tumble");
  assert.equal(resolveDiceAnimation(undefined, true), "off");
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

test("the dice animation has no default in the settings and is absent until saved", () => {
  assert.equal("diceAnimation" in DEFAULT_SETTINGS, false);
  const migrated = migrateIfNeeded({ characters: [], folders: [], settings: { schemaVersion: 2, hasCompletedFirstRun: true } });
  assert.equal(migrated.settings.diceAnimation, undefined);
  assert.equal(resolveDiceAnimation(migrated.settings.diceAnimation, true), "off");
  assert.equal(resolveDiceAnimation(migrated.settings.diceAnimation, false), "tumble");
});

test("a saved dice3dEnabled of true loads as tumble and false as off, and the old field is dropped", () => {
  const on = migrateIfNeeded({ characters: [], folders: [], settings: { dice3dEnabled: true } });
  assert.equal(on.settings.diceAnimation, "tumble");
  assert.equal("dice3dEnabled" in on.settings, false);
  const off = migrateIfNeeded({ characters: [], folders: [], settings: { dice3dEnabled: false } });
  assert.equal(off.settings.diceAnimation, "off");
  assert.equal("dice3dEnabled" in off.settings, false);
});

test("a saved diceAnimation wins over a leftover dice3dEnabled", () => {
  const both = migrateIfNeeded({ characters: [], folders: [], settings: { dice3dEnabled: true, diceAnimation: "off" } });
  assert.equal(both.settings.diceAnimation, "off");
  assert.equal("dice3dEnabled" in both.settings, false);
});

test("a non-boolean dice3dEnabled and an unknown or non-string diceAnimation are rejected", () => {
  assert.throws(() => migrateIfNeeded({ characters: [], folders: [], settings: { dice3dEnabled: "yes" } }), /dice3dEnabled/);
  assert.throws(() => migrateIfNeeded({ characters: [], folders: [], settings: { diceAnimation: "spin" } }), /diceAnimation must be off, tumble or throw/);
  assert.throws(() => migrateIfNeeded({ characters: [], folders: [], settings: { diceAnimation: 1 } }), /diceAnimation must be off, tumble or throw/);
  assert.throws(() => migrateIfNeeded({ characters: [], folders: [], settings: { diceAnimation: true } }), /diceAnimation must be off, tumble or throw/);
});

test("diceAnimation survives a settings round trip and a patch of another field keeps it", async () => {
  const kv = new Map<string, string>();
  __setKvForTests(kv);
  await updateSettings({ diceAnimation: "off" });
  assert.equal((await loadSettings()).diceAnimation, "off");
  await updateSettings({ fullHealOnLevelUp: false });
  const loaded = await loadSettings();
  assert.equal(loaded.diceAnimation, "off");
  assert.equal(loaded.fullHealOnLevelUp, false);
  const res = await loadAll();
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.data.settings.diceAnimation, "off");
});

test("a settings write drops a leftover dice3dEnabled and keeps the migrated mode", async () => {
  const kv = new Map<string, string>();
  __setKvForTests(kv);
  await updateSettings({ diceAnimation: "tumble" });
  const stored = JSON.parse(kv.get("@dnd5e_app_settings") ?? "{}");
  assert.equal("dice3dEnabled" in stored, false);
  assert.equal(stored.diceAnimation, "tumble");
});
