// Projects a solid die onto the screen for one orientation. Every function is a worklet, so a
// Reanimated worklet can call them per frame. Nothing here imports React or React Native.

import { dot, normalize, rotateVector, type Quat, type Vec3 } from "./diceMath.ts";
import type { DieGeometry } from "./diceSolids.ts";

export type Rgb = [number, number, number];

export type ProjectionStyle = { base: Rgb; ink: Rgb; dropped: boolean };

export type PipMark = { cx: number; cy: number; r: number };

/**
 * A label's 2D affine matrix as the six numbers [a, b, c, d, e, f] of SVG `matrix(a b c d e f)`. It is a
 * number array, not a transform string: Reanimated re-parses a string `transform` of an animated prop on
 * native and only accepts comma-separated values, while react-native-svg takes the six numbers as they are.
 */
export type LabelMatrix = [number, number, number, number, number, number];

export type ProjectedLabel =
  | { kind: "text"; text: string; fontSize: number; transform: LabelMatrix; fill: string }
  | { kind: "pips"; transform: LabelMatrix; fill: string; pips: PipMark[] };

export type ProjectedFace = {
  visible: boolean;
  corners: [number, number][];
  points: string;
  fill: string;
  stroke: string;
  labels: ProjectedLabel[];
};

export type DieProjection = { faces: ProjectedFace[] };

/** Parses a `#rrggbb` colour into its channels. */
export function hexToRgb(hex: string): Rgb {
  'worklet';
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The grey body and muted numerals of a die that has been dropped from the roll. */
export const DROPPED_BODY: Rgb = [104, 108, 116];
export const DROPPED_INK: Rgb = [210, 210, 210];

/** The colours of a die of an accent, or the grey of a dropped one. */
export function solidStyle(accent: { primary: string; text: string }, dropped: boolean): ProjectionStyle {
  'worklet';
  return {
    base: dropped ? DROPPED_BODY : hexToRgb(accent.primary),
    ink: dropped ? DROPPED_INK : hexToRgb(accent.text),
    dropped,
  };
}

/** The pip centres of a d6 face showing `value`, in text units, for a face of half-size `halfSize`. */
export function pipMarks(value: number, halfSize: number): PipMark[] {
  'worklet';
  const cells: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  };
  const gap = halfSize * 0.5 * 100;
  const radius = halfSize * 0.17 * 100;
  return (cells[value] ?? []).map(([a, b]) => ({ cx: a * gap, cy: b * gap, r: radius }));
}

function rgbString(c: Rgb): string {
  'worklet';
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

function rgbaString(c: Rgb, alpha: number): string {
  'worklet';
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha.toFixed(3)})`;
}

export type FaceShading = { shade: number; alpha: number };

/** The shade of a face whose normal is `normal` in screen space, and the opacity of its ink. */
export function faceShading(normal: Vec3): FaceShading {
  'worklet';
  const light = normalize([-0.35, 0.5, 0.8]);
  return {
    shade: 0.3 + 0.7 * Math.max(0, dot(normal, light)),
    alpha: Math.min(1, 0.6 + 0.4 * normal[2]),
  };
}

/**
 * The label matrix of a label whose position and axes are `at`, `right` and `up` in the die's own frame,
 * for the orientation `quaternion` and a die of `size` pixels.
 */
export function labelMatrix(quaternion: Quat, at: Vec3, right: Vec3, up: Vec3, size: number): LabelMatrix {
  'worklet';
  const labelScale = 0.01;
  const origin = rotateVector(quaternion, at);
  const rightScreen = rotateVector(quaternion, right);
  const upScreen = rotateVector(quaternion, up);
  const a = rightScreen[0] * labelScale * size;
  const b = -rightScreen[1] * labelScale * size;
  const c = -upScreen[0] * labelScale * size;
  const d = upScreen[1] * labelScale * size;
  return [a, b, c, d, origin[0] * size, -origin[1] * size];
}

/**
 * Projects every face of `geo` for the orientation `quaternion`, in geometry order. The die is
 * centred on (0, 0) and `size` is its circumradius in pixels. Screen y points down.
 */
export function projectDie(geo: DieGeometry, quaternion: Quat, size: number, style: ProjectionStyle): DieProjection {
  'worklet';
  const verts = geo.verts.map((v) => rotateVector(quaternion, v));
  const stroke = style.dropped ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.5)";

  const faces = geo.faces.map((face): ProjectedFace => {
    const normal = rotateVector(quaternion, face.normal);
    const { shade, alpha } = faceShading(normal);
    const fill = rgbString([style.base[0] * shade, style.base[1] * shade, style.base[2] * shade]);
    const corners = face.vertexIndexes.map((i): [number, number] => [verts[i][0] * size, -verts[i][1] * size]);
    const points = corners.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

    const labels = face.labels.map((label): ProjectedLabel => {
      const transform = labelMatrix(quaternion, label.at, label.right, label.up, size);
      const ink = rgbaString(style.ink, alpha);
      if (label.kind === "pips") {
        return { kind: "pips", transform, fill: ink, pips: pipMarks(label.value, label.size) };
      }
      return { kind: "text", text: label.text, fontSize: label.size * 100, transform, fill: ink };
    });

    return { visible: normal[2] > 0.004, corners, points, fill, stroke, labels };
  });

  return { faces };
}
