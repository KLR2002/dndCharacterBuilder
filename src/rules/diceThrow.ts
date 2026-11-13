import {
  fraction,
  integrate,
  nlerp,
  quatFromTo,
  quatMultiply,
  random as randomQuaternion,
  rotateVector,
  type Quat,
  type Vec3,
} from "./diceMath.ts";
import type { DieGeometry, Readable } from "./diceSolids.ts";

/** Frames per second of the recorded motion. */
export const THROW_FPS = 60;

const GRAVITY = 2600;
/** Seconds per simulation step. */
const STEP_SECONDS = 1 / 120;
const MAX_THROW_SECONDS = 6.5;
/** Collisions between dice are resolved only after this time, so the dice have left the origin. */
const COLLISION_START_SECONDS = 0.12;
/** Bodies stop when they land with less upward speed than this. */
const BOUNCE_MIN_SPEED = 90;
const FLOOR_RESTITUTION = 0.38;
const FLOOR_SPEED_KEPT = 0.8;
const FLOOR_SPIN_KEPT = 0.75;
const FLOOR_SPIN_Z_KEPT = 0.8;
const FLOOR_SPIN_NOISE = 0.006;
const FLOOR_FRICTION_RATE = 2.8;
/** How fast a rolling body's spin catches up with its speed. */
const ROLLING_BLEND_RATE = 10;
const ROLLING_SPIN_Z_DECAY = 5;
const WALL_RESTITUTION = 0.55;
const KICK_NOISE = 0.02;
const COLLISION_RESTITUTION = 0.6;
const COLLISION_SPIN_NOISE = 0.03;
/** Radius of a die's collision sphere, as a fraction of its size. */
const COLLISION_RADIUS = 0.8;
/** Below this speed a die is pulled toward the nearest face. */
const SETTLE_SPEED = 170;
const SETTLE_PULL_GAIN = 16;
const SETTLE_SPEED_LIMIT = 5;
const SETTLE_ANGLE = 0.01;
const SETTLE_SPIN_LIMIT = 0.6;

const LAUNCH_MARGIN_SIZES = 1.6;
const LAUNCH_MAX_SPEED = 1500;
const LAUNCH_SCATTER = 16;
const LAUNCH_HEIGHT: [number, number] = [60, 130];
const LAUNCH_VERTICAL_SPEED: [number, number] = [300, 600];
const LAUNCH_SPIN: [number, number] = [18, 34];
const LAUNCH_SPIN_Z: [number, number] = [-8, 8];

export type ThrowSpec = {
  geo: DieGeometry;
  /** Size of the die in px. */
  S: number;
  p: [number, number];
  z0: number;
  v: [number, number];
  vz0: number;
  q: Quat;
  w: Vec3;
};

export type ThrowResult = { value: number; frames: Float32Array; frameCount: number };

/** One body's pose at a moment of a recorded throw: its centre in px and its orientation. */
export type ThrowPose = { x: number; y: number; z: number; q: Quat };

/**
 * The pose of one body `seconds` into a recorded throw: the two frames around that time, blended
 * linearly (the orientation normalised). Times before the first frame or after the last give that frame.
 */
export function sampleThrow(frames: ArrayLike<number>, frameCount: number, seconds: number): ThrowPose {
  'worklet';
  const last = frameCount - 1;
  const f = Math.min(last, Math.max(0, seconds * THROW_FPS));
  const i0 = Math.floor(f);
  const i1 = Math.min(i0 + 1, last);
  const t = f - i0;
  const a = i0 * 7;
  const b = i1 * 7;
  const lerp = (j: number) => frames[a + j] + (frames[b + j] - frames[a + j]) * t;
  const qa: Quat = [frames[a + 3], frames[a + 4], frames[a + 5], frames[a + 6]];
  const qb: Quat = [frames[b + 3], frames[b + 4], frames[b + 5], frames[b + 6]];
  return { x: lerp(0), y: lerp(1), z: lerp(2), q: nlerp(qa, qb, t) };
}

type Body = {
  geo: DieGeometry;
  S: number;
  rest: number;
  rad: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  q: Quat;
  w: Vec3;
  settled: boolean;
  frames: number[];
};

type World = { W: number; H: number };
type Random = () => number;

/** A value in [a, b) from the injected source. */
function between(random: Random, a: number, b: number): number {
  return a + random() * (b - a);
}

function readTop(geo: DieGeometry, q: Quat): Readable {
  let best = geo.readables[0];
  let bestZ = -2;
  for (const readable of geo.readables) {
    const z = rotateVector(q, readable.dir)[2];
    if (z > bestZ) {
      bestZ = z;
      best = readable;
    }
  }
  return best;
}

