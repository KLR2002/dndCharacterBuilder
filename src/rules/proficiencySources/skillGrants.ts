import type { Character } from "../../types/character.ts";
import type { ClassData, RaceData } from "../../types/dnd5e.ts";
import { DND_SKILLS } from "../../constants/rules.ts";
import { catalogListings, type CharacterCatalogs } from "../catalogs.ts";
import { normalizeSkillName } from "../skills.ts";

/**
 * The skills a character holds from the rules that are not Proficiency Grants: a custom background's picks,
 * the skills named in race trait text, and the Rule Choice picks of the lineage rules. A race's and a
 * background's fixed skills are Proficiency Grants, read by the sheet from the features it holds. The
 * skill choice offers of a race and a class live here too, and the sheet passes them to the Builder.
 * Private to the Proficiency Sheet (ADR 0015).
 */
export function getAutoGrantedSkills(
  character: Character,
  opts: {
    race?: { name?: string; traits?: { name: string; description?: string }[] };
    subrace?: { name?: string; traits?: { name: string; description?: string }[] };
    /** Resolves race names. Without it, no catalog lookup happens. */
    catalogs?: CharacterCatalogs;
    /** Explicit lists take precedence over the catalog bundle. */
    races?: RaceData[];
  } = {}
): string[] {
  const granted = new Set<string>();
  const listings = opts.catalogs ? catalogListings(opts.catalogs) : undefined;
  const races = opts.races ?? listings?.races();

  // 1. A custom background's picked skills. A catalog background's skills are its grants.
  if (character.background?.name && character.background.source === "Custom") {
    const customEntry = character.skillChoices?.find((sc) => sc.origin === "background");
    if (customEntry?.picked) {
      for (const s of customEntry.picked) {
        const norm = normalizeSkillName(s);
        if (norm) granted.add(norm);
      }
    }
  }

  // 2. Race traits description scanning if traits present
  const traits = [
    ...(opts.race?.traits || []),
    ...(opts.subrace?.traits || []),
    ...(races?.find((r) => r.name.toLowerCase() === character.race?.name?.toLowerCase())?.traits || []),
    ...(races
      ?.find((r) => r.name.toLowerCase() === character.race?.name?.toLowerCase())
      ?.subraces?.find((sr) => sr.name.toLowerCase() === character.race?.subraceName?.toLowerCase())?.traits || []),
  ];
  for (const t of traits) {
    const desc = t.description || "";
    for (const skill of DND_SKILLS) {
      const reg = new RegExp(
        `(?:proficient in|proficiency in)(?: the)?\\s+${skill.name}\\s+skill|\\{@skill\\s+${skill.name}\\}`,
        "i"
      );
      if (reg.test(desc)) {
        granted.add(skill.name);
      }
    }
  }

  // 3. Rule Choices skill picks (e.g. Ancestral Legacy, Primal Knowledge)
  for (const rc of character.ruleChoices || []) {
    if (
      rc.trait?.toLowerCase().includes("ancestral legacy") ||
      rc.id.toLowerCase().includes("ancestral legacy") ||
      rc.trait?.toLowerCase().includes("primal knowledge") ||
      rc.id.toLowerCase().includes("primal knowledge")
    ) {
      for (const p of rc.picked || []) {
        const norm = normalizeSkillName(p);
        if (norm) granted.add(norm);
      }
    }
  }

  return Array.from(granted);
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


/** A class's starting skill choice as the Catalog holds it. Undefined when the class holds none. */
export function classSkillChoice(cls: ClassData | undefined): { choose: number; from: string[] } | undefined {
  return cls?.skillProficiencies;
}
