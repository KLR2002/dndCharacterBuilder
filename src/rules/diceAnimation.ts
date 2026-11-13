import type { Roll, RolledDie } from "./dice.ts";

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

// Large pools animate at most this many dice; every die still shows as a text chip, only the 3D
// tumbling is capped, so a 20-dice pool costs ten composited Views for well under a second.
export const MAX_ANIMATED_DICE = 10;

/** The dice of a Roll that animate, in roll order, capped at MAX_ANIMATED_DICE. Dropped dice are included; the renderer mutes them. */
export function animatedDice(roll: Roll): RolledDie[] {
  return roll.dice.slice(0, MAX_ANIMATED_DICE);
}
