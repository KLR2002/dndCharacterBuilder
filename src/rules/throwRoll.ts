import type { RandomSource } from "./dice.ts";
import { d100Value, makeDie, planSolidDice, type DieGeometry, type SolidPlan, type SolidSides } from "./diceSolids.ts";
import { launchSpecs, simulateThrow, type ThrowResult } from "./diceThrow.ts";

/** The most solid dice one Throw flies. Dice past the cap are decided by the generator. */
export const THROW_SOLID_CAP = 20;

/** The window a Throw flies across, in px. */
export type ThrowWorld = { W: number; H: number };

/**
 * Runs `make` with a recording source that returns 1 for every die, and returns the sides of every die
 * in the order it asked for them. Roll sources request their dice in an order that does not depend on
 * any face, so this list is the same for every set of faces.
 */
export function recordDice<T>(make: (random: RandomSource) => T): number[] {
  const sides: number[] = [];
  make((dieSides) => {
    sides.push(dieSides);
    return 1;
  });
  return sides;
}

/**
 * A random source that returns `faces[i]` for its i-th call when that entry is a number, and `fallback`
 * for the rest. An entry that is undefined marks a die the replay leaves to the fallback.
 */
export function replayRandom(faces: readonly (number | undefined)[], fallback: RandomSource): RandomSource {
  let index = 0;
  return (sides) => {
    const face = faces[index];
    index += 1;
    return typeof face === "number" ? face : fallback(sides);
  };
}

/** The solids of a Throw: which dice get bodies, the geometry of each body, and the die each body belongs to. */
export interface ThrowPlan {
  plan: SolidPlan[];
  /** One geometry per body: a standard die's, or a d100's tens body then its units body. */
  geos: DieGeometry[];
  /** For each body, the index in the request-order dice list of the die it belongs to. */
  owner: number[];
}

function isSolidSides(sides: number): sides is SolidSides {
  return sides === 4 || sides === 6 || sides === 8 || sides === 10 || sides === 12 || sides === 20;
}

/** Plans the solids of a Throw for dice given by their sides, in request order. */
export function planThrow(sidesList: readonly number[], cap: number = THROW_SOLID_CAP): ThrowPlan {
  const plan = planSolidDice(sidesList, cap);
  const geos: DieGeometry[] = [];
  const owner: number[] = [];
  plan.forEach((entry, index) => {
    if (!entry.solid) return;
    const sides = sidesList[index];
    if (sides === 100) {
      geos.push(makeDie(10, "tens"), makeDie(10, "units"));
      owner.push(index, index);
    } else if (isSolidSides(sides)) {
      geos.push(makeDie(sides, "std"));
      owner.push(index);
    }
  });
  return { plan, geos, owner };
}

/**
 * The face of every die in request order, from the settled value of each body: a standard die takes its
 * body's value, a d100 the value of its tens and units bodies, and a die with no body is undefined.
 */
export function throwFaces(thrown: ThrowPlan, values: readonly number[], dieCount: number): (number | undefined)[] {
  const faces: (number | undefined)[] = Array.from({ length: dieCount }, () => undefined);
  thrown.geos.forEach((geo, body) => {
    const index = thrown.owner[body];
    if (geo.kind === "std") faces[index] = values[body];
    else if (geo.kind === "tens") faces[index] = d100Value(values[body], values[body + 1]);
  });
  return faces;
}

/** The size of one solid die in px for a window: 7.5% of its shorter side, between 24 and 36. */
export function throwDieSize(world: ThrowWorld): number {
  return Math.min(36, Math.max(24, Math.min(world.W, world.H) * 0.075));
}

let physicsRandom: () => number = () => Math.random();

/** Test-only seam: replaces the physics random source (null restores `Math.random`). */
export function setThrowRandomForTests(source: (() => number) | null): void {
  physicsRandom = source ?? (() => Math.random());
}

/** The random source the Throw's physics draws from. */
export function throwPhysicsRandom(): () => number {
  return physicsRandom;
}

export interface ThrowOptions {
  world: ThrowWorld;
  /** Where the dice leave, in px. */
  origin: [number, number];
  /** Size of one solid die in px. */
  size: number;
  /** The physics random source. */
  physics: () => number;
  /** Decides every die the Throw does not carry, and the whole Roll when no die is thrown. */
  fallback: RandomSource;
}

/** A simulated Throw: the recorded motion of every body, and the dice it carries. */
export interface ThrowRecord {
  geos: DieGeometry[];
  owner: number[];
  results: ThrowResult[];
  size: number;
  world: ThrowWorld;
}

export interface ThrownRoll<T> {
  result: T;
  /** Null when no die is a solid, so nothing was thrown. */
  thrown: ThrowRecord | null;
}

/**
 * Makes a Roll the Throw way: records the dice, simulates the solids to rest, then makes the Roll again
 * with the settled faces for the thrown dice and the fallback for the rest.
 */
export function runThrow<T>(make: (random: RandomSource) => T, options: ThrowOptions): ThrownRoll<T> {
  const sidesList = recordDice(make);
  const thrown = planThrow(sidesList);
  if (thrown.geos.length === 0) return { result: make(options.fallback), thrown: null };
  const specs = launchSpecs(thrown.geos, options.size, options.world, options.origin, options.physics);
  const results = simulateThrow(specs, options.world, options.physics);
  const faces = throwFaces(thrown, results.map((result) => result.value), sidesList.length);
  return {
    result: make(replayRandom(faces, options.fallback)),
    thrown: { geos: thrown.geos, owner: thrown.owner, results, size: options.size, world: options.world },
  };
}
