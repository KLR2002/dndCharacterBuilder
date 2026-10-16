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
import {
  totalLevel,
  proficiencyBonus,
  proficiencies,
  normalizeArmorProficiency,
  normalizeWeaponProficiency,
  deduplicateWeaponProficiencies,
} from "./proficiencies.ts";
import {
  RACE_WEAPON_PROFICIENCIES,
  getWeaponAttacks,
  type WeaponAttackOption,
} from "./attacks.ts";
import {
  resolveCharacterTools,
  resolveCharacterLanguages,
} from "./proficienciesAndLanguages.ts";
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
  const speedsResult = characterSpeeds(character, ancestry);
  const speedResult = speedsResult.walk;
  const savesResult = savingThrows(character, classRules, ancestry);
  const weightResult = carryingWeight(character, ancestry);

  const skillsResult = skills(character, {
    ...ancestry,
    backgrounds: background ? [background] : undefined,
  });

  // Derived proficiencies
  const allClasses = listings.classes();
  const baseProf = proficiencies(character, allClasses);
  const armorSet = new Set<string>(baseProf.armor.map(normalizeArmorProficiency));
  const weaponSet = new Set<string>(baseProf.weapons.map(normalizeWeaponProficiency));

  if (Array.isArray(character.multiclassProficiencies)) {
    for (const mp of character.multiclassProficiencies) {
      for (const a of mp.armor || []) armorSet.add(normalizeArmorProficiency(a));
      for (const w of mp.weapons || []) weaponSet.add(normalizeWeaponProficiency(w));
    }
  }

  // Race and subrace weapon and armor training
  const raceName = character.race?.name;
  const subraceName = character.race?.subraceName;
  const candidateKeys = [
    raceName,
    subraceName,
    subraceName && raceName ? `${subraceName} ${raceName}` : undefined,
  ].filter((k): k is string => Boolean(k));

  for (const key of candidateKeys) {
    if (RACE_WEAPON_PROFICIENCIES[key]) {
      for (const w of RACE_WEAPON_PROFICIENCIES[key]) {
        weaponSet.add(normalizeWeaponProficiency(w));
      }
    }
  }

  if (subraceName === "Mountain Dwarf" || raceName === "Mountain Dwarf" || raceName === "Githyanki") {
    armorSet.add(normalizeArmorProficiency("Light armor"));
    armorSet.add(normalizeArmorProficiency("Medium armor"));
  }

  const toolList = resolveCharacterTools(character, catalogs ?? {});

  const langList = resolveCharacterLanguages(character, catalogs ?? {});

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

  const attacksList = getWeaponAttacks(character, { classes: allClasses });

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
      armor: Array.from(armorSet),
      weapons: deduplicateWeaponProficiencies(Array.from(weaponSet)),
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
