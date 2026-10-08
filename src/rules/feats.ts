import type { AbilityKey, AbilityScores, AsiSelection, Character } from "../types/character.ts";
import { effectiveScores, hasFeat } from "./abilities.ts";
import { totalLevel } from "./proficiencies.ts";
import { isCastingClass } from "./spellcasting.ts";
import { getInnateSpellProfile } from "./innateMagic.ts";
import { MULTICLASS_PROFICIENCIES } from "../constants/rules.ts";

export interface FeatPrerequisiteResult {
  met: boolean;
  reason?: string;
}

export interface FeatPrerequisiteOptions {
  effectiveScores?: AbilityScores;
  armorProficiencies?: string[];
  weaponProficiencies?: string[];
  totalLevel?: number;
}

/** Standard armor proficiencies derived directly from character classes without external data catalogs. */
function getDerivedArmorProficiencies(character: Character): string[] {
  const armors = new Set<string>();
  for (const [index, c] of (character.classes || []).entries()) {
    if (c.level < 1) continue;
    if (index === 0) {
      if (["Barbarian", "Cleric", "Druid"].includes(c.className)) {
        armors.add("Light armor");
        armors.add("Medium armor");
        armors.add("Shields");
      } else if (["Fighter", "Paladin"].includes(c.className)) {
        armors.add("Light armor");
        armors.add("Medium armor");
        armors.add("Heavy armor");
        armors.add("Shields");
      } else if (["Bard", "Ranger", "Rogue", "Warlock"].includes(c.className)) {
        armors.add("Light armor");
        if (c.className === "Ranger") {
          armors.add("Medium armor");
          armors.add("Shields");
        }
      }
    } else {
      const mc = MULTICLASS_PROFICIENCIES[c.className]?.armor || [];
      for (const a of mc) armors.add(a);
    }
  }
  const race = character.race?.name || "";
  const subrace = character.race?.subraceName || "";
  if (subrace === "Mountain Dwarf" || race === "Mountain Dwarf" || race === "Githyanki") {
    armors.add("Light armor");
    armors.add("Medium armor");
  }
  return Array.from(armors);
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
  const armors = options.armorProficiencies || getDerivedArmorProficiencies(character);
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
    const canCastClass = (character.classes || []).some(isCastingClass);
    const hasKnown = (character.knownSpells || []).length > 0;
    const hasInnate = getInnateSpellProfile(character) != null;
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

/** Adds or updates an origin feat on character. */
export function applyOriginFeat(character: Character, selection: AsiSelection, oldFeatName?: string): Character {
  const current = character.originFeats || [];
  const targetName = (oldFeatName || selection.featName)?.toLowerCase();
  const existingIdx = current.findIndex(s => s.featName?.toLowerCase() === targetName);
  const updated = [...current];
  if (existingIdx >= 0) {
    updated[existingIdx] = selection;
  } else {
    updated.push(selection);
  }
  return {
    ...character,
    originFeats: updated,
  };
}

/** Removes an origin feat by name. */
export function removeOriginFeat(character: Character, featName: string): Character {
  const current = character.originFeats || [];
  const updated = current.filter(s => s.featName?.toLowerCase() !== featName.toLowerCase());
  return {
    ...character,
    originFeats: updated,
  };
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
