import type { AbilityKey, Character } from "../types/character.ts";
import type { ResolvedAncestry } from "./types.ts";
import type { BackgroundData } from "../types/dnd5e.ts";
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

export const RACE_SKILL_PROFICIENCIES: Record<string, string[]> = {
  Bugbear: ["Stealth"],
  Elf: ["Perception"],
  "High Elf": ["Perception"],
  "Wood Elf": ["Perception"],
  Drow: ["Perception"],
  "Dark Elf (Drow)": ["Perception"],
  Eladrin: ["Perception"],
  "Sea Elf": ["Perception"],
  "Shadar-kai": ["Perception"],
  "Pallid Elf": ["Perception"],
  "Astral Elf": ["Perception"],
  "Half-Orc": ["Intimidation"],
  Orc: ["Intimidation"],
  Tabaxi: ["Perception", "Stealth"],
  Satyr: ["Performance", "Persuasion"],
  Goliath: ["Athletics"],
  Owlin: ["Stealth"],
  Harengon: ["Perception"],
  Grung: ["Perception"],
  Tortle: ["Survival"],
};

export const BACKGROUND_SKILL_PROFICIENCIES: Record<string, string[]> = {
  Acolyte: ["Insight", "Religion"],
  Charlatan: ["Deception", "Sleight of Hand"],
  Criminal: ["Deception", "Stealth"],
  Spy: ["Deception", "Stealth"],
  Entertainer: ["Acrobatics", "Performance"],
  Gladiator: ["Acrobatics", "Performance"],
  "Folk Hero": ["Animal Handling", "Survival"],
  "Guild Artisan": ["Insight", "Persuasion"],
  "Guild Merchant": ["Insight", "Persuasion"],
  Hermit: ["Medicine", "Religion"],
  Noble: ["History", "Persuasion"],
  Knight: ["History", "Persuasion"],
  Outlander: ["Athletics", "Survival"],
  Sage: ["Arcana", "History"],
  Sailor: ["Athletics", "Perception"],
  Pirate: ["Athletics", "Perception"],
  Soldier: ["Athletics", "Intimidation"],
  Urchin: ["Sleight of Hand", "Stealth"],
};

export function normalizeSkillName(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const found = DND_SKILLS.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  return found ? found.name : trimmed;
}

export function skills(
  character: Character,
  opts: ResolvedAncestry & {
    backgrounds?: BackgroundData[];
  } = {}
): SkillRow[] {
  const { modifiers } = effectiveScores(character, opts);
  const prof = proficiencyBonus(totalLevel(character));
  const jack = (character.classes || []).some((c) => c.className === "Bard" && c.level >= 2);

  const proficientSkillNames = new Set<string>();

  // 1. Chosen skills (normalized / case-insensitive)
  for (const s of character.chosenSkills || []) {
    const norm = normalizeSkillName(s);
    if (norm) proficientSkillNames.add(norm);
  }

  // 2. Background skills
  if (character.background?.name) {
    const fromCatalog = opts.backgrounds?.find(
      (b) => b.name.toLowerCase() === character.background!.name.toLowerCase()
    );
    if (fromCatalog?.skillProficiencies) {
      for (const s of fromCatalog.skillProficiencies) {
        const norm = normalizeSkillName(s);
        if (norm) proficientSkillNames.add(norm);
      }
    } else {
      const standard = BACKGROUND_SKILL_PROFICIENCIES[character.background.name];
      if (standard) {
        for (const s of standard) {
          proficientSkillNames.add(s);
        }
      }
    }
  }

  // 3. Race skill proficiencies from static map
  if (character.race?.name) {
    const raceSkills = RACE_SKILL_PROFICIENCIES[character.race.name];
    if (raceSkills) {
      for (const s of raceSkills) proficientSkillNames.add(s);
    }
    if (character.race.subraceName) {
      const subraceSkills = RACE_SKILL_PROFICIENCIES[character.race.subraceName];
      if (subraceSkills) {
        for (const s of subraceSkills) proficientSkillNames.add(s);
      }
    }
  }

  // 4. Race traits description scanning if traits present
  const traits = [
    ...(opts.race?.traits || []),
    ...(opts.subrace?.traits || []),
  ];
  for (const t of traits) {
    const desc = t.description || "";
    for (const skill of DND_SKILLS) {
      const reg = new RegExp(
        `(?:proficient in|proficiency in)(?: the)?\\s+${skill.name}\\s+skill|\\{@skill\\s+${skill.name}\\}`,
        "i"
      );
      if (reg.test(desc)) {
        proficientSkillNames.add(skill.name);
      }
    }
  }

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

