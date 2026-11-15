import { test } from "node:test";
import assert from "node:assert/strict";
import { drawSolidDie } from "../src/components/dice/drawSolidDie.ts";
import { rotateVector } from "../src/rules/diceMath.ts";
import { makeDie, poseShowing, type SolidSides } from "../src/rules/diceSolids.ts";

const CRIMSON = { primary: "#d91414", text: "#ffffff" };
const SIZE = 26;

/**
 * A canvas context that records the fill of each face (a face is the only path that is stroked) and the
 * text it is asked to draw.
 */
function recordingContext() {
  const fills: string[] = [];
  const texts: string[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    save() {},
    restore() {},
    translate() {},
    transform() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    arc() {},
    fill() {},
    stroke() {
      fills.push(this.fillStyle);
    },
    fillText(text: string) {
      texts.push(text);
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, texts };
}

/** The channels of an `rgb(r,g,b)` fill string. */
function channels(fill: string): number[] {
  const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(fill);
  assert.ok(m, `not an rgb fill: ${fill}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

test("a die draws one filled face for each face turned toward the viewer", () => {
  const geo = makeDie(6);
  const pose = poseShowing(geo, 3, 0.4);
  const { ctx, fills } = recordingContext();
  drawSolidDie(ctx, { geo, pose, accent: CRIMSON, dropped: false, size: SIZE, x: 0, y: 0 });
  const facing = geo.faces.filter((face) => rotateVector(pose, face.normal)[2] > 0.004).length;
  assert.equal(fills.length, facing);
  assert.ok(facing >= 1 && facing <= 3, `a d6 shows ${facing} faces to the viewer`);
});

test("a kept die is filled in shades of its accent", () => {
  const geo = makeDie(20);
  const { ctx, fills } = recordingContext();
  drawSolidDie(ctx, { geo, pose: poseShowing(geo, 14, 1.1), accent: CRIMSON, dropped: false, size: SIZE, x: 0, y: 0 });
  const base = channels("rgb(217,20,20)");
  assert.ok(fills.length > 0);
  for (const fill of fills) {
    const [r, g, b] = channels(fill);
    const shade = r / base[0];
    assert.ok(shade >= 0.3 - 0.01 && shade <= 1.01, `shade ${shade} of ${fill}`);
    assert.ok(Math.abs(g - shade * base[1]) <= 2 && Math.abs(b - shade * base[2]) <= 2, `${fill} is not a shade of the accent`);
  }
});

test("a dropped die is filled in grey on every die type", () => {
  for (const sides of [4, 6, 8, 10, 12, 20] as SolidSides[]) {
    const geo = makeDie(sides);
    const value = geo.readables[0].value;
    const { ctx, fills } = recordingContext();
    drawSolidDie(ctx, { geo, pose: poseShowing(geo, value, 0.7), accent: CRIMSON, dropped: true, size: SIZE, x: 0, y: 0 });
    assert.ok(fills.length > 0, `d${sides} draws no face`);
    for (const fill of fills) {
      const [r, g, b] = channels(fill);
      assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 16, `d${sides} dropped fill ${fill} is not grey`);
    }
  }
});

test("a d20 draws the numeral of the face that shows its value", () => {
  const geo = makeDie(20);
  const { ctx, texts } = recordingContext();
  drawSolidDie(ctx, { geo, pose: poseShowing(geo, 14, 1.1), accent: CRIMSON, dropped: false, size: SIZE, x: 0, y: 0 });
  assert.ok(texts.includes("14"), `the numerals drawn are ${texts.join(", ")}`);
});
