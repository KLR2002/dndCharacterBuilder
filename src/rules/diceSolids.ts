import { add, cross, dot, length, normalize, quatFromAxisAngle, quatMultiply, quatFromTo, scale, sub, type Quat, type Vec3 } from "./diceMath.ts";

/** "std" prints 1 to sides; "tens" and "units" are the two d10s of a d100. */
export type DieKind = "std" | "tens" | "units";
export type SolidSides = 4 | 6 | 8 | 10 | 12 | 20;

export type DieLabel =
  | { kind: "text"; text: string; at: Vec3; up: Vec3; right: Vec3; size: number }
  | { kind: "pips"; value: number; at: Vec3; up: Vec3; right: Vec3; size: number };

export type DieFace = {
  vertexIndexes: number[];
  /** Unit normal pointing away from the centre of the solid. */
  normal: Vec3;
  centre: Vec3;
  /** Distance from the face centre to the nearest edge line, which bounds a label's size. */
  clearance: number;
  up: Vec3;
  right: Vec3;
  labels: DieLabel[];
};

/** A body direction and the value that reads when it points up. */
export type Readable = { value: number; dir: Vec3 };

export type DieGeometry = {
  sides: SolidSides;
  kind: DieKind;
  verts: Vec3[];
  faces: DieFace[];
  readables: Readable[];
  inradius: number;
};

export type SolidPlan = { solid: boolean; bodies: 0 | 1 | 2 };

const PHI = (1 + Math.sqrt(5)) / 2;
const STANDARD_SIDES: ReadonlySet<number> = new Set([4, 6, 8, 10, 12, 20]);

function centroid(points: Vec3[]): Vec3 {
  const sum = points.reduce<Vec3>((acc, p) => add(acc, p), [0, 0, 0]);
  return scale(sum, 1 / points.length);
}

/** Orders the vertex indexes of one face counter-clockwise around its normal. */
function orderAround(verts: Vec3[], indexes: number[], normal: Vec3): number[] {
  const c = centroid(indexes.map((i) => verts[i]));
  const u = normalize(sub(verts[indexes[0]], c));
  const w = cross(normal, u);
  const angle = (i: number) => {
    const d = sub(verts[i], c);
    return Math.atan2(dot(d, w), dot(d, u));
  };
  return indexes.slice().sort((i, j) => angle(i) - angle(j));
}

/** Faces of a convex solid: for each outward normal, the vertices lying furthest along it. */
function hullFaces(verts: Vec3[], normals: Vec3[]): number[][] {
  return normals.map((nv) => {
    const n = normalize(nv);
    const max = Math.max(...verts.map((v) => dot(v, n)));
    const indexes: number[] = [];
    verts.forEach((v, i) => {
      if (dot(v, n) > max - 1e-6) indexes.push(i);
    });
    return orderAround(verts, indexes, n);
  });
}

const ICOSA: Vec3[] = [];
for (const a of [1, -1]) {
  for (const b of [1, -1]) {
    ICOSA.push([0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]);
  }
}

/** The twenty face centres of the icosahedron, which are the corners of a dodecahedron. */
const ICOSA_FACE_CENTRES: Vec3[] = (() => {
  const out: Vec3[] = [];
  const edge = (x: number, y: number) => Math.abs(length(sub(ICOSA[x], ICOSA[y])) - 2) < 1e-6;
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      for (let k = j + 1; k < 12; k++) {
        if (edge(i, j) && edge(j, k) && edge(i, k)) out.push(centroid([ICOSA[i], ICOSA[j], ICOSA[k]]));
      }
    }
  }
  return out;
})();

const CUBE_CORNERS: Vec3[] = [];
for (const x of [1, -1]) {
  for (const y of [1, -1]) {
    for (const z of [1, -1]) CUBE_CORNERS.push([x, y, z]);
  }
}

const OCTA_CORNERS: Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Raw vertices and face index lists. The d10 is a pentagonal trapezohedron with kite faces. */
const SOLIDS: Record<SolidSides, () => { verts: Vec3[]; faces: number[][] }> = {
  4: () => {
    const verts: Vec3[] = [
      [1, 1, 1],
      [1, -1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
    ];
    return { verts, faces: hullFaces(verts, verts.map((v) => scale(v, -1))) };
  },
  6: () => ({ verts: CUBE_CORNERS, faces: hullFaces(CUBE_CORNERS, OCTA_CORNERS) }),
  8: () => ({ verts: OCTA_CORNERS, faces: hullFaces(OCTA_CORNERS, CUBE_CORNERS) }),
  12: () => ({ verts: ICOSA_FACE_CENTRES, faces: hullFaces(ICOSA_FACE_CENTRES, ICOSA) }),
  20: () => ({ verts: ICOSA, faces: hullFaces(ICOSA, ICOSA_FACE_CENTRES) }),
  10: () => {
    const cosine = Math.cos(Math.PI / 5);
    const h = (1 - cosine) / (1 + cosine);
    const r = 0.88;
    const degrees = (d: number) => (d * Math.PI) / 180;
    const verts: Vec3[] = [
      [0, 0, 1],
      [0, 0, -1],
    ];
    for (let i = 0; i < 5; i++) verts.push([r * Math.cos(degrees(72 * i)), r * Math.sin(degrees(72 * i)), h]);
    for (let i = 0; i < 5; i++) {
      verts.push([r * Math.cos(degrees(36 + 72 * i)), r * Math.sin(degrees(36 + 72 * i)), -h]);
    }
    const upper = (i: number) => 2 + (((i % 5) + 5) % 5);
    const lower = (i: number) => 7 + (((i % 5) + 5) % 5);
    const faces: number[][] = [];
    for (let i = 0; i < 5; i++) faces.push([0, upper(i), lower(i), upper(i + 1)]);
    for (let j = 0; j < 5; j++) faces.push([1, lower(j), upper(j + 1), lower(j + 1)]);
    return { verts, faces };
  },
};

function buildFace(verts: Vec3[], vertexIndexes: number[]): DieFace {
  const points = vertexIndexes.map((i) => verts[i]);
  const centre = centroid(points);
  let normal = normalize(cross(sub(points[1], points[0]), sub(points[2], points[0])));
  if (dot(normal, centre) < 0) normal = scale(normal, -1);
  let clearance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    clearance = Math.min(clearance, length(cross(sub(b, a), sub(centre, a))) / length(sub(b, a)));
  }
  const toCorner = sub(points[0], centre);
  const up = normalize(sub(toCorner, scale(normal, dot(toCorner, normal))));
  return { vertexIndexes, normal, centre, clearance, up, right: cross(up, normal), labels: [] };
}

