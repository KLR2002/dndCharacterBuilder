import type { AbilityKey, Character } from "../types/character.ts";
import type { ItemData, ProficiencyGrant, ProficiencyPool } from "../types/dnd5e.ts";
import { ABILITY_NAMES } from "./abilities.ts";
import { ALL_LANGUAGE_NAMES, ALL_TOOLS, normalizeToolName } from "./proficienciesAndLanguages.ts";
import { normalizeWeaponProficiency, STANDARD_MARTIAL_WEAPONS, STANDARD_SIMPLE_WEAPONS } from "./proficiencies.ts";
import { normalizeSkillName } from "./skills.ts";
import { DND_SKILLS } from "../constants/rules.ts";

/**
 * Proficiency Choices. A leaf module: the Proficiency Sheet, the choice offers, the
 * rule-choice pick, the Monk Weapon rule and the reconciler all read it, so it imports nothing that
 * imports them back.
 */

/** The name of a class's level-1 Proficiency Grants: the starting tools it lists in the Catalog. */
export const STARTING_PROFICIENCIES = "Starting Proficiencies";

/** The categories a Proficiency Choice can be picked in. Armor is not one of them. */
export type PickableCategory = "skills" | "tools" | "languages" | "savingThrows" | "weapons";

/** A Proficiency Choice grant, as the Catalog carries it. */
export type ChoiceProficiencyGrant = Extract<ProficiencyGrant, { kind: "choice" }>;

export function isPickableCategory(category: string): category is PickableCategory {
  return category === "skills" || category === "tools" || category === "languages" || category === "savingThrows" || category === "weapons";
}

/**
 * The grants of a race, subrace or background that the Proficiency Sheet reads as tools and languages.
 * Their skills, weapons and armor are still read by their own tables.
 */
export function sourceToolAndLanguageGrants(grants: readonly ProficiencyGrant[] | undefined): ProficiencyGrant[] {
  return (grants ?? []).filter((grant) => grant.category === "tools" || grant.category === "languages");
}

