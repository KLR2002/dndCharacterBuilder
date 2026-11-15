import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { normalize, quatFromAxisAngle, quatMultiply, random as randomQuaternion, rotateVector, type Quat, type Vec3 } from "../src/rules/diceMath.ts";
import { launchSpecs, sampleThrow, simulateThrow } from "../src/rules/diceThrow.ts";
import { tumblePop, tumbleQuaternion } from "../src/rules/diceAnimation.ts";
import { faceShading, labelMatrix, pipMarks, projectDie, type ProjectionStyle } from "../src/rules/diceProjection.ts";
import { makeDie, poseShowing, type DieKind, type SolidSides } from "../src/rules/diceSolids.ts";

/*
 * The shared fixture of the canvas dice math. The Kotlin unit test in modules/dice-canvas reads the same
 * file. The fixture is written only by this test's recorder, and only after a deliberate change to the
 * TypeScript math:
 *   UPDATE_DICE_CANVAS_FIXTURE=1 node --experimental-strip-types --test checks/diceCanvasMath.test.ts
 */
const FIXTURE_PATH = new URL("./fixtures/diceCanvasMathFixture.json", import.meta.url);
const TOLERANCE = 1e-4;
const SIZE = 40;
const WORLD = { W: 390, H: 700 };
const STYLE: ProjectionStyle = { base: [217, 20, 20], ink: [255, 255, 255], dropped: false };
const DICE: { name: string; sides: SolidSides; kind: DieKind }[] = [
  { name: "d4", sides: 4, kind: "std" },
  { name: "d6", sides: 6, kind: "std" },
  { name: "d8", sides: 8, kind: "std" },
  { name: "d10", sides: 10, kind: "std" },
  { name: "d10 tens", sides: 10, kind: "tens" },
  { name: "d12", sides: 12, kind: "std" },
  { name: "d20", sides: 20, kind: "std" },
];

type Fixture = {
  rotateVector: { q: number[]; v: number[]; expected: number[] }[];
  quatMultiply: { a: number[]; b: number[]; expected: number[] }[];
  quatFromAxisAngle: { axis: number[]; angle: number; expected: number[] }[];
  throw: { frameCount: number; bodies: number[][]; samples: { body: number; seconds: number; expected: number[] }[] };
  tumble: { die: string; target: number[]; axis: number[]; spin: number; progress: number; expected: number[] }[];
  tumblePop: { progress: number; expected: number }[];
  pipMarks: { value: number; halfSize: number; expected: number[][] }[];
  faceShading: { normal: number[]; expected: number[] }[];
  labelMatrix: { die: string; q: number[]; at: number[]; right: number[]; up: number[]; dieSize: number; expected: number[] }[];
};

/** A deterministic source of numbers in [0, 1). */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(source: () => number, lo: number, hi: number): number {
  return lo + source() * (hi - lo);
}

function randomVector(source: () => number): number[] {
  return [between(source, -1, 1), between(source, -1, 1), between(source, -1, 1)];
}

