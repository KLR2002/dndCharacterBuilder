import type { Roll, RolledDie } from "./dice.ts";

/**
 * Whether the 2.5D dice animation runs: the saved app setting when there is one, otherwise on, except
 * off when the system asks for reduced motion. A saved value always wins, so a user can keep the dice
 * on under reduced motion or switch them off without it.
 */
export function resolveDiceAnimationEnabled(saved: boolean | undefined, reduceMotion: boolean): boolean {
  if (saved !== undefined) return saved;
  return !reduceMotion;
}

// Large pools animate at most this many dice; every die still shows as a text chip, only the 3D
// tumbling is capped, so a 20-dice pool costs ten composited Views for well under a second.
export const MAX_ANIMATED_DICE = 10;

/** The dice of a Roll that animate, in roll order, capped at MAX_ANIMATED_DICE. Dropped dice are included; the renderer mutes them. */
export function animatedDice(roll: Roll): RolledDie[] {
  return roll.dice.slice(0, MAX_ANIMATED_DICE);
}
