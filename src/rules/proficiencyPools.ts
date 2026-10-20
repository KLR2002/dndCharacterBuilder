import type { AbilityKey, Character } from "../types/character.ts";
import type { ProficiencyGrant } from "../types/dnd5e.ts";
import { ABILITY_NAMES } from "./abilities.ts";
import { ALL_LANGUAGE_NAMES, ALL_TOOLS, normalizeToolName } from "./proficienciesAndLanguages.ts";
import { normalizeSkillName } from "./skills.ts";
import { DND_SKILLS } from "../constants/rules.ts";

/**
 * Proficiency Choices (tickets 05 and 07). A leaf module: the Proficiency Sheet, the choice offers, the
 * rule-choice pick and the reconciler all read it, so it imports nothing that imports them back.
 */

/** The categories a Proficiency Choice can be picked in so far. Weapons and armor wait for their slice. */
export type PickableCategory = "skills" | "tools" | "languages" | "savingThrows";

/** A Proficiency Choice grant, as the Catalog carries it. */
export type ChoiceProficiencyGrant = Extract<ProficiencyGrant, { kind: "choice" }>;

export function isPickableCategory(category: string): category is PickableCategory {
  return category === "skills" || category === "tools" || category === "languages" || category === "savingThrows";
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

export function normalizeProficiencyName(category: PickableCategory, raw: string): string {
  if (category === "skills") return normalizeSkillName(raw);
  if (category === "savingThrows") return normalizeSavingThrowName(raw);
  return category === "tools" ? normalizeToolName(raw) : normalizeLanguageName(raw);
}

/** The names a pickable grant offers, normalized. Empty for a pool this slice does not read. */
export function poolNames(grant: ChoiceProficiencyGrant): string[] {
  if (!isPickableCategory(grant.category)) return [];
  if (grant.pool.kind === "names") {
    return grant.pool.names.map((name) => normalizeProficiencyName(grant.category as PickableCategory, name));
  }
  if (grant.pool.kind === "any") {
    if (grant.category === "skills") return DND_SKILLS.map((skill) => skill.name);
    if (grant.category === "savingThrows") return [...ABILITY_LABELS];
    return grant.category === "tools" ? [...ALL_TOOLS] : [...ALL_LANGUAGE_NAMES];
  }
  return [];
}

/**
 * A feat's saving-throw choice is the ability the feat raised (ticket 07): the feat's selection carries
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
export function validPicks(grant: ChoiceProficiencyGrant, saved: readonly string[]): string[] {
  const offered = poolNames(grant);
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
