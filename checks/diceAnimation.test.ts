import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBLE_SOLID_CAP, resolveDiceAnimation, tumbleQuaternion } from "../src/rules/diceAnimation.ts";
import { rotateVector, type Quat, type Vec3 } from "../src/rules/diceMath.ts";
import { makeDie, planSolidDice, poseShowing, type SolidSides } from "../src/rules/diceSolids.ts";
import { DEFAULT_SETTINGS, __setKvForTests, loadAll, loadSettings, migrateIfNeeded, updateSettings } from "../src/services/storage.ts";

const STANDARD: SolidSides[] = [4, 6, 8, 10, 12, 20];
const AXIS: Vec3 = [0.3, -0.5, 0.8];
const TWO_AND_A_HALF_TURNS = 2.5 * 2 * Math.PI;
const YAW = 0.7;

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

test("the tumble ends on the pose showing the face, for every standard die and every face", () => {
  for (const sides of STANDARD) {
    const geo = makeDie(sides, "std");
    for (const readable of geo.readables) {
      const target = poseShowing(geo, readable.value, YAW);
      const settled = tumbleQuaternion(target, AXIS, TWO_AND_A_HALF_TURNS, 1);
      assertSameQuat(settled, target);
      const top = geo.readables.reduce((best, r) =>
        rotateVector(settled, r.dir)[2] > rotateVector(settled, best.dir)[2] ? r : best,
      );
      assert.equal(top.value, readable.value, `a d${sides} settling on ${readable.value} shows ${top.value}`);
    }
  }
});

test("at progress 0 the tumble is turned away from the settled pose", () => {
  const geo = makeDie(6, "std");
  const target = poseShowing(geo, 4, YAW);
  const start = tumbleQuaternion(target, AXIS, TWO_AND_A_HALF_TURNS, 0);
  const apart = start.some((component, i) => Math.abs(component - target[i]) > 1e-6);
  assert.equal(apart, true);
});

test("a batch of fourteen d6 plans ten solids and leaves the other four digital", () => {
  assert.equal(TUMBLE_SOLID_CAP, 10);
  const plan = planSolidDice(Array.from({ length: 14 }, () => 6), TUMBLE_SOLID_CAP);
  assert.equal(plan.filter((p) => p.solid).length, 10);
  assert.deepEqual(plan.slice(10).map((p) => p.solid), [false, false, false, false]);
});

test("a d3 is never a solid, and the dice after it still plan as solids", () => {
  assert.deepEqual(planSolidDice([3, 6], TUMBLE_SOLID_CAP), [
    { solid: false, bodies: 0 },
    { solid: true, bodies: 1 },
  ]);
});

function assertSameQuat(actual: Quat, expected: Quat): void {
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(actual[i] - expected[i]) < 1e-9, `component ${i}: ${actual[i]} vs ${expected[i]}`);
}

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

test("stored settings with a leftover dice3dEnabled load as their mode, and the next settings write drops the field", async () => {
  for (const [enabled, mode] of [
    [true, "tumble"],
    [false, "off"],
  ] as const) {
    const kv = new Map<string, string>();
    __setKvForTests(kv);
    kv.set("@dnd5e_app_settings", JSON.stringify({ schemaVersion: 2, hasCompletedFirstRun: true, dice3dEnabled: enabled }));
    const loaded = await loadSettings();
    assert.equal(loaded.diceAnimation, mode);
    assert.equal("dice3dEnabled" in loaded, false);
    await updateSettings({ fullHealOnLevelUp: false });
    const stored = JSON.parse(kv.get("@dnd5e_app_settings") ?? "{}");
    assert.equal("dice3dEnabled" in stored, false);
    assert.equal(stored.diceAnimation, mode);
    assert.equal(stored.fullHealOnLevelUp, false);
  }
});
