import type { AbilityKey, AbilityScores, AsiSelection, Character } from "../types/character.ts";
import { effectiveScores, hasFeat } from "./abilities.ts";
import { totalLevel } from "./proficiencies.ts";
import { isCastingClass } from "./spellcasting.ts";
import { grantedSpellSources } from "./grantedSpells.ts";
import { releaseExpandedOnlySpells } from "./backgroundSpells.ts";
import { proficiencySheet } from "./proficiencySheet.ts";
import type { CharacterCatalogs } from "./catalogs.ts";
import { reconcile } from "./characterReconciler.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { BACKGROUND_FEAT_SOURCE } from "../constants/rules.ts";

export interface FeatPrerequisiteResult {
  met: boolean;
  reason?: string;
}

export interface FeatPrerequisiteOptions {
  /** The Compendium the armor prerequisite reads from the Proficiency Sheet. Defaults to the current one. */
  catalogs?: CharacterCatalogs;
  effectiveScores?: AbilityScores;
  armorProficiencies?: string[];
  weaponProficiencies?: string[];
  totalLevel?: number;
}

/**
 * Validates whether a character meets the prerequisite for a feat.
 * Returns { met: true } or { met: false, reason: string }.
 */
export function validateFeatPrerequisites(
  character: Character,
  feat: { name: string; prerequisite?: string | null },
  options: FeatPrerequisiteOptions = {},
): FeatPrerequisiteResult {
  const prereq = feat.prerequisite?.trim();
  if (!prereq) return { met: true };

  const scores = options.effectiveScores || effectiveScores(character).scores;
  const lvl = options.totalLevel ?? totalLevel(character);
  const armors = options.armorProficiencies ?? proficiencySheet(character, options.catalogs ?? {}).armor.map((armor) => armor.name);
  const raceName = (character.race?.name || "").toLowerCase();
  const subraceName = (character.race?.subraceName || "").toLowerCase();

  // 1. Ability Score Requirements (e.g. "Strength 13 or higher", "Dexterity 13 or higher")
  const abilityMatchOr = prereq.match(/(intelligence|wisdom)\s*13\s*or\s*higher\s*or\s*(intelligence|wisdom)\s*13\s*or\s*higher/i);
  if (abilityMatchOr) {
    if (scores.int < 13 && scores.wis < 13) {
      return { met: false, reason: "Requires Intelligence 13 or higher or Wisdom 13 or higher" };
    }
  } else {
    const singleAbilityMatch = prereq.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s*13\s*or\s*higher/i);
    if (singleAbilityMatch) {
      const key = singleAbilityMatch[1].toLowerCase().slice(0, 3) as AbilityKey;
      if (scores[key] < 13) {
        return { met: false, reason: `Requires ${singleAbilityMatch[1]} 13 or higher` };
      }
    }
  }

  // 2. Armor Proficiencies
  if (/proficiency with heavy armor/i.test(prereq)) {
    if (!armors.some(a => /heavy/i.test(a))) {
      return { met: false, reason: "Requires Proficiency with heavy armor" };
    }
  } else if (/proficiency with medium armor/i.test(prereq)) {
    if (!armors.some(a => /medium|heavy/i.test(a))) {
      return { met: false, reason: "Requires Proficiency with medium armor" };
    }
  } else if (/proficiency with light armor/i.test(prereq)) {
    if (!armors.some(a => /light|medium|heavy/i.test(a))) {
      return { met: false, reason: "Requires Proficiency with light armor" };
    }
  }

  // 3. Spellcasting
  if (/ability to cast at least one spell/i.test(prereq)) {
    const canCastClass = (character.classes || []).some((c) => isCastingClass(c));
    const hasKnown = (character.knownSpells || []).length > 0;
    // A source that holds no spell yet (a pick still owed) does not count: only a spell the character can cast does.
    const hasInnate = grantedSpellSources(character, options.catalogs).some((source) => source.spells.length > 0);
    if (!canCastClass && !hasKnown && !hasInnate) {
      return { met: false, reason: "Requires the ability to cast at least one spell" };
    }
  }

  // 4. Level Requirement (e.g. "Level 4", "Level 4; strike of the giants")
  const levelMatch = prereq.match(/level\s*(\d+)/i);
  if (levelMatch) {
    const reqLevel = parseInt(levelMatch[1], 10);
    if (lvl < reqLevel) {
      return { met: false, reason: `Requires Character Level ${reqLevel}` };
    }
  }

  // Chained feat requirement (e.g. "Level 4; strike of the giants")
  const featChainMatch = prereq.match(/level\s*\d+;\s*(.*?)$/i);
  if (featChainMatch) {
    const requiredFeat = featChainMatch[1].trim();
    if (!hasFeat(character, requiredFeat)) {
      return { met: false, reason: `Requires ${requiredFeat}` };
    }
  }

  // 5. Racial Requirements
  if (/\belf or half-elf\b/i.test(prereq)) {
    const isElf = raceName.includes("elf") || subraceName.includes("elf");
    if (!isElf) return { met: false, reason: "Requires elf or half-elf" };
  } else if (/\bhalf-elf or half-orc or human\b/i.test(prereq)) {
    const matches = raceName.includes("half-elf") || raceName.includes("half-orc") || raceName.includes("human");
    if (!matches) return { met: false, reason: "Requires half-elf, half-orc, or human" };
  } else if (/\bhalf-orc\b/i.test(prereq)) {
    if (!raceName.includes("half-orc")) return { met: false, reason: "Requires half-orc" };
  } else if (/\belf\b/i.test(prereq) && !/half-elf/i.test(prereq)) {
    const isPureElf = (raceName.includes("elf") || subraceName.includes("elf")) && !raceName.includes("half-elf");
    if (!isPureElf) return { met: false, reason: "Requires elf" };
  } else if (/\bdwarf or small race\b/i.test(prereq)) {
    const isDwarfOrSmall =
      raceName.includes("dwarf") ||
      subraceName.includes("dwarf") ||
      ["gnome", "halfling", "kobold", "goblin", "fairy"].some(r => raceName.includes(r));
    if (!isDwarfOrSmall) return { met: false, reason: "Requires dwarf or small race" };
  } else if (/\bdwarf\b/i.test(prereq)) {
    if (!raceName.includes("dwarf") && !subraceName.includes("dwarf")) {
      return { met: false, reason: "Requires dwarf" };
    }
  } else if (/\bdragonborn\b/i.test(prereq)) {
    if (!raceName.includes("dragonborn")) return { met: false, reason: "Requires dragonborn" };
  } else if (/\btiefling\b/i.test(prereq)) {
    if (!raceName.includes("tiefling")) return { met: false, reason: "Requires tiefling" };
  } else if (/\bgnome\b/i.test(prereq)) {
    if (!raceName.includes("gnome") && !subraceName.includes("gnome")) {
      return { met: false, reason: "Requires gnome" };
    }
  } else if (/\bhalfling\b/i.test(prereq)) {
    if (!raceName.includes("halfling") && !subraceName.includes("halfling")) {
      return { met: false, reason: "Requires halfling" };
    }
  }

  return { met: true };
}

