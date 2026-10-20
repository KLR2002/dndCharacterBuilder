import type { Character } from "../types/character.ts";
import type { ItemData, ProficiencyGrant, ProficiencyPool } from "../types/dnd5e.ts";
import { ALL_LANGUAGE_NAMES, ALL_TOOLS, normalizeToolName } from "./proficienciesAndLanguages.ts";
import { normalizeWeaponProficiency, STANDARD_MARTIAL_WEAPONS, STANDARD_SIMPLE_WEAPONS } from "./proficiencies.ts";

/**
 * Proficiency Choices (tickets 05 and 10). A leaf module: the Proficiency Sheet, the choice offers, the
 * rule-choice pick, the Monk Weapon rule and the reconciler all read it, so it imports nothing that
 * imports them back.
 */

/** The categories a Proficiency Choice can be picked in so far. Skills and armor wait for their slices. */
export type PickableCategory = "tools" | "languages" | "weapons";

/** A Proficiency Choice grant, as the Catalog carries it. */
export type ChoiceProficiencyGrant = Extract<ProficiencyGrant, { kind: "choice" }>;

export function isPickableCategory(category: string): category is PickableCategory {
  return category === "tools" || category === "languages" || category === "weapons";
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

export function normalizeProficiencyName(category: PickableCategory, raw: string): string {
  if (category === "tools") return normalizeToolName(raw);
  if (category === "languages") return normalizeLanguageName(raw);
  return normalizeWeaponProficiency(raw);
}

const lowerCased = (names: Set<string>) => new Set([...names].map((name) => name.toLowerCase()));
const SIMPLE_WEAPONS = lowerCased(STANDARD_SIMPLE_WEAPONS);
const MARTIAL_WEAPONS = lowerCased(STANDARD_MARTIAL_WEAPONS);

/**
 * The simple or martial category of a base weapon, by its exact name. Undefined for any other name, so
 * magic variants such as "Longsword, +1" are never taken for their base weapon.
 */
export function standardWeaponCategory(name: string): "simple" | "martial" | undefined {
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
 * The weapon names a weapons pool offers, read from the Compendium's items: each base weapon of the
 * pool's categories that lacks every excluded property, plus each named weapon, then filtered by attack
 * type. The names are the items' own spellings, sorted and without duplicates.
 */
export function weaponPoolNames(pool: Extract<ProficiencyPool, { kind: "weapons" }>, items: readonly ItemData[]): string[] {
  const excluded = new Set(pool.withoutProperties.map((name) => name.toLowerCase()));
  const named = new Set(pool.plus.map((name) => name.toLowerCase()));
  const names = new Set<string>();
  for (const item of items) {
    if (item.itemCategory !== "Weapon") continue;
    if (!named.has(item.name.trim().toLowerCase())) {
      const category = standardWeaponCategory(item.name);
      if (!category || !pool.base.includes(category)) continue;
      if (item.properties.some((property) => excluded.has(property.toLowerCase()))) continue;
    }
    if (pool.attackType && !attackTypesOf(item.type).includes(pool.attackType)) continue;
    names.add(item.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** The names a pickable grant offers, normalized. Empty for a pool this slice does not read. */
export function poolNames(grant: ChoiceProficiencyGrant, items: readonly ItemData[] = []): string[] {
  if (!isPickableCategory(grant.category)) return [];
  if (grant.pool.kind === "names") {
    return grant.pool.names.map((name) => normalizeProficiencyName(grant.category as PickableCategory, name));
  }
  if (grant.pool.kind === "any") {
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
