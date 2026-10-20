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

export function isKnowledgeCleric(character: Character): boolean {
  return (character.classes || []).some(
    (c) =>
      c.className === "Cleric" &&
      Boolean((c.subclassName || c.subclass)?.toLowerCase().includes("knowledge")) &&
      c.level >= 1
  );
}

export function normalizeSkillName(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const found = DND_SKILLS.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  return found ? found.name : trimmed;
}

/**
 * The skill rows. Proficiency comes from the Proficiency Sheet's skills (ticket 11), passed in, so the
 * card, Expertise and every other reader agree on which skills the character holds. Expertise and
 * Jack of All Trades are decided here.
 */
export function skills(
  character: Character,
  sheetSkills: readonly { name: string }[],
  opts: ResolvedAncestry = {}
): SkillRow[] {
  const { modifiers } = effectiveScores(character, opts);
  const prof = proficiencyBonus(totalLevel(character));
  const jack = (character.classes || []).some((c) => c.className === "Bard" && c.level >= 2);

  const proficientSkillNames = new Set(sheetSkills.map((entry) => normalizeSkillName(entry.name)));

  // Normalize chosen expertise
  const expertiseSkillNames = new Set<string>();
  for (const s of character.chosenExpertise || []) {
    const norm = normalizeSkillName(s);
    if (norm) expertiseSkillNames.add(norm);
  }

  return DND_SKILLS.map((skill) => {
    const isProficient = proficientSkillNames.has(skill.name);
    const isExpertise = isProficient && expertiseSkillNames.has(skill.name);
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

