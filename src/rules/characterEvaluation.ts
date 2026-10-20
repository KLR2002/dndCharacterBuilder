import type { Character, ResourceCounter } from "../types/character.ts";
import type { BackgroundData, RaceData, SubraceData } from "../types/dnd5e.ts";
import type { ResolvedAncestry } from "./types.ts";
import { CLASS_DATA } from "./classData.ts";
import { catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { effectiveScores } from "./abilities.ts";
import { maxHp } from "./hp.ts";
import { getHitDicePools, type HitDiePool } from "./hitDice.ts";
import { armorClass } from "./ac.ts";
import { speed, characterSpeeds, carryingWeight, type MovementSpeeds } from "./speed.ts";
import { savingThrows } from "./saves.ts";
import { skills } from "./skills.ts";
import { totalLevel, proficiencyBonus } from "./proficiencies.ts";
import { getWeaponAttacks, type WeaponAttackOption } from "./attacks.ts";
import { proficiencySheet } from "./proficiencySheet.ts";
import {
  evaluateCharacterTools,
  type EvaluatedTool,
} from "./tools.ts";
import {
  getClassSpellProfiles,
  calculateWarlockPactSlots,
  type ClassSpellProfile,
} from "./spellcasting.ts";
import {
  getClassDice,
  getManeuverSaveDc,
  type ClassDiceSummary,
} from "./combatDice.ts";
import {
  calculateAutoResourceCounters,
  getMergedResourceCounters,
} from "./resourceCounters.ts";

export { catalogListings, type CharacterCatalogs } from "./catalogs.ts";

export interface EvaluatedCharacter {
  totalLevel: number;
  proficiencyBonus: number;
  initiative: number;
  effectiveScores: ReturnType<typeof effectiveScores>;
  hp: {
    max: number;
    current: number;
    temp: number;
    override: number | null;
  };
  hitDice: Record<string, HitDiePool>;
  armorClass: ReturnType<typeof armorClass>;
  speed: ReturnType<typeof speed>;
  speeds: MovementSpeeds;
  saves: ReturnType<typeof savingThrows>;
  skills: ReturnType<typeof skills>;
  carryingWeight: ReturnType<typeof carryingWeight>;
  weaponAttacks: WeaponAttackOption[];
  attacks: {
    extraAttackCount: number;
  };
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    languages: string[];
  };
  tools: EvaluatedTool[];
  resolvedAncestry: ResolvedAncestry;
  resolvedBackground?: BackgroundData;
  spellProfiles: ClassSpellProfile[];
  pactMagic: { count: number; level: number } | null;
  combatDice: ClassDiceSummary;
  combatDcs: {
    maneuverSaveDc: number;
    spellSaveDc?: number;
  };
  featureCounters: Record<string, ResourceCounter>;
}

export function resolveCharacterAncestry(character: Character, raceCatalog?: RaceData[]): ResolvedAncestry {
  if (character.lineageReplacement && raceCatalog) {
    const lineage = raceCatalog.find((r) => r.name === character.lineageReplacement);
    if (lineage) return { race: lineage, subrace: undefined };
  }
  const choice = character.race;
  if (!choice || !raceCatalog) return {};

  const race = raceCatalog.find((r) => r.name === choice.name && (!choice.source || r.source === choice.source));
  const subrace = race?.subraces?.find(
    (s: SubraceData) =>
      s.name === choice.subraceName && (!choice.subraceSource || s.source === choice.subraceSource)
  );

  return { race, subrace };
}

export function resolveCharacterBackground(character: Character, backgroundCatalog?: BackgroundData[]): BackgroundData | undefined {
  if (!character.background || !backgroundCatalog) return undefined;
  return backgroundCatalog.find(
    (b) => b.name === character.background?.name && (!character.background?.source || b.source === character.background?.source)
  );
}

/**
 * Deep evaluation of a character sheet in a single pass.
 * Calculates all derived combat, ability, defense, and skill statistics.
 */
export function evaluateCharacter(
  character: Character,
  catalogs?: CharacterCatalogs
): EvaluatedCharacter {
  const listings = catalogListings(catalogs);
  const ancestry = resolveCharacterAncestry(character, listings.races());
  const background = resolveCharacterBackground(character, listings.backgrounds());
  const classRules = catalogs?.classRules ?? CLASS_DATA;

  const lvl = totalLevel(character);
  const pb = proficiencyBonus(lvl);
  const effScores = effectiveScores(character, ancestry);
  const maxHitPoints = maxHp(character, ancestry, classRules);
  const hitDice = getHitDicePools(character, classRules);
  const acResult = armorClass(character, ancestry);
  const speedsResult = characterSpeeds(character, { ...ancestry, compendium: catalogs?.compendium });
  const speedResult = speedsResult.walk;
  const savesResult = savingThrows(character, classRules, ancestry);
  const weightResult = carryingWeight(character, ancestry);

  const skillsResult = skills(character, {
    ...ancestry,
    backgrounds: background ? [background] : undefined,
  });

  const sheet = proficiencySheet(character, catalogs ?? {});
  const toolList = sheet.tools.map((t) => t.name);
  const langList = sheet.languages.map((l) => l.name);

  let extraAttackCount = 1;
  for (const c of character.classes || []) {
    if (c.className === "Fighter") {
      if (c.level >= 20) extraAttackCount = Math.max(extraAttackCount, 4);
      else if (c.level >= 11) extraAttackCount = Math.max(extraAttackCount, 3);
      else if (c.level >= 5) extraAttackCount = Math.max(extraAttackCount, 2);
    } else if (["Barbarian", "Paladin", "Ranger"].includes(c.className) && c.level >= 5) {
      extraAttackCount = Math.max(extraAttackCount, 2);
    } else if (c.className === "Monk" && c.level >= 5) {
      extraAttackCount = Math.max(extraAttackCount, 2);
    }
  }

  const attacksList = getWeaponAttacks(character, { catalogs });

  const spellProfiles = getClassSpellProfiles(character, {
    ...ancestry,
    activeBooks: catalogs?.activeBooks,
  });
  const pactMagic = calculateWarlockPactSlots(character);
  const combatDice = getClassDice(character);
  const maneuverSaveDc = getManeuverSaveDc(character);
  const primarySpellDc = spellProfiles[0]?.spellSaveDc;
  const combatDcs = {
    maneuverSaveDc,
    ...(primarySpellDc !== undefined ? { spellSaveDc: primarySpellDc } : {}),
  };
  const autoCounters = calculateAutoResourceCounters(character, effScores.modifiers);
  const featureCounters = getMergedResourceCounters(character, autoCounters);

  return {
    totalLevel: lvl,
    proficiencyBonus: pb,
    initiative: effScores.modifiers.dex ?? 0,
    effectiveScores: effScores,
    hp: {
      max: maxHitPoints,
      current: character.currentHp ?? maxHitPoints,
      temp: character.tempHp ?? 0,
      override: character.maxHpOverride ?? null,
    },
    hitDice,
    armorClass: acResult,
    speed: speedResult,
    speeds: speedsResult,
    saves: savesResult,
    skills: skillsResult,
    carryingWeight: weightResult,
    weaponAttacks: attacksList,
    attacks: {
      extraAttackCount,
    },
    proficiencies: {
      armor: sheet.armor.map((a) => a.name),
      weapons: sheet.weapons.map((w) => w.name),
      tools: toolList,
      languages: langList,
    },
    tools: evaluateCharacterTools(character, catalogs ?? {}),
    resolvedAncestry: ancestry,
    resolvedBackground: background,
    spellProfiles,
    pactMagic,
    combatDice,
    combatDcs,
    featureCounters,
  };
}
