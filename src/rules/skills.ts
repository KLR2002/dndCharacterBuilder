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

export function isKnowledgeCleric(character: Character): boolean {
  return (character.classes || []).some(
    (c) =>
      c.className === "Cleric" &&
      Boolean((c.subclassName || c.subclass)?.toLowerCase().includes("knowledge")) &&
      c.level >= 1
  );
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

  // 1b. Rule Choices skill picks (e.g. Ancestral Legacy, Primal Knowledge)
  for (const rc of character.ruleChoices || []) {
    if (
      rc.trait?.toLowerCase().includes("ancestral legacy") ||
      rc.id.toLowerCase().includes("ancestral legacy") ||
      rc.trait?.toLowerCase().includes("primal knowledge") ||
      rc.id.toLowerCase().includes("primal knowledge")
    ) {
      for (const p of rc.picked || []) {
        const norm = normalizeSkillName(p);
        if (norm) proficientSkillNames.add(norm);
      }
    }
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

  // 5. Knowledge Domain Cleric (Blessings of Knowledge)
  if (isKnowledgeCleric(character)) {
    const KNOWLEDGE_SKILLS = ["Arcana", "History", "Nature", "Religion"];
    for (const exp of character.chosenExpertise || []) {
      const norm = normalizeSkillName(exp);
      if (KNOWLEDGE_SKILLS.includes(norm)) {
        proficientSkillNames.add(norm);
      }
    }
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

export interface RacialSkillChoice {
  source: string;
  choose: number;
  from: string[];
}

export function getRacialSkillChoices(
  raceName?: string,
  subraceName?: string,
  raceCatalog: any[] = [],
  source?: string,
  /** The Rule Choice option the character picked, when the subrace offers one. */
  chosenOption?: string
): RacialSkillChoice[] {
  if (!raceName) return [];

  const norm = raceName.toLowerCase();
  const race =
    (source
      ? raceCatalog.find(
          (r) =>
            r.name.toLowerCase() === norm &&
            r.source?.toLowerCase() === source.toLowerCase()
        )
      : null) ||
    raceCatalog.find(
      (r) => r.name.toLowerCase() === norm && r.source !== "DMG"
    ) ||
    raceCatalog.find((r) => r.name.toLowerCase() === norm);
  if (!race) return [];

  const choices: RacialSkillChoice[] = [];
  const allSkillNames = DND_SKILLS.map((s) => s.name);

  const parseTrait = (t: { name: string; description?: string }) => {
    const desc = t.description || "";

    // 1. All-skill wildcards: e.g. "proficiency in two skills of your choice" or "proficiency with one skill of your choice"
    const wildcardMatch = desc.match(
      /(?:gain\s+)?proficiency\s+(?:in|with)\s+(one|two|three|\d+)\s+skills?\s+of\s+your\s+choice/i
    );
    if (wildcardMatch) {
      const numMap: Record<string, number> = { one: 1, two: 2, three: 3 };
      const count =
        numMap[wildcardMatch[1].toLowerCase()] ||
        parseInt(wildcardMatch[1], 10) ||
        1;
      choices.push({
        source: `Race: ${t.name}`,
        choose: count,
        from: allSkillNames,
      });
      return;
    }

    // 2. Constrained skill lists: e.g. "proficiency with two of the following skills of your choice: Animal Handling, Nature, Perception, Stealth, or Survival."
    const listMatch = desc.match(
      /proficiency\s+(?:in|with)\s+(one|two|three|\d+)\s+(?:of\s+the\s+following\s+skills|skills)\s*(?:of\s+your\s+choice)?:?\s*([^.\n]+)/i
    );
    if (listMatch) {
      const numMap: Record<string, number> = { one: 1, two: 2, three: 3 };
      const count =
        numMap[listMatch[1].toLowerCase()] ||
        parseInt(listMatch[1], 10) ||
        1;
      const listStr = listMatch[2];
      const matched = allSkillNames.filter((s) =>
        new RegExp(`\\b${s}\\b`, "i").test(listStr)
      );
      if (matched.length > 0) {
        choices.push({
          source: `Race: ${t.name}`,
          choose: count,
          from: matched,
        });
      }
    }
  };

  const isHalfElf = race.name.toLowerCase() === "half-elf";
  const subrace = subraceName && race.subraces
    ? race.subraces.find((sr: any) => sr.name && sr.name.toLowerCase() === subraceName.toLowerCase())
    : null;

  if (isHalfElf) {
    if (!subrace) {
      // Base PHB Half-Elf has Skill Versatility
      choices.push({
        source: "Race: Skill Versatility",
        choose: 2,
        from: allSkillNames,
      });
    } else {
      // A variant half-elf has no Skill Versatility of its own: its descent
      // offers a pick, and Skill Versatility is one of the offered options. Only
      // a pick of Skill Versatility grants the two skills.
      if (chosenOption === "Skill Versatility") {
        choices.push({
          source: "Race: Skill Versatility",
          choose: 2,
          from: allSkillNames,
        });
      } else if (!chosenOption) {
        // The Mark variants have no pick at all and no Skill Versatility.
        const svTrait = (subrace.traits || []).find((t: any) => t.name === "Skill Versatility");
        if (svTrait) parseTrait(svTrait);
      }
    }
  } else {
    for (const t of race.traits || []) {
      parseTrait(t);
    }
    if (subrace) {
      for (const t of subrace.traits || []) {
        parseTrait(t);
      }
    }
  }

  return choices;
}

