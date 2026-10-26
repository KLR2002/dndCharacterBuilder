import type { Character } from "../types/character.ts";
import { hasFightingStyle } from "./ruleChoices.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";

export function getBardicInspirationDie(bardLevel: number): string | null {
  if (bardLevel < 1) return null;
  if (bardLevel >= 15) return "1d12";
  if (bardLevel >= 10) return "1d10";
  if (bardLevel >= 5) return "1d8";
  return "1d6";
}

export function getSneakAttackDice(rogueLevel: number): string | null {
  if (rogueLevel < 1) return null;
  const count = Math.ceil(rogueLevel / 2);
  return `${count}d6`;
}

export function getMartialArtsDie(monkLevel: number): string | null {
  if (monkLevel < 1) return null;
  if (monkLevel >= 17) return "1d10";
  if (monkLevel >= 11) return "1d8";
  if (monkLevel >= 5) return "1d6";
  return "1d4";
}

export interface SuperiorityDicePool {
  count: number;
  die: string;
}

/**
 * The two superiority dice pools a character can hold. They never merge: the Battle Master pool scales with
 * Fighter level, while the bonus pool (one die each from Superior Technique and Martial Adept) stays at d6.
 */
export interface SuperiorityDicePools {
  battleMaster: SuperiorityDicePool | null;
  bonus: SuperiorityDicePool | null;
}

// Each grant (Superior Technique, Martial Adept) adds one superiority die of this size, and it does not scale.
const BONUS_SUPERIORITY_DIE = "d6";

export function getSuperiorityDice(character: Character): SuperiorityDicePools | null {
  const classes = character.classes || [];
  const fighter = classes.find((c) => c.className.toLowerCase() === "fighter");
  const fighterLevel = fighter ? fighter.level : 0;
  const subName = fighter ? (fighter.subclassName || fighter.subclass || "").toLowerCase().trim() : "";
  const isBattleMaster = fighterLevel >= 3 && subName.includes("battle master");

  const hasSupTech = hasFightingStyle(character, "Superior Technique");
  const hasMartialAdept = [
    ...(character.asiSelections || []),
    ...(character.originFeats || []),
  ].some((s) => s.type === "feat" && s.featName?.toLowerCase().trim() === "martial adept");

  const bonusCount = (hasSupTech ? 1 : 0) + (hasMartialAdept ? 1 : 0);
  const battleMaster: SuperiorityDicePool | null = isBattleMaster
    ? {
        count: fighterLevel >= 15 ? 6 : fighterLevel >= 7 ? 5 : 4,
        die: fighterLevel >= 18 ? "d12" : fighterLevel >= 10 ? "d10" : "d8",
      }
    : null;
  const bonus: SuperiorityDicePool | null =
    bonusCount > 0 ? { count: bonusCount, die: BONUS_SUPERIORITY_DIE } : null;

  if (!battleMaster && !bonus) {
    return null;
  }
  return { battleMaster, bonus };
}

/** The pools the character holds, largest die first. */
export function listSuperiorityPools(pools: SuperiorityDicePools | null): SuperiorityDicePool[] {
  if (!pools) return [];
  return [pools.battleMaster, pools.bonus].filter((p): p is SuperiorityDicePool => p !== null);
}

/** The die faces a maneuver can spend, e.g. "d8" or "d8 / d6" when both pools are held. Null when there are none. */
export function superiorityDieLabel(pools: SuperiorityDicePools | null): string | null {
  const faces = listSuperiorityPools(pools).map((p) => p.die);
  return faces.length > 0 ? faces.join(" / ") : null;
}

export function getManeuverSaveDc(character: Character): number {
  const { modifiers } = effectiveScores(character);
  const pb = proficiencyBonus(totalLevel(character));
  return 8 + pb + Math.max(modifiers.str, modifiers.dex);
}

export interface ClassDiceSummary {
  bardicInspiration: string | null;
  sneakAttack: string | null;
  martialArts: string | null;
  superiorityDice: SuperiorityDicePools | null;
}

export function getClassDice(character: Character): ClassDiceSummary {
  const classes = character.classes || [];
  const bard = classes.find((c) => c.className === "Bard");
  const rogue = classes.find((c) => c.className === "Rogue");
  const monk = classes.find((c) => c.className === "Monk");

  return {
    bardicInspiration: bard ? getBardicInspirationDie(bard.level) : null,
    sneakAttack: rogue ? getSneakAttackDice(rogue.level) : null,
    martialArts: monk ? getMartialArtsDie(monk.level) : null,
    superiorityDice: getSuperiorityDice(character),
  };
}
