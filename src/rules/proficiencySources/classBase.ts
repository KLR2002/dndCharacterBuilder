import type { Character, CharacterClass } from "../../types/character.ts";
import type { ClassData } from "../../types/dnd5e.ts";
import { ABILITY_NAMES, abilityKeyOf } from "../abilities.ts";
import { normalizeArmorProficiency, normalizeWeaponProficiency } from "../proficiencies.ts";
import { normalizeSkillName } from "../skills.ts";
import { findClassData } from "../catalogs.ts";
import { heldClass } from "../classData.ts";
import type { ChoiceProficiencyGrant } from "../proficiencyPools.ts";

/** The feature a later class's multiclass skill choice is printed on. The Class card titles its pick after the class. */
export const MULTICLASS_FEATURE = "Multiclass Proficiencies";

/**
 * The saving throws the first class grants, as the Catalog class the entry holds writes them (full names or
 * keys). Empty for a class that is not held or names no ability.
 */
export function classBaseSavingThrows(first: CharacterClass | undefined, classes: readonly ClassData[]): string[] {
  if (!first) return [];
  const saves = heldClass(first, classes)?.savingThrows ?? [];
  return saves.flatMap((raw) => {
    const key = abilityKeyOf(raw);
    return key ? [ABILITY_NAMES[key]] : [];
  });
}

/** What a later class grants, named as the Proficiency Sheet names it. Tool names keep the Catalog's words with the first letter capitalized. */
export interface MulticlassGrants {
  armor: string[];
  weapons: string[];
  tools: string[];
}

/** Catalog text with its tags removed: `{@item shortsword|phb|shortswords}` reads as `shortsword`. */
function plainText(raw: string): string {
  return raw.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, "$1").trim();
}

/** The token one armor or weapon grant names, from a plain entry or from an object's `proficiency`. */
function grantToken(raw: unknown): string {
  const token = typeof raw === "string" ? raw : (raw as { proficiency?: unknown } | null)?.proficiency;
  return typeof token === "string" ? plainText(token) : "";
}

/**
 * The multiclass grants of the class an entry holds, from the Catalog class's `multiclassing.proficienciesGained`
 * (the SRD Baseline when the catalog lacks it). Undefined for a class with no `multiclassing` record, which a
 * later class cannot be taken from. A record with no `proficienciesGained` grants nothing. Its skill choice is
 * `multiclassSkillGrantOf`.
 */
export function multiclassGrantsOf(entry: { className: string; source?: string }, classes: readonly ClassData[]): MulticlassGrants | undefined {
  const held = heldClass(entry, classes);
  if (!held?.multiclassing) return undefined;
  const gained = held.multiclassing.proficienciesGained;
  return {
    armor: (gained?.armor ?? []).map(grantToken).filter(Boolean).map(normalizeArmorProficiency),
    weapons: (gained?.weapons ?? []).map(grantToken).filter(Boolean).map(normalizeWeaponProficiency),
    tools: (gained?.tools ?? []).map(plainText).filter(Boolean).map((t) => t.charAt(0).toUpperCase() + t.slice(1)),
  };
}

/**
 * The skill choice a class grants a character who takes it as a later class, as a Proficiency Choice. The pool is the
 * record's list, or every skill when the record names none. The id names the class and the kind of pool, never the
 * pool or the count (ADR 0015). Undefined when the record gives no skill choice.
 */
export function multiclassSkillGrantOf(cls: ClassData): ChoiceProficiencyGrant | undefined {
  const choice = (cls.multiclassing?.proficienciesGained?.skills ?? []).find((s: { choose?: unknown } | null) => s?.choose);
  if (!choice) return undefined;
  const names: string[] = (choice.choose.from ?? []).map((s: string) => normalizeSkillName(plainText(s)));
  const pool = names.length > 0 ? ({ kind: "names", names } as const) : ({ kind: "any" } as const);
  return {
    // The feature is gained at level 1 of the class, so the id carries level 1.
    id: `${cls.source}/${cls.name}/${MULTICLASS_FEATURE}@1#skills:choice:${pool.kind === "names" ? "from" : "any"}`,
    kind: "choice",
    category: "skills",
    count: choice.choose.count ?? 1,
    pool,
  };
}

/**
 * The armor and weapon proficiencies the character's classes grant: the first class's starting proficiencies
 * from the class data, and each later class's multiclass grants from `catalogClasses` (every book, so a later
 * class keeps its grants when a book is turned off). Private to the Proficiency Sheet (ADR 0015); nothing
 * outside the sheet reads a class's proficiency fields.
 */
export function classBaseProficiencies(character: Character, classes: ClassData[], catalogClasses: readonly ClassData[] = classes) {
  const armor = new Set<string>(), weapons = new Set<string>();
  for (const [index, c] of character.classes.entries()) {
    if (c.level < 1) continue;
    const data = findClassData(classes, c);
    const grants = index === 0 ? { armor: data?.armorProficiencies, weapons: data?.weaponProficiencies } : multiclassGrantsOf(c, catalogClasses);
    for (const x of grants?.armor || []) {
      if (x && x.trim()) armor.add(normalizeArmorProficiency(x));
    }
    for (const x of grants?.weapons || []) {
      if (x && x.trim()) weapons.add(normalizeWeaponProficiency(x));
    }
  }
  return { armor: [...armor], weapons: [...weapons] };
}