/** Launch specs for `dice` thrown from `origin` toward random points of the screen. */
export function launchSpecs(
  dice: DieGeometry[],
  size: number,
  world: World,
  origin: [number, number],
  random: Random,
): ThrowSpec[] {
  return dice.map((geo) => {
    const margin = size * LAUNCH_MARGIN_SIZES;
    const tx = between(random, margin, world.W - margin);
    const ty = between(random, Math.min(margin + world.H * 0.05, world.H / 2), world.H - margin);
    const dx = tx - origin[0];
    const dy = ty - origin[1];
    const dist = Math.hypot(dx, dy) || 1;
    const speed = Math.min(LAUNCH_MAX_SPEED, (dist / 0.85) * between(random, 0.85, 1.15));
    const angle = between(random, 0, Math.PI * 2);
    const spin = between(random, LAUNCH_SPIN[0], LAUNCH_SPIN[1]);
    const p: [number, number] = [
      origin[0] + between(random, -LAUNCH_SCATTER, LAUNCH_SCATTER),
      origin[1] + between(random, -LAUNCH_SCATTER, LAUNCH_SCATTER),
    ];
    const z0 = between(random, LAUNCH_HEIGHT[0], LAUNCH_HEIGHT[1]);
    const vz0 = between(random, LAUNCH_VERTICAL_SPEED[0], LAUNCH_VERTICAL_SPEED[1]);
    const q = randomQuaternion(random);
    return {
      geo,
      S: size,
      p,
      z0,
      v: [(dx / dist) * speed, (dy / dist) * speed],
      vz0,
      q,
      w: [Math.cos(angle) * spin, Math.sin(angle) * spin, between(random, LAUNCH_SPIN_Z[0], LAUNCH_SPIN_Z[1])],
    };
  });
}

/**
 * Runs a whole throw at once. Returns, per die, the value that ends on top and its frames at
 * THROW_FPS as seven floats each (x, y, height, qw, qx, qy, qz). Every die gets the same frame count.
 */
export function simulateThrow(specs: ThrowSpec[], world: World, random: Random): ThrowResult[] {
  const bodies: Body[] = specs.map((spec) => ({
    geo: spec.geo,
    S: spec.S,
    rest: spec.geo.inradius * spec.S,
    rad: COLLISION_RADIUS * spec.S,
    x: spec.p[0],
    y: spec.p[1],
    z: spec.z0,
    vx: spec.v[0],
    vy: spec.v[1],
    vz: spec.vz0,
    q: [...spec.q],
    w: [...spec.w],
    settled: false,
    frames: [],
  }));

  const record = () => {
    for (const b of bodies) b.frames.push(b.x, b.y, b.z, b.q[0], b.q[1], b.q[2], b.q[3]);
  };
  record();

  let step = 0;
  while (step * STEP_SECONDS < MAX_THROW_SECONDS) {
    step++;
    const t = step * STEP_SECONDS;
    for (const b of bodies) if (!b.settled) stepBody(b, world, random);
    if (t > COLLISION_START_SECONDS) {
      collide(bodies, random);
      for (const b of bodies) {
        b.x = Math.min(world.W - b.rad, Math.max(b.rad, b.x));
        b.y = Math.min(world.H - b.rad, Math.max(b.rad, b.y));
      }
    }
    if (step % 2 === 0) record();
    if (bodies.every((b) => b.settled)) break;
  }

  // Safety net: a die still moving when time runs out is finished aligned on its top face.
  for (const b of bodies) {
    if (b.settled) continue;
    const top = readTop(b.geo, b.q);
    b.q = quatMultiply(quatFromTo(rotateVector(b.q, top.dir), [0, 0, 1]), b.q);
    b.z = b.rest;
    b.settled = true;
  }
  record();

  const frameCount = Math.max(...bodies.map((b) => b.frames.length / 7));
  return bodies.map((b) => {
    while (b.frames.length / 7 < frameCount) b.frames.push(...b.frames.slice(-7));
    return {
      value: readTop(b.geo, b.q).value,
      frames: Float32Array.from(b.frames),
      frameCount,
    };
  });
}

