import type { Character, ResourceCounter } from "../types/character.ts";
import type { BackgroundData } from "../types/dnd5e.ts";
import type { ResolvedAncestry } from "./types.ts";
import { allCatalogClasses, catalogListings, type CharacterCatalogs } from "./catalogs.ts";
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
import { grantedFeatures } from "./grantedFeatures.ts";
import { initiativeOf, type InitiativePart } from "./initiative.ts";
import { halfProficiencyFor } from "./halfProficiency.ts";
import { resolveCharacterAncestry } from "./characterAncestry.ts";
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
import { grantedSpellSources } from "./grantedSpells.ts";
import { backgroundExpandedSpellNames } from "./backgroundSpells.ts";
import type { InnateSpellProfile } from "./innateMagic.ts";

export { catalogListings, type CharacterCatalogs } from "./catalogs.ts";

export interface EvaluatedCharacter {
  totalLevel: number;
  proficiencyBonus: number;
  initiative: number;
  /** The parts of `initiative`: Dexterity first, then each Initiative Bonus that contributes. */
  initiativeBreakdown: InitiativePart[];
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
  /** The Innate Magic sources the character's feats grant (ADR 0017), one card each. Not class spells. */
  grantedSpellSources: InnateSpellProfile[];
  pactMagic: { count: number; level: number } | null;
  combatDice: ClassDiceSummary;
  combatDcs: {
    maneuverSaveDc: number;
    spellSaveDc?: number;
  };
  featureCounters: Record<string, ResourceCounter>;
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
  const classes = allCatalogClasses(catalogs);

  const lvl = totalLevel(character);
  const pb = proficiencyBonus(lvl);
  const effScores = effectiveScores(character, ancestry);
  const maxHitPoints = maxHp(character, ancestry, classes);
  const hitDice = getHitDicePools(character, classes);
  const acResult = armorClass(character, ancestry);
  const speedsResult = characterSpeeds(character, { ...ancestry, compendium: catalogs?.compendium });
  const speedResult = speedsResult.walk;
  const sheet = proficiencySheet(character, catalogs ?? {});
  const initiativeResult = initiativeOf(
    grantedFeatures(character, {
      races: listings.races(),
      classes: listings.classes(),
      backgrounds: listings.backgrounds(),
      feats: listings.feats(),
    }),
    effScores.modifiers,
    pb,
    halfProficiencyFor(character, "dex", pb),
  );
  const savesResult = savingThrows(character, sheet.savingThrows, ancestry);
  const weightResult = carryingWeight(character, ancestry);

  const skillsResult = skills(character, sheet.skills, ancestry);

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
    classes,
    backgroundSpells: backgroundExpandedSpellNames(background),
  });
  const grantedSources = grantedSpellSources(character, catalogs, {
    modifiers: effScores.modifiers,
    proficiencyBonus: pb,
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
    initiative: initiativeResult.total,
    initiativeBreakdown: initiativeResult.breakdown,
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
    grantedSpellSources: grantedSources,
    pactMagic,
    combatDice,
    combatDcs,
    featureCounters,
  };
}
