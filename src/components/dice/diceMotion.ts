import { normalize, type Vec3 } from "../../rules/diceMath.ts";

/** A random turn axis, a spin of two to three and a half full turns, and a yaw about the vertical. */
export function randomMotion(): { axis: Vec3; spin: number; yaw: number } {
  return {
    axis: normalize([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]),
    spin: (2 + Math.random() * 1.5) * 2 * Math.PI,
    yaw: Math.random() * 2 * Math.PI,
  };
}