/**
 * Adds an origin feat, or replaces the one named by `oldFeatName`, then reconciles so that the
 * choices the replaced feat granted (e.g. Fighting Initiate's style) are pruned with a review notice.
 * The spells only the replaced feat's expanded list gave are released too (ADR 0017).
 */
export function applyOriginFeat(
  character: Character,
  selection: AsiSelection,
  oldFeatName?: string,
  compendium: Compendium = currentCompendium()
): Character {
  const current = character.originFeats || [];
  const targetName = (oldFeatName || selection.featName)?.toLowerCase();
  const existingIdx = current.findIndex(s => s.featName?.toLowerCase() === targetName);
  const updated = [...current];
  if (existingIdx >= 0) {
    updated[existingIdx] = selection;
  } else {
    updated.push(selection);
  }
  return releaseExpandedOnlySpells(
    character,
    reconcile({ ...character, originFeats: updated }, compendium),
    compendium
  );
}

/**
 * Adds the feat a background grants, or the one of its choices the player takes. It carries the Background source, so
 * clearing the background removes it with its picks and counters. Its picks are made on its card, as for any origin feat.
 */
export function grantBackgroundFeat(
  character: Character,
  featName: string,
  featAbility?: AbilityKey,
  compendium: Compendium = currentCompendium()
): Character {
  return applyOriginFeat(character, { level: 1, type: "feat", featName, featSource: BACKGROUND_FEAT_SOURCE, featAbility }, undefined, compendium);
}

/** Removes an origin feat by name, then reconciles the choices that feat granted. */
export function removeOriginFeat(
  character: Character,
  featName: string,
  compendium: Compendium = currentCompendium()
): Character {
  const current = character.originFeats || [];
  const updated = current.filter(s => s.featName?.toLowerCase() !== featName.toLowerCase());
  // The spells only the feat's expanded list gave are released, with a notice (ADR 0017).
  return releaseExpandedOnlySpells(
    character,
    reconcile({ ...character, originFeats: updated }, compendium),
    compendium
  );
}

/** Known background feat grants mapping. */
export const BACKGROUND_FEATS: Record<string, { featName: string; isChoice?: boolean; choiceOptions?: string[] }> = {
  "Giant Foundling": { featName: "Strike of the Giants" },
  "Rune Carver": { featName: "Rune Shaper" },
  "Astral Drifter": { featName: "Magic Initiate" },
  "Wildspacer": { featName: "Tough" },
  "Knight of Solamnia": { featName: "Squire of Solamnia" },
  "Mage of High Sorcery": { featName: "Initiate of High Sorcery" },
  "Lorehold Student": { featName: "Strixhaven Initiate" },
  "Prismari Student": { featName: "Strixhaven Initiate" },
  "Quandrix Student": { featName: "Strixhaven Initiate" },
  "Silverquill Student": { featName: "Strixhaven Initiate" },
  "Witherbloom Student": { featName: "Strixhaven Initiate" },
  "Gate Warden": { featName: "Scion of the Outer Planes" },
  "Planar Philosopher": { featName: "Scion of the Outer Planes" },
  "Rewarded": { featName: "Lucky", isChoice: true, choiceOptions: ["Lucky", "Magic Initiate", "Skilled"] },
  "Ruined": { featName: "Alert", isChoice: true, choiceOptions: ["Alert", "Skilled", "Tough"] },
};

/** Checks if a background grants a feat. */
export function getBackgroundFeatGrant(
  backgroundName: string,
  featureDesc?: string,
): { featName: string; isChoice?: boolean; choiceOptions?: string[] } | null {
  if (BACKGROUND_FEATS[backgroundName]) {
    return BACKGROUND_FEATS[backgroundName];
  }
  if (featureDesc) {
    const match = featureDesc.match(/gain the (.*?) feat/i);
    if (match) {
      return { featName: match[1].trim() };
    }
  }
  return null;
}
