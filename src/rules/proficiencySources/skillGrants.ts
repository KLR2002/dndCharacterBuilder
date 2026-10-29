import type { Character } from "../../types/character.ts";
import type { ClassData, RaceData } from "../../types/dnd5e.ts";
import { DND_SKILLS } from "../../constants/rules.ts";
import { catalogListings, type CharacterCatalogs } from "../catalogs.ts";
import { findHeldRace } from "../raceLookup.ts";
import { normalizeSkillName } from "../skills.ts";

/**
 * The skills a character holds from the rules that are not Proficiency Grants: the skills named in race trait
 * text, and the Rule Choice picks of the lineage rules. A race's and a background's fixed skills and skill
 * choices are Proficiency Grants, read by the sheet from the features it holds. Private to the Proficiency
 * Sheet (ADR 0015).
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
    /** The books the held race is read in. The saved source still wins. */
    activeBooks?: readonly string[];
  } = {}
): string[] {
  const granted = new Set<string>();
  const listings = opts.catalogs ? catalogListings(opts.catalogs) : undefined;
  const races = opts.races ?? listings?.races();

  // 1. Race traits description scanning if traits present
  const held = races ? findHeldRace(races, character.race, opts.activeBooks) : undefined;
  const traits = [
    ...(opts.race?.traits || []),
    ...(opts.subrace?.traits || []),
    ...(held?.race?.traits || []),
    ...(held?.subrace?.traits || []),
  ];
  for (const t of traits) {
    // Stonecunning's text only conditions a History check; it does not make the character proficient.
    if (t.name === "Stonecunning") continue;
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

  // 2. Rule Choices skill picks (e.g. Ancestral Legacy, Primal Knowledge)
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

/** A class's starting skill choice as the Catalog holds it. Undefined when the class holds none. */
export function classSkillChoice(cls: ClassData | undefined): { choose: number; from: string[] } | undefined {
  return cls?.skillProficiencies;
}