function stepBody(b: Body, world: World, random: Random): void {
  b.vz -= GRAVITY * STEP_SECONDS;
  b.z += b.vz * STEP_SECONDS;
  b.x += b.vx * STEP_SECONDS;
  b.y += b.vy * STEP_SECONDS;
  b.q = integrate(b.q, b.w, STEP_SECONDS);

  let onFloor = false;
  if (b.z <= b.rest) {
    b.z = b.rest;
    if (b.vz < -BOUNCE_MIN_SPEED) {
      const impact = -b.vz;
      b.vz = impact * FLOOR_RESTITUTION;
      b.vx *= FLOOR_SPEED_KEPT;
      b.vy *= FLOOR_SPEED_KEPT;
      const noise = impact * FLOOR_SPIN_NOISE;
      b.w = [
        b.w[0] * FLOOR_SPIN_KEPT + between(random, -noise, noise),
        b.w[1] * FLOOR_SPIN_KEPT + between(random, -noise, noise),
        b.w[2] * FLOOR_SPIN_Z_KEPT,
      ];
    } else {
      b.vz = 0;
      onFloor = true;
    }
  }

  if (onFloor) {
    const friction = Math.exp(-FLOOR_FRICTION_RATE * STEP_SECONDS);
    b.vx *= friction;
    b.vy *= friction;
    const rollRadius = b.S * COLLISION_RADIUS;
    const blend = 1 - Math.exp(-ROLLING_BLEND_RATE * STEP_SECONDS);
    b.w[0] += (-b.vy / rollRadius - b.w[0]) * blend;
    b.w[1] += (b.vx / rollRadius - b.w[1]) * blend;
    b.w[2] *= Math.exp(-ROLLING_SPIN_Z_DECAY * STEP_SECONDS);

    const speed = Math.hypot(b.vx, b.vy);
    const top = readTop(b.geo, b.q);
    const correction = quatFromTo(rotateVector(b.q, top.dir), [0, 0, 1]);
    const angle = 2 * Math.acos(Math.min(1, Math.abs(correction[0])));
    if (speed < SETTLE_SPEED) {
      const gain = SETTLE_PULL_GAIN * Math.pow(1 - speed / SETTLE_SPEED, 2);
      b.q = quatMultiply(fraction(correction, 1 - Math.exp(-gain * STEP_SECONDS)), b.q);
    }
    const spin = Math.hypot(b.w[0], b.w[1], b.w[2]);
    if (speed < SETTLE_SPEED_LIMIT && angle < SETTLE_ANGLE && spin < SETTLE_SPIN_LIMIT) {
      b.q = quatMultiply(correction, b.q);
      b.vx = 0;
      b.vy = 0;
      b.settled = true;
    }
  }

  const m = b.rad;
  if (b.x < m) {
    b.x = m;
    b.vx = Math.abs(b.vx) * WALL_RESTITUTION;
    kick(b, random);
  }
  if (b.x > world.W - m) {
    b.x = world.W - m;
    b.vx = -Math.abs(b.vx) * WALL_RESTITUTION;
    kick(b, random);
  }
  if (b.y < m) {
    b.y = m;
    b.vy = Math.abs(b.vy) * WALL_RESTITUTION;
    kick(b, random);
  }
  if (b.y > world.H - m) {
    b.y = world.H - m;
    b.vy = -Math.abs(b.vy) * WALL_RESTITUTION;
    kick(b, random);
  }
}

function kick(b: Body, random: Random): void {
  const k = Math.hypot(b.vx, b.vy) * KICK_NOISE;
  b.w[0] += between(random, -k, k);
  b.w[1] += between(random, -k, k);
}

function collide(bodies: Body[], random: Random): void {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      if (a.settled && b.settled) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.rad + b.rad;
      if (d >= min || d < 1e-6 || Math.abs(a.z - b.z) > a.rest + b.rest) continue;

      const nx = dx / d;
      const ny = dy / d;
      const over = min - d;
      const wa = a.settled ? 0 : 1;
      const wb = b.settled ? 0 : 1;
      const ws = wa + wb;
      a.x -= (nx * over * wa) / ws;
      a.y -= (ny * over * wa) / ws;
      b.x += (nx * over * wb) / ws;
      b.y += (ny * over * wb) / ws;

      const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vn <= 0) continue;
      const impulse = ((1 + COLLISION_RESTITUTION) * vn) / ws;
      a.vx -= impulse * nx * wa;
      a.vy -= impulse * ny * wa;
      b.vx += impulse * nx * wb;
      b.vy += impulse * ny * wb;
      for (const body of [a, b]) {
        if (body.settled) continue;
        const noise = vn * COLLISION_SPIN_NOISE;
        body.w[0] += between(random, -noise, noise);
        body.w[1] += between(random, -noise, noise);
      }
    }
  }
}