function build(): Fixture {
  const source = seeded(20260315);

  const rotateVectorCases = Array.from({ length: 6 }, () => {
    const q = [...randomQuaternion(source)];
    const v = randomVector(source).map((x) => x * 80);
    return { q, v, expected: [...rotateVector(q as Quat, v as Vec3)] };
  });

  const quatMultiplyCases = Array.from({ length: 4 }, () => {
    const a = [...randomQuaternion(source)];
    const b = [...randomQuaternion(source)];
    return { a, b, expected: [...quatMultiply(a as Quat, b as Quat)] };
  });

  const quatFromAxisAngleCases = [0, 0.3, Math.PI / 2, Math.PI, -1.2].map((angle) => {
    const axis = randomVector(source);
    return { axis, angle, expected: [...quatFromAxisAngle(axis as Vec3, angle)] };
  });

  const dice = [makeDie(20), makeDie(6), makeDie(10)];
  const specs = launchSpecs(dice, SIZE, WORLD, [WORLD.W / 2, WORLD.H - 40], source);
  const results = simulateThrow(specs, WORLD, source);
  const frameCount = results[0].frameCount;
  const bodies = results.map((result) => Array.from(result.frames));
  const seconds = [0, 0.02, 0.37, 0.9, 1.6, 2.4, 3.1, 50];
  const samples = bodies.flatMap((_, body) =>
    seconds.map((t) => {
      const pose = sampleThrow(bodies[body], frameCount, t);
      return { body, seconds: t, expected: [pose.x, pose.y, pose.z, ...pose.q] };
    }),
  );

  const tumble = DICE.flatMap(({ name, sides, kind }) => {
    const geo = makeDie(sides, kind);
    const values = [geo.readables[0].value, geo.readables[geo.readables.length - 1].value];
    return values.flatMap((value) => {
      const target = [...poseShowing(geo, value, 0.4)];
      const axis = randomVector(source);
      const spin = between(source, -7, 7);
      return [0, 0.25, 0.6, 0.9, 1].map((progress) => ({
        die: name,
        target,
        axis,
        spin,
        progress,
        expected: [...tumbleQuaternion(target as Quat, axis as Vec3, spin, progress)],
      }));
    });
  });

  const tumblePopCases = [0, 0.1, 0.3, 0.5, 0.8, 0.95, 1].map((progress) => ({ progress, expected: tumblePop(progress) }));

  const pipCases = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((value) =>
    [SIZE, 12.5].map((halfSize) => ({
      value,
      halfSize,
      expected: pipMarks(value, halfSize).map((mark) => [mark.cx, mark.cy, mark.r]),
    })),
  );

  const shadingCases = Array.from({ length: 12 }, () => {
    const normal = normalize(randomVector(source) as Vec3);
    const { shade, alpha } = faceShading(normal);
    return { normal: [...normal], expected: [shade, alpha] };
  });

  const labelCases = DICE.flatMap(({ name, sides, kind }) => {
    const geo = makeDie(sides, kind);
    const q = poseShowing(geo, geo.readables[0].value, 0.4);
    const projection = projectDie(geo, q, SIZE, STYLE);
    return geo.faces.flatMap((face, fi) =>
      face.labels.map((label, li) => {
        const expected = labelMatrix(q, label.at, label.right, label.up, SIZE);
        const drawn = projection.faces[fi].labels[li].transform;
        assert.deepEqual(expected, drawn, `${name} face ${fi} label ${li} is not the matrix projectDie draws`);
        return { die: name, q: [...q], at: [...label.at], right: [...label.right], up: [...label.up], dieSize: SIZE, expected: [...expected] };
      }),
    );
  });

  return {
    rotateVector: rotateVectorCases,
    quatMultiply: quatMultiplyCases,
    quatFromAxisAngle: quatFromAxisAngleCases.map((c) => ({ ...c, expected: [...c.expected] })),
    throw: { frameCount, bodies, samples },
    tumble,
    tumblePop: tumblePopCases,
    pipMarks: pipCases,
    faceShading: shadingCases,
    labelMatrix: labelCases,
  };
}

function assertClose(actual: readonly number[], expected: readonly number[], label: string): void {
  assert.equal(actual.length, expected.length, `${label}: length`);
  actual.forEach((value, i) => {
    assert.ok(Math.abs(value - expected[i]) <= TOLERANCE, `${label}[${i}] is ${value}, the fixture has ${expected[i]}`);
  });
}

test("the canvas dice math reproduces the shared fixture", () => {
  if (process.env.UPDATE_DICE_CANVAS_FIXTURE) writeFileSync(FIXTURE_PATH, `${JSON.stringify(build(), null, 1)}\n`);
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture;

  fixture.rotateVector.forEach((c, i) => {
    assertClose([...rotateVector(c.q as Quat, c.v as Vec3)], c.expected, `rotateVector ${i}`);
  });
  fixture.quatMultiply.forEach((c, i) => {
    assertClose([...quatMultiply(c.a as Quat, c.b as Quat)], c.expected, `quatMultiply ${i}`);
  });
  fixture.quatFromAxisAngle.forEach((c, i) => {
    assertClose([...quatFromAxisAngle(c.axis as Vec3, c.angle)], c.expected, `quatFromAxisAngle ${i}`);
  });
  for (const s of fixture.throw.samples) {
    const pose = sampleThrow(fixture.throw.bodies[s.body], fixture.throw.frameCount, s.seconds);
    assertClose([pose.x, pose.y, pose.z, ...pose.q], s.expected, `sampleThrow body ${s.body} at ${s.seconds}`);
  }
  fixture.tumble.forEach((c, i) => {
    assertClose([...tumbleQuaternion(c.target as Quat, c.axis as Vec3, c.spin, c.progress)], c.expected, `tumble ${i} ${c.die}`);
  });
  fixture.tumblePop.forEach((c) => {
    assertClose([tumblePop(c.progress)], [c.expected], `tumblePop at ${c.progress}`);
  });
  fixture.pipMarks.forEach((c) => {
    const marks = pipMarks(c.value, c.halfSize).map((mark) => [mark.cx, mark.cy, mark.r]);
    assert.equal(marks.length, c.expected.length, `pipMarks ${c.value}: count`);
    marks.forEach((mark, i) => assertClose(mark, c.expected[i], `pipMarks ${c.value} mark ${i}`));
  });
  fixture.faceShading.forEach((c, i) => {
    const { shade, alpha } = faceShading(c.normal as Vec3);
    assertClose([shade, alpha], c.expected, `faceShading ${i}`);
  });
  fixture.labelMatrix.forEach((c, i) => {
    const matrix = labelMatrix(c.q as Quat, c.at as Vec3, c.right as Vec3, c.up as Vec3, c.dieSize);
    assertClose(matrix, c.expected, `labelMatrix ${i} ${c.die}`);
  });
});
