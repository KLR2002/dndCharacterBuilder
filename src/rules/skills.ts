import type { AbilityKey, Character } from "../types/character.ts";
import type { ResolvedAncestry } from "./types.ts";
import { DND_SKILLS } from "../constants/rules.ts";
import { effectiveScores, hasFeat } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";

export interface SkillRow {
  name: string;
  ability: AbilityKey;
  isProficient: boolean;
  isExpertise: boolean;
  isJackOfAllTrades: boolean;
  bonus: number;
  passiveBonus: number;
}

export function normalizeSkillName(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const found = DND_SKILLS.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  return found ? found.name : trimmed;
}

/**
 * The skill rows. Proficiency comes from the Proficiency Sheet's skills, passed in, so the
 * card, Expertise and every other reader agree on which skills the character holds. A sheet entry
 * carries Expertise when a Proficiency Grant gives it; a chosen Expertise adds the rest. Jack of All
 * Trades is decided here.
 */
export function skills(
  character: Character,
  sheetSkills: readonly { name: string; expertise?: true }[],
  opts: ResolvedAncestry = {}
): SkillRow[] {
  const { modifiers } = effectiveScores(character, opts);
  const prof = proficiencyBonus(totalLevel(character));
  const jack = (character.classes || []).some((c) => c.className === "Bard" && c.level >= 2);

  const proficientSkillNames = new Set(sheetSkills.map((entry) => normalizeSkillName(entry.name)));
  const grantExpertiseNames = new Set(sheetSkills.filter((entry) => entry.expertise).map((entry) => normalizeSkillName(entry.name)));

  // Normalize chosen expertise
  const expertiseSkillNames = new Set<string>();
  for (const s of character.chosenExpertise || []) {
    const norm = normalizeSkillName(s);
    if (norm) expertiseSkillNames.add(norm);
  }

  return DND_SKILLS.map((skill) => {
    const isProficient = proficientSkillNames.has(skill.name);
    const isExpertise = isProficient && (grantExpertiseNames.has(skill.name) || expertiseSkillNames.has(skill.name));
    const isJackOfAllTrades = !isProficient && jack;
    const bonus =
      modifiers[skill.ability] +
      (isExpertise
        ? 2 * prof
        : isProficient
        ? prof
        : isJackOfAllTrades
        ? Math.floor(prof / 2)
        : 0);
    const passiveBonus =
      10 +
      bonus +
      (hasFeat(character, "Observant") &&
      ["Perception", "Investigation"].includes(skill.name)
        ? 5
        : 0);
    return {
      ...skill,
      isProficient,
      isExpertise,
      isJackOfAllTrades,
      bonus,
      passiveBonus,
    };
  });
}

