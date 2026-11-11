import type { ActiveBooks } from "../../constants/books.ts";
import type { Character } from "../../types/character.ts";
import type { ClassData, RaceData } from "../../types/dnd5e.ts";
import { DND_SKILLS } from "../../constants/rules.ts";
import { catalogListings, type CharacterCatalogs } from "../catalogs.ts";
import { findHeldRace } from "../raceLookup.ts";
import { normalizeSkillName } from "../skills.ts";

/** What the skill readers below take: the held race and subrace, and where the race is looked up. */
interface SkillSourceOptions {
  race?: { name?: string; traits?: { name: string; description?: string }[] };
  subrace?: { name?: string; traits?: { name: string; description?: string }[] };
  /** Resolves race names. Without it, no catalog lookup happens. */
  catalogs?: CharacterCatalogs;
  /** Explicit lists take precedence over the catalog bundle. */
  races?: RaceData[];
  /** The books the held race is read in. The saved source still wins. */
  activeBooks: ActiveBooks;
}

/** One pattern per skill, built once: the skill list is a constant. */
const TRAIT_SKILL_PATTERNS = DND_SKILLS.map((skill) => ({
  name: skill.name,
  pattern: new RegExp(
    `(?:proficient in|proficiency in)(?: the)?\\s+${skill.name}\\s+skill|\\{@skill\\s+${skill.name}\\}`,
    "i"
  ),
}));

/** The skills each trait description names, keyed by the description. Catalog text does not change while the app runs. */
const descriptionSkills = new Map<string, string[]>();

function skillsNamedBy(desc: string): string[] {
  const cached = descriptionSkills.get(desc);
  if (cached) return cached;
  const named = TRAIT_SKILL_PATTERNS.filter(({ pattern }) => pattern.test(desc)).map(({ name }) => name);
  descriptionSkills.set(desc, named);
  return named;
}

/**
 * The skills the race and subrace trait text names. A race swap removes these, so the sheet reads them apart from the
 * Rule Choice picks. Private to the Proficiency Sheet (ADR 0015).
 */
export function traitTextSkills(character: Character, opts: SkillSourceOptions): string[] {
  const granted = new Set<string>();
  const listings = opts.catalogs ? catalogListings(opts.catalogs) : undefined;
  const races = opts.races ?? listings?.races();

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
    for (const name of skillsNamedBy(t.description || "")) granted.add(name);
  }
  return Array.from(granted);
}

/** The skills the Rule Choice picks of the lineage rules (e.g. Ancestral Legacy, Primal Knowledge) hold. */
export function ruleChoiceSkills(character: Character): string[] {
  const granted = new Set<string>();
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

/**
 * The skills a character holds from the rules that are not Proficiency Grants: the skills named in race trait
 * text, and the Rule Choice picks of the lineage rules. A race's and a background's fixed skills and skill
 * choices are Proficiency Grants, read by the sheet from the features it holds. Private to the Proficiency
 * Sheet (ADR 0015).
 */
export function getAutoGrantedSkills(character: Character, opts: SkillSourceOptions): string[] {
  return [...new Set([...traitTextSkills(character, opts), ...ruleChoiceSkills(character)])];
}

/** A class's starting skill choice as the Catalog holds it. Undefined when the class holds none. */
export function classSkillChoice(cls: ClassData | undefined): { choose: number; from: string[] } | undefined {
  return cls?.skillProficiencies;
}
