// Vector and quaternion helpers for the dice. Pure functions with no React or React Native imports.

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}

export function quatNormalize(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const n = normalize(axis);
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), n[0] * s, n[1] * s, n[2] * s];
}

/** Rotates a vector by a unit quaternion. */
export function rotateVector(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[1], q[2], q[3]];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, q[0])), cross(u, t));
}

/** The shortest rotation that turns direction `a` onto direction `b`. */
export function quatFromTo(a: Vec3, b: Vec3): Quat {
  const d = dot(a, b);
  if (d > 0.9999999) return [1, 0, 0, 0];
  if (d < -0.9999999) {
    let perpendicular = cross(a, [1, 0, 0]);
    if (length(perpendicular) < 1e-3) perpendicular = cross(a, [0, 1, 0]);
    return quatFromAxisAngle(perpendicular, Math.PI);
  }
  const c = cross(a, b);
  return quatNormalize([1 + d, c[0], c[1], c[2]]);
}

/** Normalised linear interpolation between two orientations, taking the shorter way round. */
export function nlerp(a: Quat, b: Quat, t: number): Quat {
  const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  return quatNormalize([
    a[0] * (1 - t) + sign * b[0] * t,
    a[1] * (1 - t) + sign * b[1] * t,
    a[2] * (1 - t) + sign * b[2] * t,
    a[3] * (1 - t) + sign * b[3] * t,
  ]);
}

/** The part `f` (0 to 1) of the rotation `q`, about the same axis. */
export function fraction(q: Quat, f: number): Quat {
  const sign = q[0] < 0 ? -1 : 1;
  const w = Math.min(1, sign * q[0]);
  const s = Math.sqrt(1 - w * w);
  if (s < 1e-7) return [1, 0, 0, 0];
  return quatFromAxisAngle([(sign * q[1]) / s, (sign * q[2]) / s, (sign * q[3]) / s], 2 * Math.acos(w) * f);
}

/** Advances an orientation by an angular velocity (radians per second) over `dt` seconds. */
export function integrate(q: Quat, w: Vec3, dt: number): Quat {
  const d = quatMultiply([0, w[0], w[1], w[2]], q);
  return quatNormalize([
    q[0] + 0.5 * dt * d[0],
    q[1] + 0.5 * dt * d[1],
    q[2] + 0.5 * dt * d[2],
    q[3] + 0.5 * dt * d[3],
  ]);
}

/** A uniformly random orientation. `random` returns numbers in [0, 1). */
export function random(source: () => number): Quat {
  const u1 = source();
  const u2 = source() * 2 * Math.PI;
  const u3 = source() * 2 * Math.PI;
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  return [b * Math.cos(u3), a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3)];
}
