import { test } from "node:test";
import assert from "node:assert/strict";
import { dot, random, rotateVector, type Quat, type Vec3 } from "../src/rules/diceMath.ts";
import { makeDie, poseShowing, type DieKind, type SolidSides } from "../src/rules/diceSolids.ts";
import { hexToRgb, projectDie, type DieProjection, type ProjectionStyle } from "../src/rules/diceProjection.ts";

const DICE: { name: string; sides: SolidSides; kind: DieKind }[] = [
  { name: "d4", sides: 4, kind: "std" },
  { name: "d6", sides: 6, kind: "std" },
  { name: "d8", sides: 8, kind: "std" },
  { name: "d10", sides: 10, kind: "std" },
  { name: "d10 tens", sides: 10, kind: "tens" },
  { name: "d12", sides: 12, kind: "std" },
  { name: "d20", sides: 20, kind: "std" },
];

const SIZE = 40;
const STYLE: ProjectionStyle = { base: [217, 20, 20], ink: [255, 255, 255], dropped: false };
const DROPPED_STYLE: ProjectionStyle = { base: [104, 108, 116], ink: [210, 210, 210], dropped: true };
const VIEWER: Vec3 = [0, 0, 1];

/** A random source that is the same on every run, so the poses are reproducible. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function assertNoShearAndUniformScale(transform: readonly number[]) {
  assert.equal(transform.length, 6, `not six matrix numbers: ${JSON.stringify(transform)}`);
  assert.ok(transform.every((value) => typeof value === "number" && Number.isFinite(value)), `not numbers: ${JSON.stringify(transform)}`);
  const [a, b, c, d] = transform;
  assert.ok(Math.abs(a * c + b * d) < 1e-3 * Math.hypot(a, b) * Math.hypot(c, d), `sheared: ${transform}`);
  assert.ok(Math.hypot(a, b) > 0, `collapsed: ${transform}`);
  assert.ok(Math.abs(Math.hypot(a, b) - Math.hypot(c, d)) < 1e-3, `non-uniform scale: ${transform}`);
}

test("the face that reads the value is visible and its labels are upright", () => {
  for (const { name, sides, kind } of DICE) {
    const geo = makeDie(sides, kind);
    for (const readable of geo.readables) {
      const projection = projectDie(geo, poseShowing(geo, readable.value), SIZE, STYLE);
      if (sides === 4) {
        // A d4 reads on a vertex, and the faces around it are tilted toward the viewer, so their
        // labels are foreshortened. Only the presence of the reading is checked here.
        const labels = projection.faces
          .filter((face) => face.visible)
          .flatMap((face) => face.labels)
          .filter((label) => label.kind === "text" && label.text === String(readable.value));
        assert.ok(labels.length > 0, `${name} shows ${readable.value} on no visible face`);
        continue;
      }
      const index = geo.faces.findIndex((face) => dot(face.normal, readable.dir) > 1 - 1e-9);
      assert.ok(index >= 0, `${name} has no face for ${readable.value}`);
      const face = projection.faces[index];
      assert.equal(face.visible, true, `${name} face for ${readable.value} is hidden`);
      assert.ok(face.labels.length > 0, `${name} face for ${readable.value} has no label`);
      assertNoShearAndUniformScale(face.labels[0].transform);
    }
  }
});

test("a face is visible exactly when its normal points toward the viewer", () => {
  const next = seeded(7);
  for (const { name, sides, kind } of DICE) {
    const geo = makeDie(sides, kind);
    for (let trial = 0; trial < 20; trial++) {
      const q: Quat = random(next);
      const projection = projectDie(geo, q, SIZE, STYLE);
      geo.faces.forEach((face, i) => {
        const toward = dot(rotateVector(q, face.normal), VIEWER) > 0.004;
        assert.equal(projection.faces[i].visible, toward, `${name} face ${i} on trial ${trial}`);
      });
    }
  }
});

test("faces keep geometry order and their corners follow the rotated vertices", () => {
  const next = seeded(11);
  for (const { name, sides, kind } of DICE) {
    const geo = makeDie(sides, kind);
    const q: Quat = random(next);
    const projection = projectDie(geo, q, SIZE, STYLE);
    assert.equal(projection.faces.length, geo.faces.length, name);
    geo.faces.forEach((face, i) => {
      const drawn = projection.faces[i];
      assert.equal(drawn.labels.length, face.labels.length, `${name} face ${i} labels`);
      assert.equal(drawn.corners.length, face.vertexIndexes.length, `${name} face ${i} corners`);
      face.vertexIndexes.forEach((vi, k) => {
        const v = rotateVector(q, geo.verts[vi]);
        assert.ok(Math.abs(drawn.corners[k][0] - v[0] * SIZE) < 0.05, `${name} face ${i} x`);
        assert.ok(Math.abs(drawn.corners[k][1] + v[1] * SIZE) < 0.05, `${name} face ${i} y`);
      });
    });
  }
});

test("a dropped die changes only its colours", () => {
  const next = seeded(3);
  for (const { name, sides, kind } of DICE) {
    const geo = makeDie(sides, kind);
    const q: Quat = random(next);
    const lit = projectDie(geo, q, SIZE, STYLE);
    const dropped = projectDie(geo, q, SIZE, DROPPED_STYLE);
    lit.faces.forEach((face, i) => {
      const other = dropped.faces[i];
      assert.equal(other.visible, face.visible, `${name} face ${i} visible`);
      assert.deepEqual(other.corners, face.corners, `${name} face ${i} corners`);
      assert.equal(other.labels.length, face.labels.length, `${name} face ${i} labels`);
      face.labels.forEach((label, k) => {
        const twin = other.labels[k];
        assert.equal(twin.kind, label.kind, `${name} label ${k} kind`);
        assert.deepEqual(twin.transform, label.transform, `${name} label ${k} transform`);
        if (label.kind === "text" && twin.kind === "text") assert.equal(twin.text, label.text);
        if (label.kind === "pips" && twin.kind === "pips") assert.deepEqual(twin.pips, label.pips);
      });
      if (face.visible) assert.notEqual(other.fill, face.fill, `${name} face ${i} fill`);
    });
  }
});

test("a d6 face carries as many pips as the value it reads", () => {
  const geo = makeDie(6);
  const projection = projectDie(geo, poseShowing(geo, 3, 0.4), SIZE, STYLE);
  geo.faces.forEach((face, i) => {
    const readable = geo.readables.find((r) => r.dir === face.normal);
    assert.ok(readable, `face ${i} reads nothing`);
    const labels = projection.faces[i].labels;
    assert.equal(labels.length, 1, `face ${i} labels`);
    const [only] = labels;
    assert.equal(only.kind === "pips" ? only.pips.length : -1, readable.value, `face ${i} pips`);
  });
});

test("the same pose gives the same projection", () => {
  for (const { sides, kind } of DICE) {
    const geo = makeDie(sides, kind);
    const q = poseShowing(geo, 1, 1.1);
    const first: DieProjection = projectDie(geo, q, SIZE, STYLE);
    const second: DieProjection = projectDie(geo, q, SIZE, STYLE);
    assert.deepEqual(second, first);
  }
});

test("hexToRgb reads a six digit colour", () => {
  assert.deepEqual(hexToRgb("#d91414"), [217, 20, 20]);
  assert.deepEqual(hexToRgb("#ffffff"), [255, 255, 255]);
});
