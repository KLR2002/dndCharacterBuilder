import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { add, cross, dot, fraction, integrate, length, nlerp, normalize, quatFromAxisAngle, quatFromTo, quatMultiply, random, rotateVector, scale, sub, type Quat, type Vec3 } from "../src/rules/diceMath.ts";
import { d100Parts, d100Value, makeDie, planSolidDice, poseShowing, type DieGeometry, type DieKind, type SolidSides } from "../src/rules/diceSolids.ts";

const SOLID_DICE: { name: string; sides: SolidSides; kind: DieKind }[] = [
  { name: "d4", sides: 4, kind: "std" },
  { name: "d6", sides: 6, kind: "std" },
  { name: "d8", sides: 8, kind: "std" },
  { name: "d10", sides: 10, kind: "std" },
  { name: "d10 tens", sides: 10, kind: "tens" },
  { name: "d10 units", sides: 10, kind: "units" },
  { name: "d12", sides: 12, kind: "std" },
  { name: "d20", sides: 20, kind: "std" },
];

const EPSILON = 1e-9;

function assertVecNear(actual: Vec3 | Quat, expected: Vec3 | Quat, tolerance = 1e-9) {
  assert.equal(actual.length, expected.length);
  actual.forEach((component, i) => {
    assert.ok(Math.abs(component - expected[i]) < tolerance, `component ${i}: ${component} vs ${expected[i]}`);
  });
}