/** A known language's own spelling, or the name as written with each word capitalized. */
export function normalizeLanguageName(raw: string): string {
  const clean = raw.trim();
  const known = ALL_LANGUAGE_NAMES.find((name) => name.toLowerCase() === clean.toLowerCase());
  if (known) return known;
  return clean
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const ABILITY_LABELS = Object.values(ABILITY_NAMES);

/** An ability's full name in its own spelling, or the name as written when it is not an ability. */
export function normalizeSavingThrowName(raw: string): string {
  const clean = raw.trim();
  return ABILITY_LABELS.find((name) => name.toLowerCase() === clean.toLowerCase()) ?? clean;
}

function normalizeProficiencyName(category: PickableCategory, raw: string): string {
  if (category === "skills") return normalizeSkillName(raw);
  if (category === "savingThrows") return normalizeSavingThrowName(raw);
  if (category === "tools") return normalizeToolName(raw);
  if (category === "languages") return normalizeLanguageName(raw);
  return normalizeWeaponProficiency(raw);
}

const lowerCased = (names: Set<string>) => new Set([...names].map((name) => name.toLowerCase()));
const SIMPLE_WEAPONS = lowerCased(STANDARD_SIMPLE_WEAPONS);
const MARTIAL_WEAPONS = lowerCased(STANDARD_MARTIAL_WEAPONS);

/**
 * The app's standard simple or martial category for a weapon name, by its exact name. Used only to tell
 * whether a held category ("Simple weapons") covers a weapon; the Kensei pool reads the category from the
 * Compendium instead.
 */
function standardWeaponCategory(name: string): "simple" | "martial" | undefined {
  const key = name.trim().toLowerCase();
  if (SIMPLE_WEAPONS.has(key)) return "simple";
  if (MARTIAL_WEAPONS.has(key)) return "martial";
  return undefined;
}

/** The attack types an item type allows. A weapon the Compendium types as either kind counts as both. */
function attackTypesOf(type: string): ("melee" | "ranged")[] {
  const clean = type.trim().toLowerCase();
  if (clean.startsWith("melee or ranged")) return ["melee", "ranged"];
  if (clean.startsWith("melee")) return ["melee"];
  if (clean.startsWith("ranged")) return ["ranged"];
  return [];
}

/**
 * The weapon names a weapons pool offers, read from the Compendium's items: each base weapon whose own
 * weapon category the pool allows and that lacks every excluded property, plus each named weapon, then
 * filtered by attack type. A magic item carries no category, so it is never taken for its base weapon.
 * The names are the items' own spellings, sorted and without duplicates.
 */
function weaponPoolNames(pool: Extract<ProficiencyPool, { kind: "weapons" }>, items: readonly ItemData[]): string[] {
  const excluded = new Set(pool.withoutProperties.map((name) => name.toLowerCase()));
  const named = new Set(pool.plus.map((name) => name.toLowerCase()));
  const names = new Set<string>();
  for (const item of items) {
    if (item.itemCategory !== "Weapon") continue;
    if (!named.has(item.name.trim().toLowerCase())) {
      if (!item.weaponCategory || !pool.base.includes(item.weaponCategory)) continue;
      if (item.properties.some((property) => excluded.has(property.toLowerCase()))) continue;
    }
    if (pool.attackType && !attackTypesOf(item.type).includes(pool.attackType)) continue;
    names.add(item.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** The names a pickable grant offers, normalized. Empty when the pool does not apply to the grant's category. */
export function poolNames(grant: ChoiceProficiencyGrant, items: readonly ItemData[] = []): string[] {
  if (!isPickableCategory(grant.category)) return [];
  if (grant.pool.kind === "names") {
    return grant.pool.names.map((name) => normalizeProficiencyName(grant.category as PickableCategory, name));
  }
  if (grant.pool.kind === "any") {
    if (grant.category === "skills") return DND_SKILLS.map((skill) => skill.name);
    if (grant.category === "savingThrows") return [...ABILITY_LABELS];
    if (grant.category === "tools") return [...ALL_TOOLS];
    if (grant.category === "languages") return [...ALL_LANGUAGE_NAMES];
    return [];
  }
  return grant.category === "weapons" ? weaponPoolNames(grant.pool, items) : [];
}

/**
 * Whether a weapon is already held by the sheet's weapon entries: by its own name (a plural entry such as
 * "Shortswords" matches "Shortsword"), or by its simple or martial category ("Simple weapons").
 */
export function weaponHeld(name: string, heldEntries: readonly string[]): boolean {
  const singular = (text: string) => text.trim().toLowerCase().replace(/s$/, "");
  const own = singular(name);
  const category = standardWeaponCategory(name);
  return heldEntries.some((entry) => {
    const held = entry.trim().toLowerCase();
    if (category && held === `${category} weapons`) return true;
    return singular(held) === own;
  });
}

/**
 * A feat's saving-throw choice is the ability the feat raised: the feat's selection carries
 * that ability, so the grant becomes the fixed save and there is no pick to make. Without a raised
 * ability, or when the raised ability is not in the pool, the grant stays a Proficiency Choice.
 */
export function raisedAbilityGrants(grants: ProficiencyGrant[], raised: AbilityKey | undefined): ProficiencyGrant[] {
  if (!raised) return grants;
  const name = ABILITY_NAMES[raised];
  return grants.map((grant) => {
    if (grant.kind !== "choice" || grant.category !== "savingThrows") return grant;
    if (grant.pool.kind !== "names" || !grant.pool.names.some((poolName) => normalizeSavingThrowName(poolName) === name)) {
      return grant;
    }
    return { id: grant.id, kind: "fixed", category: "savingThrows", names: [name] };
  });
}

/**
 * The saved picks a grant still accepts: each one that the pool offers (matched case-insensitively and
 * returned in the pool's spelling), without duplicates, and no more than the grant's count. Anything
 * else is ignored here and stays stored.
 */
export function validPicks(grant: ChoiceProficiencyGrant, saved: readonly string[], items: readonly ItemData[] = []): string[] {
  const offered = poolNames(grant, items);
  const accepted: string[] = [];
  for (const raw of saved) {
    const match = offered.find((name) => name.toLowerCase() === raw.trim().toLowerCase());
    if (match && !accepted.includes(match)) accepted.push(match);
  }
  return accepted.slice(0, grant.count);
}

/**
 * Records a pick toggled on a Proficiency Choice. A pick already made is deselected. At a count of
 * one a new pick replaces the old one; otherwise the oldest pick makes way once the count is full.
 * Only `proficiencyPicks` changes: the race, background and class buckets are never written.
 */
export function recordProficiencyPick(character: Character, choice: { id: string; choose: number }, option: string): Character {
  const current = character.proficiencyPicks?.[choice.id] ?? [];
  const same = (name: string) => name.toLowerCase() === option.toLowerCase();
  const next = current.some(same)
    ? current.filter((name) => !same(name))
    : choice.choose === 1
      ? [option]
      : current.length >= choice.choose
        ? [...current.slice(1), option]
        : [...current, option];
  return withPicks(character, choice.id, next);
}

/** Clears the pick for one Proficiency Choice. The store holds no empty entries. */
export function clearProficiencyPick(character: Character, choiceId: string): Character {
  return withPicks(character, choiceId, []);
}

function withPicks(character: Character, id: string, picks: string[]): Character {
  const proficiencyPicks: Record<string, string[]> = { ...(character.proficiencyPicks ?? {}) };
  delete proficiencyPicks[id];
  if (picks.length > 0) proficiencyPicks[id] = picks;
  return {
    ...character,
    proficiencyPicks: Object.keys(proficiencyPicks).length > 0 ? proficiencyPicks : undefined,
  };
}
