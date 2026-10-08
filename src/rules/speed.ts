import type { Character } from "../types/character.ts";
import type { RulesOptions, ResolvedAncestry } from "./types.ts";
import { armorCategory } from "./ac.ts";
import { effectiveScores, hasFeat } from "./abilities.ts";
import { getRaces } from "../services/dataService.ts";

export interface MovementSpeedDetail {
  mode: "walk" | "swim" | "climb" | "fly";
  speed: number;
  source: string;
  restricted?: boolean;
}

export interface MovementSpeeds {
  walk: number;
  swim?: number;
  climb?: number;
  fly?: number;
  flyRestricted: boolean;
  details: MovementSpeedDetail[];
}

export function characterSpeeds(character: Character, opts: RulesOptions = {}): MovementSpeeds {
  let resolvedRace: any = opts.race;
  let resolvedSubrace: any = opts.subrace;

  // Resolve from catalog if not provided in opts
  if (!resolvedRace && character.race) {
    try {
      const allRaces = opts.races || getRaces();
      resolvedRace = allRaces.find(
        (r: any) => r.name === character.race?.name && (!character.race?.source || r.source === character.race.source)
      );
      if (resolvedRace?.subraces && character.race.subraceName) {
        resolvedSubrace = resolvedRace.subraces.find(
          (s: any) => s.name === character.race?.subraceName && (!character.race?.subraceSource || s.source === character.race.subraceSource)
        );
      }
    } catch {
      // fallback
    }
  }

  // Handle lineage replacement (VRGR: Dhampir, Hexblood, Reborn)
  let lineageRace: any = undefined;
  if (character.lineageReplacement) {
    try {
      const allRaces = opts.races || getRaces();
      lineageRace = allRaces.find((r: any) => r.name === character.lineageReplacement);
      // If resolvedRace is the lineage race, resolve prior race from character.race for Ancestral Legacy
      if (
        (!resolvedRace || resolvedRace.name === character.lineageReplacement) &&
        character.race &&
        character.race.name !== character.lineageReplacement
      ) {
        resolvedRace = allRaces.find(
          (r: any) => r.name === character.race?.name && (!character.race?.source || r.source === character.race.source)
        );
        if (resolvedRace?.subraces && character.race.subraceName) {
          resolvedSubrace = resolvedRace.subraces.find(
            (s: any) => s.name === character.race?.subraceName && (!character.race?.subraceSource || s.source === character.race.subraceSource)
          );
        }
      }
    } catch {
      // fallback
    }
  }

  // Collect traits: if lineage is active, lineage replaces base race traits (Ancestral Legacy)
  const allTraits: { name: string; description?: string; text?: any }[] = lineageRace
    ? (lineageRace.traits || [])
    : [
        ...(resolvedRace?.traits || []),
        ...(resolvedSubrace?.traits || []),
      ];

  // Active race for walking speed
  const activeRaceForWalk = lineageRace ?? resolvedSubrace ?? resolvedRace;
  const rawBaseWalk = activeRaceForWalk?.speed?.walk ?? (typeof (activeRaceForWalk as any)?.speed === "number" ? (activeRaceForWalk as any).speed : 30);
  let baseWalk = typeof rawBaseWalk === "number" ? rawBaseWalk : 30;
  let baseWalkName = activeRaceForWalk?.name ?? "Base Speed";

  // Check traits for base walking speed increases (e.g. Wood Elf Fleet of Foot: "Your base walking speed increases to 35 feet.")
  for (const t of allTraits) {
    const text = t.description || (Array.isArray(t.text) ? t.text.join(" ") : t.text) || "";
    const incMatch = text.match(/walking\s+speed\s+increases\s+to\s+(\d+)/i);
    if (incMatch) {
      baseWalk = Math.max(baseWalk, parseInt(incMatch[1], 10));
      baseWalkName = `${t.name} (${baseWalk} ft)`;
    }
  }

  const details: MovementSpeedDetail[] = [
    { mode: "walk", speed: baseWalk, source: baseWalkName.includes("(") ? baseWalkName : `${baseWalkName} (${baseWalk} ft)` },
  ];
  let totalWalk = baseWalk;

  const equipped = (opts.items ?? character.items).filter(i => i.isEquipped);

  // Monk Unarmored Movement
  const monk = character.classes.find(c => c.className === "Monk")?.level || 0;
  if (monk >= 2 && !equipped.some(i => armorCategory(i))) {
    const monkBonus = 10 + Math.floor((monk - 2) / 4) * 5;
    totalWalk += monkBonus;
    details.push({ mode: "walk", speed: monkBonus, source: `Monk Unarmored Movement (+${monkBonus} ft)` });
  }

  // Barbarian Fast Movement
  const barbarian = character.classes.find(c => c.className === "Barbarian")?.level || 0;
  if (barbarian >= 5 && !equipped.some(i => armorCategory(i) === "heavy")) {
    totalWalk += 10;
    details.push({ mode: "walk", speed: 10, source: "Barbarian Fast Movement (+10 ft)" });
  }

  // Mobile Feat
  if (hasFeat(character, "Mobile")) {
    totalWalk += 10;
    details.push({ mode: "walk", speed: 10, source: "Mobile feat (+10 ft)" });
  }


  function getEqualToWalkingTrait(mode: "swim" | "climb" | "fly"): string | undefined {
    const word = mode === "climb" ? "climbing" : mode === "swim" ? "swimming" : "flying";
    const pattern = new RegExp(`${word}\\s+speed\\s+equal\\s+to\\s+your\\s+walking\\s+speed`, "i");
    for (const t of allTraits) {
      const text = t.description || (Array.isArray(t.text) ? t.text.join(" ") : t.text) || "";
      if (pattern.test(text)) {
        return t.name;
      }
    }
    return undefined;
  }

  // Helper for numeric speed lookup
  function getNumericSpeed(mode: "swim" | "climb" | "fly"): { speed?: number; source?: string } {
    if (lineageRace?.speed?.[mode] != null) {
      return { speed: lineageRace.speed[mode], source: lineageRace.name };
    }
    if (resolvedSubrace?.speed?.[mode] != null) {
      return { speed: resolvedSubrace.speed[mode], source: resolvedSubrace.name };
    }
    if (resolvedRace?.speed?.[mode] != null) {
      return { speed: resolvedRace.speed[mode], source: resolvedRace.name };
    }
    return {};
  }

  // 1. Swim
  let swim: number | undefined = undefined;
  const swimEqualTrait = getEqualToWalkingTrait("swim");
  if (swimEqualTrait) {
    swim = totalWalk;
    details.push({ mode: "swim", speed: totalWalk, source: `${swimEqualTrait} (equal to walking speed)` });
  } else {
    const numSwim = getNumericSpeed("swim");
    if (numSwim.speed != null && numSwim.speed > 0) {
      swim = numSwim.speed;
      details.push({ mode: "swim", speed: swim, source: `${numSwim.source || "Racial"} (${swim} ft)` });
    }
  }

  // 2. Climb
  let climb: number | undefined = undefined;
  const climbEqualTrait = getEqualToWalkingTrait("climb");
  if (climbEqualTrait) {
    climb = totalWalk;
    details.push({ mode: "climb", speed: totalWalk, source: `${climbEqualTrait} (equal to walking speed)` });
  } else {
    const numClimb = getNumericSpeed("climb");
    if (numClimb.speed != null && numClimb.speed > 0) {
      climb = numClimb.speed;
      details.push({ mode: "climb", speed: climb, source: `${numClimb.source || "Racial"} (${climb} ft)` });
    }
  }

  // 3. Fly
  let fly: number | undefined = undefined;
  let flyRestricted = false;
  const flyEqualTrait = getEqualToWalkingTrait("fly");
  const numFly = getNumericSpeed("fly");
  const hasFly = Boolean(flyEqualTrait || (numFly.speed != null && numFly.speed > 0));

  if (hasFly) {
    const unconstrainedFly = flyEqualTrait ? totalWalk : (numFly.speed as number);
    const flySource = flyEqualTrait
      ? `${flyEqualTrait} (equal to walking speed)`
      : `${numFly.source || "Racial"} (${numFly.speed} ft)`;

    const isWearingMediumOrHeavy = equipped.some(i => {
      const cat = armorCategory(i);
      return cat === "medium" || cat === "heavy";
    });

    if (isWearingMediumOrHeavy) {
      fly = 0;
      flyRestricted = true;
      details.push({
        mode: "fly",
        speed: 0,
        source: `${flySource} (Restricted by medium/heavy armor)`,
        restricted: true,
      });
    } else {
      fly = unconstrainedFly;
      flyRestricted = false;
      details.push({
        mode: "fly",
        speed: unconstrainedFly,
        source: flySource,
        restricted: false,
      });
    }
  }

  return {
    walk: totalWalk,
    swim,
    climb,
    fly,
    flyRestricted,
    details,
  };
}

export function speed(character: Character, opts: RulesOptions = {}): number {
  return characterSpeeds(character, opts).walk;
}

export function carryingWeight(character: Character, opts: ResolvedAncestry = {}) {
  const { str } = effectiveScores(character, opts).scores;
  const coins = Object.values(character.pouch).reduce((sum, value) => sum + value, 0);
  const weight = character.items.reduce((sum, item) => sum + (item.weight ?? 0) * (item.quantity ?? 1), 0) + coins / 50;
  return { currentWeight: Math.round(weight * 10) / 10, maxCapacity: str * 15, encumbered: weight > str * 5, heavilyEncumbered: weight > str * 10 };
}