/** A random source that cycles through fixed values in [0, 1). */
function cycling(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

for (const { name, sides, kind } of SOLID_DICE) {
  test(`${name}: every face is planar and its normal points away from the centre`, () => {
    const geo = makeDie(sides, kind);
    for (const face of geo.faces) {
      const offset = dot(geo.verts[face.vertexIndexes[0]], face.normal);
      for (const i of face.vertexIndexes) {
        assert.ok(Math.abs(dot(geo.verts[i], face.normal) - offset) < EPSILON, "face vertices lie in one plane");
      }
      assert.ok(Math.abs(length(face.normal) - 1) < EPSILON, "normal is a unit vector");
      assert.ok(dot(face.normal, face.centre) > 0, "normal points away from the centre");
    }
  });

  test(`${name}: the face count equals the sides`, () => {
    assert.equal(makeDie(sides, kind).faces.length, sides);
  });

  test(`${name}: the readables hold every value from 1 to the sides once`, () => {
    const geo = makeDie(sides, kind);
    const values = geo.readables.map((readable) => readable.value).sort((a, b) => a - b);
    assert.deepEqual(values, Array.from({ length: sides }, (_, i) => i + 1));
  });

  test(`${name}: poseShowing puts each value on top`, () => {
    const geo = makeDie(sides, kind);
    for (const yaw of [0, 1.3]) {
      for (const asked of geo.readables) {
        const pose = poseShowing(geo, asked.value, yaw);
        let top = geo.readables[0];
        let topHeight = -Infinity;
        for (const candidate of geo.readables) {
          const height = rotateVector(pose, candidate.dir)[2];
          if (height > topHeight) {
            topHeight = height;
            top = candidate;
          }
        }
        assert.equal(top.value, asked.value, `${name} showing ${asked.value} at yaw ${yaw}`);
        assert.ok(topHeight > 1 - EPSILON, "the top readable points straight up");
      }
    }
  });
}

for (const { name, sides, kind } of SOLID_DICE.filter((die) => die.sides !== 4)) {
  test(`${name}: opposite faces sum to sides + 1`, () => {
    const geo = makeDie(sides, kind);
    for (const readable of geo.readables) {
      const opposite = geo.readables.find((other) => dot(other.dir, readable.dir) < -1 + 1e-6);
      assert.ok(opposite, `${name}: value ${readable.value} has an opposite face`);
      assert.equal(readable.value + opposite.value, sides + 1);
    }
  });
}

test("the d4 readables are its four corners and each corner's number is printed on the three faces around it", () => {
  const geo = makeDie(4, "std");
  assert.equal(geo.readables.length, 4);
  const printed = new Map<string, number>();
  for (const face of geo.faces) {
    for (const label of face.labels) {
      if (label.kind === "text") printed.set(label.text, (printed.get(label.text) ?? 0) + 1);
    }
  }
  assert.deepEqual([...printed.entries()].sort(), [["1", 3], ["2", 3], ["3", 3], ["4", 3]]);
});

test("the d10 faces are kites: apex, side, far tip, side", () => {
  const geo = makeDie(10, "std");
  for (const face of geo.faces) {
    assert.equal(face.vertexIndexes.length, 4);
    const [apex, side, far, otherSide] = face.vertexIndexes.map((i) => geo.verts[i]);
    assert.ok(Math.abs(length(sub(apex, side)) - length(sub(apex, otherSide))) < EPSILON, "the apex edges are equal");
    assert.ok(Math.abs(length(sub(far, side)) - length(sub(far, otherSide))) < EPSILON, "the far-tip edges are equal");
  }
});

/** The text each face prints, with the underline mark on 6 and 9 removed. */
function printedFaceTexts(geo: DieGeometry): string[] {
  return geo.faces.map((face) => {
    const label = face.labels[0];
    if (label.kind !== "text") throw new Error("expected a text label");
    return label.text.replace(/\.$/, "");
  });
}

test("a lone d10 prints 1 to 10, with 10 printed as 10", () => {
  const geo = makeDie(10, "std");
  const texts = printedFaceTexts(geo);
  geo.readables.forEach((readable, i) => assert.equal(texts[i], String(readable.value)));
});

test("the units d10 prints 0 to 9, with value 10 printed as 0", () => {
  const geo = makeDie(10, "units");
  const expected: Record<number, string> = { 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "0" };
  const texts = printedFaceTexts(geo);
  geo.readables.forEach((readable, i) => assert.equal(texts[i], expected[readable.value]));
});

test("the tens d10 prints 00 to 90, with value 10 printed as 00", () => {
  const geo = makeDie(10, "tens");
  const expected: Record<number, string> = { 1: "10", 2: "20", 3: "30", 4: "40", 5: "50", 6: "60", 7: "70", 8: "80", 9: "90", 10: "00" };
  const texts = printedFaceTexts(geo);
  geo.readables.forEach((readable, i) => assert.equal(texts[i], expected[readable.value]));
});

test("d6 faces carry pips with the value of their readable", () => {
  const geo = makeDie(6, "std");
  geo.faces.forEach((face, i) => {
    assert.equal(face.labels.length, 1);
    assert.equal(face.labels[0].kind, "pips");
    if (face.labels[0].kind === "pips") assert.equal(face.labels[0].value, geo.readables[i].value);
  });
});

test("d100Value inverts d100Parts for every value from 1 to 100", () => {
  for (let value = 1; value <= 100; value++) {
    const { tens, units } = d100Parts(value);
    assert.ok(tens >= 1 && tens <= 10, `tens reading for ${value}`);
    assert.ok(units >= 1 && units <= 10, `units reading for ${value}`);
    assert.equal(d100Value(tens, units), value);
  }
});

test("d100Value gives 1 to 100 once each over all tens and units readings", () => {
  const values = new Set<number>();
  for (let tens = 1; tens <= 10; tens++) {
    for (let units = 1; units <= 10; units++) values.add(d100Value(tens, units));
  }
  assert.equal(values.size, 100);
  assert.ok([...values].every((value) => value >= 1 && value <= 100));
});

test("the tens and units readings 00 with 0 give 10, and 90 with 0 give 100", () => {
  assert.equal(d100Value(10, 10), 10);
  assert.equal(d100Value(9, 10), 100);
});

test("planSolidDice makes d6, d6, d100 and d20 solids and the d3 digital", () => {
  const plan = planSolidDice([6, 6, 100, 3, 20], 20);
  assert.deepEqual(plan, [
    { solid: true, bodies: 1 },
    { solid: true, bodies: 1 },
    { solid: true, bodies: 2 },
    { solid: false, bodies: 0 },
    { solid: true, bodies: 1 },
  ]);
});

test("with a cap of 3 the d100 no longer fits after two d6, and the d20 after it is digital too", () => {
  const plan = planSolidDice([6, 6, 100, 20], 3);
  assert.deepEqual(plan.map((die) => die.solid), [true, true, false, false]);
  assert.deepEqual(plan.map((die) => die.bodies), [1, 1, 0, 0]);
});

test("a plan of 25 d6 with a cap of 20 has 20 solids", () => {
  const plan = planSolidDice(Array.from({ length: 25 }, () => 6), 20);
  assert.equal(plan.filter((die) => die.solid).length, 20);
});

test("quaternions rotate a vector about an axis", () => {
  const quarterTurn = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
  assertVecNear(rotateVector(quarterTurn, [1, 0, 0]), [0, 1, 0]);
});

test("fromTo rotates one direction onto another, opposite ones included", () => {
  const a = normalize([1, 2, 3]);
  const b = normalize([-2, 0, 1]);
  assertVecNear(rotateVector(quatFromTo(a, b), a), b);
  assertVecNear(rotateVector(quatFromTo([0, 0, 1], [0, 0, -1]), [0, 0, 1]), [0, 0, -1]);
});

test("quaternion multiplication composes rotations", () => {
  const qa = quatFromAxisAngle([1, 0, 0], 0.7);
  const qb = quatFromAxisAngle([0, 1, 0], 1.1);
  const v: Vec3 = [0.2, -0.5, 0.9];
  assertVecNear(rotateVector(quatMultiply(qa, qb), v), rotateVector(qa, rotateVector(qb, v)));
});

test("nlerp returns its ends at t = 0 and t = 1", () => {
  const a = quatFromAxisAngle([0, 0, 1], 0.3);
  const b = quatFromAxisAngle([1, 0, 0], 2.0);
  assertVecNear(nlerp(a, b, 0), a);
  assertVecNear(nlerp(a, b, 1), b);
});

test("fraction of a rotation: 0 is no turn, 1 is the whole turn, and two halves make the whole", () => {
  const q = quatFromAxisAngle([0, 1, 0], 1.2);
  assertVecNear(fraction(q, 1), q);
  assertVecNear(fraction(q, 0), [1, 0, 0, 0]);
  const half = fraction(q, 0.5);
  assertVecNear(quatMultiply(half, half), q);
});

test("integrating a constant spin turns the die by the spin times the time", () => {
  let q: Quat = [1, 0, 0, 0];
  for (let step = 0; step < 1000; step++) q = integrate(q, [0, 0, 2], 0.001);
  const turned = rotateVector(q, [1, 0, 0]);
  assert.ok(Math.abs(turned[0] - Math.cos(2)) < 1e-2);
  assert.ok(Math.abs(turned[1] - Math.sin(2)) < 1e-2);
});

test("a random orientation is a unit quaternion and uses only the source it is given", () => {
  const first = random(cycling([0.1, 0.7, 0.3]));
  const second = random(cycling([0.1, 0.7, 0.3]));
  assertVecNear(first, second);
  for (const source of [cycling([0, 0, 0]), cycling([0.99, 0.5, 0.2]), cycling([0.4, 0.9, 0.6])]) {
    const q = random(source);
    const norm = Math.hypot(q[0], q[1], q[2], q[3]);
    assert.ok(Math.abs(norm - 1) < EPSILON);
  }
});

test("diceMath and diceSolids import nothing from React or React Native", () => {
  for (const file of ["diceMath.ts", "diceSolids.ts"]) {
    const source = readFileSync(new URL(`../src/rules/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s+["']react(-native)?["']/);
  }
});

test("every exported function in diceMath starts with the worklet directive", () => {
  const source = readFileSync(new URL("../src/rules/diceMath.ts", import.meta.url), "utf8");
  const functions = source.match(/^export function \w+\([^)]*\)[^{]*\{\n\s*'worklet';/gm) ?? [];
  const exported = source.match(/^export function /gm) ?? [];
  assert.ok(exported.length > 0);
  assert.equal(functions.length, exported.length);
});

test("the scale and cross helpers agree with the vector identities", () => {
  const a: Vec3 = [1, 2, 3];
  const b: Vec3 = [-1, 0, 2];
  assertVecNear(scale(a, 2), [2, 4, 6]);
  assertVecNear(add(a, b), [0, 2, 5]);
  assertVecNear(cross(a, b), [4, -5, 2]);
  assert.equal(dot(a, b), 5);
});