function oppositeFace(faces: DieFace[], i: number): number {
  let best = -1;
  let bestSum = Infinity;
  faces.forEach((face, j) => {
    const sum = dot(faces[i].normal, face.normal) + 1;
    if (j !== i && sum < bestSum) {
      bestSum = sum;
      best = j;
    }
  });
  return best;
}

/** The value of each face: opposite faces sum to sides + 1. */
function faceValues(sides: number, faces: DieFace[]): number[] {
  const values = new Array<number>(sides).fill(0);
  let next = 1;
  for (let i = 0; i < sides; i++) {
    if (values[i]) continue;
    const j = oppositeFace(faces, i);
    values[i] = next;
    values[j] = sides + 1 - next;
    next++;
  }
  return values;
}

function printedText(value: number, kind: DieKind): string {
  if (kind === "units") return String(value % 10);
  if (kind === "tens") return String((value % 10) * 10).padStart(2, "0");
  return String(value);
}

const cache = new Map<string, DieGeometry>();

export function makeDie(sides: SolidSides, kind: DieKind = "std"): DieGeometry {
  const key = `${sides}:${kind}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const raw = SOLIDS[sides]();
  const maxLength = Math.max(...raw.verts.map(length));
  const verts = raw.verts.map((v) => scale(v, 1 / maxLength));
  const faces = raw.faces.map((indexes) => buildFace(verts, indexes));
  const readables: Readable[] = [];

  if (sides === 4) {
    verts.forEach((v, i) => readables.push({ value: i + 1, dir: normalize(v) }));
    faces.forEach((face) => {
      for (const vi of face.vertexIndexes) {
        const toCorner = sub(verts[vi], face.centre);
        const up = normalize(toCorner);
        face.labels.push({
          kind: "text",
          text: String(vi + 1),
          at: add(face.centre, scale(toCorner, 0.52)),
          up,
          right: cross(up, face.normal),
          size: 0.27,
        });
      }
    });
  } else {
    const values = faceValues(sides, faces);
    faces.forEach((face, i) => {
      readables.push({ value: values[i], dir: face.normal });
      if (sides === 6) {
        face.labels.push({ kind: "pips", value: values[i], at: face.centre, up: face.up, right: face.right, size: face.clearance });
        return;
      }
      let at = face.centre;
      let size = face.clearance * (sides === 12 ? 1.12 : sides === 20 ? 1.32 : 1.2);
      if (sides === 10) {
        const apex = verts[face.vertexIndexes[0]];
        const farTip = verts[face.vertexIndexes[2]];
        at = add(apex, scale(sub(farTip, apex), 0.6));
        size = 0.34;
      }
      let text = printedText(values[i], kind);
      if (text === "6" || text === "9") text += ".";
      face.labels.push({ kind: "text", text, at, up: face.up, right: face.right, size });
    });
  }

  const inradius = Math.min(...faces.map((face) => dot(face.normal, face.centre)));
  const geometry: DieGeometry = { sides, kind, verts, faces, readables, inradius };
  cache.set(key, geometry);
  return geometry;
}

/** The orientation that rests with `value` on top, turned by `yaw` about the vertical. */
export function poseShowing(geo: DieGeometry, value: number, yaw = 0): Quat {
  const readable = geo.readables.find((r) => r.value === value);
  if (!readable) throw new Error(`a ${geo.sides}-sided die has no face showing ${value}`);
  return quatMultiply(quatFromAxisAngle([0, 0, 1], yaw), quatFromTo(readable.dir, [0, 0, 1]));
}

/** Splits a value from 1 to 100 into the readings of the tens die and the units die (each 1 to 10). */
export function d100Parts(value: number): { tens: number; units: number } {
  const units = ((value - 1) % 10) + 1;
  const tens = (value - units) / 10;
  return { tens: tens === 0 ? 10 : tens, units };
}

/** The value from 1 to 100 for the readings of the tens die and the units die (each 1 to 10). */
export function d100Value(tensReading: number, unitsReading: number): number {
  return (tensReading % 10) * 10 + unitsReading;
}

/**
 * Decides which dice are thrown as solids, in order. A standard die takes one body, a d100 two,
 * and every other die none. The first die that needs more bodies than remain is digital, and
 * so is every die after it.
 */
export function planSolidDice(sidesList: readonly number[], cap: number): SolidPlan[] {
  let remaining = cap;
  let overflowed = false;
  return sidesList.map((sides) => {
    const bodies = sides === 100 ? 2 : STANDARD_SIDES.has(sides) ? 1 : 0;
    if (overflowed || bodies === 0) return { solid: false, bodies: 0 };
    if (bodies > remaining) {
      overflowed = true;
      return { solid: false, bodies: 0 };
    }
    remaining -= bodies;
    return { solid: true, bodies };
  });
}
