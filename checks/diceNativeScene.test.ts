import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { droppedFlags, throwScene, tumbleScene } from "../src/components/dice/nativeDiceScene.ts";
import { makeDie, poseShowing } from "../src/rules/diceSolids.ts";

const KOTLIN_VIEW = new URL("../modules/dice-canvas/android/src/main/java/expo/modules/dicecanvas/DiceCanvasView.kt", import.meta.url);
const ACCENT = { primary: "#c0392b", text: "#ffffff" };
const FRAME_COUNT = 3;

const throwBodies = () => [
  { geo: makeDie(20), frames: new Float32Array(FRAME_COUNT * 7).fill(0.5), accent: ACCENT },
  { geo: makeDie(6), frames: new Float32Array(FRAME_COUNT * 7).fill(0.25), accent: ACCENT },
];

const tumbleBodies = () => [
  {
    geo: makeDie(20),
    accent: ACCENT,
    target: poseShowing(makeDie(20), 3, 0.4),
    axis: [0, 0, 1] as const,
    spin: 4,
    cx: 36,
    cy: 42,
    delay: 0,
  },
  {
    geo: makeDie(6),
    accent: ACCENT,
    target: poseShowing(makeDie(6), 5, 1.1),
    axis: [1, 0, 0] as const,
    spin: 6,
    cx: 114,
    cy: 42,
    delay: 45,
  },
];

/** The names of every key the Kotlin scene parser reads, from its `get`, `opt` and `has` calls. */
function keysKotlinReads(): string[] {
  const source = readFileSync(KOTLIN_VIEW, "utf8");
  const pattern = /(?:getString|getJSONArray|getDouble|getInt|optInt|optDouble|has|doubles)\(\s*(?:\w+\s*,\s*)?"(\w+)"/g;
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))];
}

function keysOf(value: unknown, into: Set<string>): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, into));
  else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      keysOf(child, into);
    }
  }
  return into;
}

test("a changed dropped flag with the same bodies leaves the scene string identical", () => {
  const bodies = throwBodies();
  const redrawn = bodies.map((body) => ({ ...body, dropped: true }));
  assert.equal(throwScene(40, FRAME_COUNT, redrawn), throwScene(40, FRAME_COUNT, bodies));

  const tumble = tumbleBodies();
  const tumbleRedrawn = tumble.map((body) => ({ ...body, dropped: true }));
  assert.equal(tumbleScene(72, tumbleRedrawn), tumbleScene(72, tumble));
});

test("dropped flags are one character per die, 1 for a dropped die", () => {
  assert.equal(droppedFlags([false, true, false]), "010");
  assert.equal(droppedFlags([]), "");
});

test("the Throw scene has the fields the Kotlin parser reads, with the frame count and frames of each body", () => {
  const scene = JSON.parse(throwScene(40, FRAME_COUNT, throwBodies()));
  assert.equal(scene.mode, "throw");
  assert.equal(scene.size, 40);
  assert.equal(scene.frameCount, FRAME_COUNT);
  assert.equal(scene.bodies.length, 2);
  for (const body of scene.bodies) {
    assert.equal(body.frames.length, FRAME_COUNT * 7, "frames hold seven numbers per frame");
    assert.equal(body.rest > 0, true, "rest is the inradius in px");
    assert.equal(body.base.length, 3);
    assert.equal(body.ink.length, 3);
  }
});

test("the Tumble scene has the target, axis, spin and grid position each body needs", () => {
  const scene = JSON.parse(tumbleScene(72, tumbleBodies()));
  assert.equal(scene.mode, "tumble");
  assert.equal(scene.cell, 72);
  assert.equal(scene.bodies.length, 2);
  for (const body of scene.bodies) {
    assert.equal(body.target.length, 4, "the target is a quaternion");
    assert.equal(body.axis.length, 3);
    assert.equal(typeof body.spin, "number");
    assert.equal(typeof body.cx, "number");
    assert.equal(typeof body.cy, "number");
    assert.equal(typeof body.delay, "number");
  }
});

test("every face and label of every body has the fields the Kotlin parser reads", () => {
  const read = keysKotlinReads();
  assert.ok(read.includes("labels") && read.includes("frames") && read.includes("target"), "the parser reads the keys this test checks");
  const produced = new Set([
    ...keysOf(JSON.parse(throwScene(40, FRAME_COUNT, throwBodies())), new Set()),
    ...keysOf(JSON.parse(tumbleScene(72, tumbleBodies())), new Set()),
  ]);
  for (const key of read) assert.ok(produced.has(key), `the scene has no "${key}" field the parser reads`);
});
