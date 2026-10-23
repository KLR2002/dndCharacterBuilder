import type { Character, ResourceCounter } from "../types/character";
import type { BeastData } from "../types/dnd5e";
import { enterWildShape, type WildShapeHpPatch } from "./wildShapeHp.ts";

export interface WildShapeLimits {
  hasWildShape: boolean;
  druidLevel: number;
  isMoonDruid: boolean;
  maxCr: number;
  maxCrDisplay: string;
  canSwim: boolean;
  canFly: boolean;
  maxDurationHours: number;
  canElemental: boolean;
}

/**
 * Calculates a character's 2014 Fifth Edition Wild Shape limitations based on
 * Druid level and subclass (PHB p.66-69).
 */
export function getWildShapeLimits(character: Character): WildShapeLimits {
  const druidClass = (character.classes || []).find(
    (c) => c.className.toLowerCase() === "druid"
  );

  const druidLevel = druidClass?.level ?? 0;
  if (!druidClass || druidLevel < 2) {
    return {
      hasWildShape: false,
      druidLevel,
      isMoonDruid: false,
      maxCr: 0,
      maxCrDisplay: "0",
      canSwim: false,
      canFly: false,
      maxDurationHours: 0,
      canElemental: false,
    };
  }

  const isMoonDruid = Boolean(
    druidClass.subclassName &&
      druidClass.subclassName.toLowerCase().includes("moon")
  );

  // Duration in hours: floor(level / 2) (PHB p.66)
  const maxDurationHours = Math.floor(druidLevel / 2);

  // Movement speed restrictions apply to BOTH standard and Moon Druids (PHB p.66, p.69)
  const canSwim = druidLevel >= 4;
  const canFly = druidLevel >= 8;

  // Elemental Wild Shape: Circle of the Moon level 10+ (PHB p.69)
  const canElemental = isMoonDruid && druidLevel >= 10;

  let maxCr = 0.25;
  let maxCrDisplay = "1/4";

  if (isMoonDruid) {
    if (druidLevel < 6) {
      maxCr = 1.0;
      maxCrDisplay = "1";
    } else {
      maxCr = Math.floor(druidLevel / 3);
      maxCrDisplay = String(maxCr);
    }
  } else {
    if (druidLevel < 4) {
      maxCr = 0.25;
      maxCrDisplay = "1/4";
    } else if (druidLevel < 8) {
      maxCr = 0.5;
      maxCrDisplay = "1/2";
    } else {
      maxCr = 1.0;
      maxCrDisplay = "1";
    }
  }

  return {
    hasWildShape: true,
    druidLevel,
    isMoonDruid,
    maxCr,
    maxCrDisplay,
    canSwim,
    canFly,
    maxDurationHours,
    canElemental,
  };
}

/**
 * Evaluates whether a creature is a legally accessible Wild Shape form for a character.
 * Which beasts exist is decided by the Compendium (active books); this applies only Wild Shape's own limits.
 */
export function isBeastEligible(beast: BeastData, character: Character): boolean {
  const limits = getWildShapeLimits(character);
  if (!limits.hasWildShape) {
    return false;
  }

  if (beast.isElementalWildShape) {
    return limits.canElemental;
  }

  // Non-elemental beast
  if (beast.crNumeric > limits.maxCr) {
    return false;
  }

  if (beast.speed?.swim && beast.speed.swim > 0 && !limits.canSwim) {
    return false;
  }

  if (beast.speed?.fly && beast.speed.fly > 0 && !limits.canFly) {
    return false;
  }

  return true;
}

/**
 * Returns a human-readable explanation of why a beast is locked for a character.
 * Returns null if the beast is eligible.
 */
export function getBeastFilterReason(
  beast: BeastData,
  character: Character
): string | null {
  const limits = getWildShapeLimits(character);

  if (!limits.hasWildShape) {
    return "Requires Druid Level 2 (Wild Shape)";
  }

  if (beast.isElementalWildShape) {
    if (!limits.isMoonDruid) {
      return "Requires Circle of the Moon (Level 10)";
    }
    if (limits.druidLevel < 10) {
      return "Requires Druid Level 10 (Elemental Wild Shape)";
    }
    return null;
  }

  // Check Challenge Rating
  if (beast.crNumeric > limits.maxCr) {
    if (!limits.isMoonDruid) {
      if (beast.crNumeric > 1) {
        return "Requires Circle of the Moon (CR > 1)";
      }
      return `Requires Druid Level ${beast.crNumeric === 0.5 ? 4 : 8} (CR ${beast.cr})`;
    } else {
      const requiredLevel = Math.max(2, Math.ceil(beast.crNumeric * 3));
      return `Requires Druid Level ${requiredLevel} (CR ${beast.cr})`;
    }
  }

  // Check movement restrictions
  if (beast.speed?.swim && beast.speed.swim > 0 && !limits.canSwim) {
    return "Requires Druid Level 4 (Swimming Speed)";
  }

  if (beast.speed?.fly && beast.speed.fly > 0 && !limits.canFly) {
    return "Requires Druid Level 8 (Flying Speed)";
  }

  return null;
}

/**
 * Returns the number of Wild Shape uses required to adopt this creature form.
 * 2 uses for Elementals (Moon Druid Level 10+), 1 use for standard beasts.
 */
export function getRequiredWildShapeCharges(beast: BeastData): number {
  return beast.isElementalWildShape ? 2 : 1;
}

/**
 * Returns available Wild Shape charges for a character.
 * Defaults to 2 uses per short rest for Druids (level 2-19), unlimited (999) at level 20 (Archdruid),
 * and returns 0 for non-druids.
 */
export function getWildShapeCharges(character: Character): number {
  const limits = getWildShapeLimits(character);
  if (!limits.hasWildShape) return 0;
  if (limits.druidLevel >= 20) return 999;
  return character.resourceCounters?.wild_shape?.current ?? 2;
}

/** The character fields an adoption changes: the Wild Shape counter and the active form. */
export type WildShapeAdoptionPatch = WildShapeHpPatch & { resourceCounters: Record<string, ResourceCounter> };

/**
 * The single adoption path for a Wild Shape form. It pays the form's charges (1 for a beast, 2 for an
 * elemental) and enters the form at its full HP. Returns null when the character cannot pay, and then
 * nothing changes. An Archdruid's charges are unlimited, so nothing is deducted for them.
 */
export function adoptWildShape(character: Character, beast: BeastData): WildShapeAdoptionPatch | null {
  const available = getWildShapeCharges(character);
  const cost = getRequiredWildShapeCharges(beast);
  if (available < cost) return null;

  const isArchdruid = getWildShapeLimits(character).druidLevel >= 20;
  const existingCounter = (character.resourceCounters || {})["wild_shape"];
  const counter: ResourceCounter = {
    id: "wild_shape",
    name: "Wild Shape",
    current: isArchdruid ? 999 : available - cost,
    max: isArchdruid ? 999 : (existingCounter ? existingCounter.max : 2),
    resetOn: "short",
  };

  return {
    resourceCounters: { ...(character.resourceCounters || {}), wild_shape: counter },
    ...enterWildShape(character, {
      name: beast.name,
      source: beast.source,
      currentHp: beast.hp.average,
      maxHp: beast.hp.average,
      ac: beast.ac,
    }),
  };
}
