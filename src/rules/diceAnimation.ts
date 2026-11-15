import { quatFromAxisAngle, quatMultiply, type Quat, type Vec3 } from "./diceMath.ts";

export const DICE_ANIMATIONS = ["off", "tumble", "throw"] as const;

export type DiceAnimation = (typeof DICE_ANIMATIONS)[number];

/**
 * The dice animation in effect: the saved setting when there is one, otherwise tumble, or off when the
 * system asks for reduced motion. A saved value always wins.
 */
export function resolveDiceAnimation(saved: DiceAnimation | undefined, reduceMotion: boolean): DiceAnimation {
  if (saved !== undefined) return saved;
  return reduceMotion ? "off" : "tumble";
}

/** The most solid dice a batch draws; the rest of its dice show as number chips only. */
export const TUMBLE_SOLID_CAP = 10;

/** How long one die tumbles, in milliseconds, and the delay between the starts of two dice. */
export const TUMBLE_MS = 950;
export const TUMBLE_STAGGER_MS = 45;

/**
 * The orientation of a tumbling die at `progress` (0 to 1, linear in time). The die turns about `axis`
 * by `spin` radians, easing out, and reaches `target` exactly at progress 1.
 */
export function tumbleQuaternion(target: Quat, axis: Vec3, spin: number, progress: number): Quat {
  const eased = 1 - Math.pow(1 - progress, 3);
  return quatMultiply(target, quatFromAxisAngle(axis, spin * (1 - eased)));
}

/** The lift of a tumbling die: 0 at rest, 1 at its highest point, back to 0 when it lands. */
export function tumblePop(progress: number): number {
  return Math.sin(Math.PI * Math.min(1, progress * 1.15));
}
