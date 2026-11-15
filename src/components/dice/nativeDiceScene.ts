// Builds the JSON scene the native dice canvas draws. Pure: no React, so it runs in a node test.
// The scene is the geometry, the colours and the motion. Which dice are dropped is not in it: that
// goes in its own string through droppedFlags, so a change of dropped never replays the motion.
import { hexToRgb } from "../../rules/diceProjection.ts";
import type { DieGeometry } from "../../rules/diceSolids.ts";

export type SceneAccent = { primary: string; text: string };

export type ThrowSceneBody = {
  geo: DieGeometry;
  /** Seven numbers per frame: x, y, height, then the orientation quaternion (w, x, y, z). */
  frames: ArrayLike<number>;
  accent: SceneAccent;
};

export type TumbleSceneBody = {
  geo: DieGeometry;
  accent: SceneAccent;
  target: readonly number[];
  axis: readonly number[];
  spin: number;
  /** Centre of the die's cell in px, and the delay before it starts to turn. */
  cx: number;
  cy: number;
  delay: number;
};

const geometryCache = new WeakMap<DieGeometry, object>();

/** The solid's vertices, faces and labels; cached per geometry, which the caller keeps for the life of a roll. */
function geometryJson(geo: DieGeometry): object {
  let json = geometryCache.get(geo);
  if (!json) {
    json = {
      verts: geo.verts,
      faces: geo.faces.map((face) => ({
        idx: face.vertexIndexes,
        n: face.normal,
        labels: face.labels.map((label) =>
          label.kind === "text"
            ? { text: label.text, at: label.at, right: label.right, up: label.up, size: label.size }
            : { value: label.value, at: label.at, right: label.right, up: label.up, size: label.size },
        ),
      })),
    };
    geometryCache.set(geo, json);
  }
  return json;
}

function colours(accent: SceneAccent) {
  return { base: hexToRgb(accent.primary), ink: hexToRgb(accent.text) };
}

/** Frame values to four decimals: the scene is parsed on the UI thread, so it stays short. */
const frameValue = (value: number) => Math.round(value * 1e4) / 1e4;

/** The scene of a Throw: every body's recorded frames, drawn at `size` px circumradius. */
export function throwScene(size: number, frameCount: number, bodies: readonly ThrowSceneBody[]): string {
  return JSON.stringify({
    mode: "throw",
    size,
    frameCount,
    bodies: bodies.map((body) => ({
      ...geometryJson(body.geo),
      ...colours(body.accent),
      frames: Array.from(body.frames, frameValue),
      rest: body.geo.inradius * size,
    })),
  });
}

/** The scene of a Tumble: each die's target pose, turn and place in the row of cells `cell` px across. */
export function tumbleScene(cell: number, bodies: readonly TumbleSceneBody[]): string {
  return JSON.stringify({
    mode: "tumble",
    size: cell * 0.36,
    cell,
    bodies: bodies.map((body) => ({
      ...geometryJson(body.geo),
      ...colours(body.accent),
      target: body.target,
      axis: body.axis,
      spin: body.spin,
      cx: body.cx,
      cy: body.cy,
      delay: body.delay,
    })),
  });
}

/** One character per body, "1" for a dropped die. Passed to the view as its `dropped` prop. */
export function droppedFlags(dropped: readonly boolean[]): string {
  return dropped.map((value) => (value ? "1" : "0")).join("");
}
