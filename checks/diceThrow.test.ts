import { test } from "node:test";
import assert from "node:assert/strict";
import { rotateVector, type Vec3 } from "../src/rules/diceMath.ts";
import { makeDie, type DieGeometry } from "../src/rules/diceSolids.ts";
import { launchSpecs, simulateThrow, THROW_FPS, type ThrowResult } from "../src/rules/diceThrow.ts";

const WORLD = { W: 390, H: 800 };
const SIZE = 30;
const ORIGIN: [number, number] = [346, 756];
const MAX_FRAMES = 6.5 * THROW_FPS + 2;

/** mulberry32: a small seeded generator returning numbers in [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function throwOf(dice: DieGeometry[], seed: number): ThrowResult[] {
  const random = mulberry32(seed);
  const specs = launchSpecs(dice, SIZE, WORLD, ORIGIN, random);
  return simulateThrow(specs, WORLD, random);
}

function frameAt(result: ThrowResult, frame: number): number[] {
  return Array.from(result.frames.subarray(frame * 7, frame * 7 + 7));
}

function lastFrame(result: ThrowResult): number[] {
  return frameAt(result, result.frameCount - 1);
}

test("the same seed gives the identical throw", () => {
  const dice = [makeDie(6), makeDie(20), makeDie(10, "tens")];
  const first = throwOf(dice, 7);
  const second = throwOf(dice, 7);
  assert.deepEqual(
    second.map((r) => ({ value: r.value, frameCount: r.frameCount })),
    first.map((r) => ({ value: r.value, frameCount: r.frameCount })),
  );
  first.forEach((r, i) => assert.deepEqual(second[i].frames, r.frames));
});

/** The index of the last frame that differs from the one before it, or -1 for a still throw. */
function lastMovingFrame(result: ThrowResult): number {
  let last = -1;
  for (let f = 1; f < result.frameCount; f++) {
    const now = frameAt(result, f);
    const before = frameAt(result, f - 1);
    if (now.some((value, i) => Math.abs(value - before[i]) > 1e-4)) last = f;
  }
  return last;
}

test("every die settles within 6.5 seconds, resting on its face and aligned", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const dice = [makeDie(6), makeDie(20), makeDie(4), makeDie(12)];
    const results = throwOf(dice, seed);
    results.forEach((result, i) => {
      assert.ok(result.frameCount <= MAX_FRAMES, `seed ${seed}: ${result.frameCount} frames`);
      const stoppedAt = lastMovingFrame(result);
      assert.ok(stoppedAt < 6.5 * THROW_FPS, `seed ${seed}: still moving at frame ${stoppedAt}`);
      const rest = dice[i].inradius * SIZE;
      assert.ok(Math.abs(lastFrame(result)[2] - rest) < 1e-3, `seed ${seed}: height ${lastFrame(result)[2]} vs ${rest}`);
    });
  }
});

test("every frame keeps each die's centre inside the world", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const results = throwOf([makeDie(6), makeDie(8), makeDie(20), makeDie(10, "units")], seed);
    for (const result of results) {
      for (let f = 0; f < result.frameCount; f++) {
        const [x, y] = frameAt(result, f);
        assert.ok(x >= 0 && x <= WORLD.W, `seed ${seed} frame ${f}: x ${x}`);
        assert.ok(y >= 0 && y <= WORLD.H, `seed ${seed} frame ${f}: y ${y}`);
      }
    }
  }
});

test("the reported value is the readable on top in the last frame", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const geo = makeDie(20);
    const [result] = throwOf([geo], seed);
    const [, , , qw, qx, qy, qz] = lastFrame(result);
    const orientation: [number, number, number, number] = [qw, qx, qy, qz];
    const readable = geo.readables.find((r) => r.value === result.value);
    assert.ok(readable, `seed ${seed}: value ${result.value} is not a face`);
    const top: Vec3 = rotateVector(orientation, readable.dir);
    assert.ok(top[2] > Math.cos(0.01), `seed ${seed}: top z ${top[2]} for value ${result.value}`);
    for (const other of geo.readables) {
      if (other === readable) continue;
      assert.ok(rotateVector(orientation, other.dir)[2] < top[2], `seed ${seed}: another face is higher`);
    }
  }
});

test("2000 seeded throws of a d6 give every face between 12% and 22%", () => {
  const geo = makeDie(6);
  const counts = new Map<number, number>();
  for (let seed = 1; seed <= 2000; seed++) {
    const [result] = throwOf([geo], seed);
    counts.set(result.value, (counts.get(result.value) ?? 0) + 1);
  }
  for (let face = 1; face <= 6; face++) {
    const share = (counts.get(face) ?? 0) / 2000;
    assert.ok(share >= 0.12 && share <= 0.22, `face ${face}: ${share}`);
  }
});

test("800 seeded throws of a d20 give every face at least 1.5%", () => {
  const geo = makeDie(20);
  const counts = new Map<number, number>();
  for (let seed = 1; seed <= 800; seed++) {
    const [result] = throwOf([geo], seed);
    counts.set(result.value, (counts.get(result.value) ?? 0) + 1);
  }
  for (let face = 1; face <= 20; face++) {
    const share = (counts.get(face) ?? 0) / 800;
    assert.ok(share >= 0.015, `face ${face}: ${share}`);
  }
});

test("a throw of 20 dice completes and returns 20 results", () => {
  const dice = Array.from({ length: 20 }, (_, i) => makeDie(i % 2 === 0 ? 6 : 20));
  const results = throwOf(dice, 99);
  assert.equal(results.length, 20);
  const frameCount = results[0].frameCount;
  for (const result of results) {
    assert.equal(result.frameCount, frameCount);
    assert.equal(result.frames.length, frameCount * 7);
    assert.ok(result.frameCount <= MAX_FRAMES);
  }
});

test("launched dice start near the origin and every velocity points up the screen", () => {
  const dice = Array.from({ length: 20 }, () => makeDie(6));
  const specs = launchSpecs(dice, SIZE, WORLD, ORIGIN, mulberry32(5));
  assert.equal(specs.length, 20);
  for (const spec of specs) {
    assert.ok(Math.abs(spec.p[0] - ORIGIN[0]) <= 16, `x ${spec.p[0]}`);
    assert.ok(Math.abs(spec.p[1] - ORIGIN[1]) <= 16, `y ${spec.p[1]}`);
    assert.ok(spec.v[1] < 0, `vy ${spec.v[1]}`);
  }
});
