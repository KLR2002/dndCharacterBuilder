import type { Character, CharacterClass } from "../../types/character.ts";
import type { ClassData } from "../../types/dnd5e.ts";
import { ABILITY_NAMES, abilityKeyOf } from "../abilities.ts";
import { normalizeArmorProficiency, normalizeWeaponProficiency } from "../proficiencies.ts";
import { normalizeSkillName } from "../skills.ts";
import { findClassData } from "../catalogs.ts";
import { heldClass } from "../classData.ts";

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
  /** The skill choice the class adds, from the list its record gives. Absent when the record names none. */
  skills?: { choose: number; from: string[] };
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
 * later class cannot be taken from. A record with no `proficienciesGained` grants nothing.
 */
export function multiclassGrantsOf(entry: { className: string; source?: string }, classes: readonly ClassData[]): MulticlassGrants | undefined {
  const held = heldClass(entry, classes);
  if (!held?.multiclassing) return undefined;
  const gained = held.multiclassing.proficienciesGained;
  const choice = (gained?.skills ?? []).find((s: { choose?: unknown } | null) => s?.choose);
  return {
    armor: (gained?.armor ?? []).map(grantToken).filter(Boolean).map(normalizeArmorProficiency),
    weapons: (gained?.weapons ?? []).map(grantToken).filter(Boolean).map(normalizeWeaponProficiency),
    tools: (gained?.tools ?? []).map(plainText).filter(Boolean).map((t) => t.charAt(0).toUpperCase() + t.slice(1)),
    ...(choice
      ? { skills: { choose: choice.choose.count ?? 1, from: (choice.choose.from ?? []).map((s: string) => normalizeSkillName(plainText(s))) } }
      : {}),
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
