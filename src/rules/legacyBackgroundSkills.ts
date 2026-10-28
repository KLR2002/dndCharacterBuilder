import type { Character } from "../types/character.ts";
import type { Compendium } from "../services/compendium.ts";
import { isCustomBackground } from "./customBackground.ts";
import { normalizeSkillName } from "./skills.ts";
import { findHeldRecord } from "./raceLookup.ts";

/**
 * Background skills that an earlier version wrote into the chosen skills bucket. A catalog background's
 * skills are its Proficiency Grants now, so a bucket copy is only what keeps a skill after its background
 * stops granting it, most often because the background's book is turned off. This module drops those
 * copies. A skill a skill choice also picked stays, and so does a copy whose background is still active.
 * A leaf module: the reconciler is its only caller.
 */

/**
 * The fixed skills of a catalog background's grants, in lower case. The record is found as the shared lookup finds it, unscoped
 * by books so that a background whose book is off still gives its skills, with an active book's record preferred.
 */
function grantedSkillKeys(compendium: Compendium, held: { name: string; source: string }, activeBooks?: string[]): Set<string> {
  const record = findHeldRecord(compendium.for().backgrounds(), held, activeBooks);
  const keys = new Set<string>();
  for (const grant of record?.grants ?? []) {
    if (grant.kind !== "fixed" || grant.category !== "skills") continue;
    for (const skill of grant.names) keys.add(normalizeSkillName(skill).toLowerCase());
  }
  return keys;
}

/**
 * Removes the chosen skills that only a background that is no longer active granted. Returns the character
 * unchanged when nothing is removed, a custom background has no record, or the background is still active
 * (its grant holds the skill, so the copy is harmless and left alone).
 */
export function dropLegacyBackgroundSkills(
  character: Character,
  compendium: Compendium,
  activeBooks?: string[],
): Character {
  const bg = character.background;
  const bucket = character.chosenSkills ?? [];
  if (!bg || isCustomBackground(bg) || bucket.length === 0) return character;

  const wanted = bg.name.toLowerCase();
  const stillActive = compendium
    .for(activeBooks)
    .backgrounds()
    .some((record) => record.name.toLowerCase() === wanted);
  if (stillActive) return character;

  const backgroundSkills = grantedSkillKeys(compendium, bg, activeBooks);
  if (backgroundSkills.size === 0) return character;

  const pickedInChoices = new Set(
    (character.skillChoices ?? []).flatMap((choice) => choice.picked.map((skill) => normalizeSkillName(skill).toLowerCase())),
  );
  const kept = bucket.filter((skill) => {
    const key = normalizeSkillName(skill).toLowerCase();
    return !(backgroundSkills.has(key) && !pickedInChoices.has(key));
  });
  if (kept.length === bucket.length) return character;
  return { ...character, chosenSkills: kept };
}
