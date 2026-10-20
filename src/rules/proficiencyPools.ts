import type { Character } from "../types/character.ts";
import type { ProficiencyGrant } from "../types/dnd5e.ts";
import { ALL_LANGUAGE_NAMES, ALL_TOOLS, normalizeToolName } from "./proficienciesAndLanguages.ts";

/**
 * Proficiency Choices for tools and languages (ticket 05). A leaf module: the Proficiency Sheet, the
 * choice offers, the rule-choice pick and the reconciler all read it, so it imports nothing that
 * imports them back.
 */

/** The categories a Proficiency Choice can be picked in so far. Skills, weapons and armor wait for their slices. */
export type PickableCategory = "tools" | "languages";

/** A Proficiency Choice grant, as the Catalog carries it. */
export type ChoiceProficiencyGrant = Extract<ProficiencyGrant, { kind: "choice" }>;

export function isPickableCategory(category: string): category is PickableCategory {
  return category === "tools" || category === "languages";
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
  return category === "tools" ? normalizeToolName(raw) : normalizeLanguageName(raw);
}

/** The names a pickable grant offers, normalized. Empty for a pool this slice does not read. */
export function poolNames(grant: ChoiceProficiencyGrant): string[] {
  if (!isPickableCategory(grant.category)) return [];
  if (grant.pool.kind === "names") {
    return grant.pool.names.map((name) => normalizeProficiencyName(grant.category as PickableCategory, name));
  }
  if (grant.pool.kind === "any") return grant.category === "tools" ? [...ALL_TOOLS] : [...ALL_LANGUAGE_NAMES];
  return [];
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
