import type { ActiveBooks } from "../constants/books.ts";
import type { Character } from "../types/character.ts";
import type { Compendium } from "../services/compendium.ts";
import { moveLegacyFightingStyleIds } from "./choices/fightingStyles.ts";
import { moveLegacyInnateCounters } from "./grantedSpells.ts";
import { dropLegacyBackgroundSkills } from "./legacyBackgroundSkills.ts";
import {
  dropLegacyMulticlassSkillEntries,
  moveAliasedProficiencyPicks,
  moveLegacyClassSkillPicks,
  moveLegacyClassToolPicks,
  moveLegacySkillPicks,
  moveLegacySourcePicks,
} from "./proficiencyPicks.ts";
import { renameSrdNames } from "./srdNames.ts";

/**
 * Moves the saved shapes that no current transition writes, and renames the SRD names a Catalog now prints under
 * another name. It runs when characters load and when the active books or the Catalog change (ADR 0026), never
 * on an edit. The passes run in their fixed order, then the rename. Returns the input itself when nothing changes.
 */
export function migrateSavedPicks(character: Character, compendium: Compendium, activeBooks: ActiveBooks): Character {
  const classes = compendium.for().classes();
  let updated = moveLegacyFightingStyleIds(character, classes);
  updated = moveAliasedProficiencyPicks(updated, compendium, activeBooks);
  updated = moveLegacyClassToolPicks(updated, compendium);
  updated = moveLegacyClassSkillPicks(updated, compendium);
  updated = moveLegacySourcePicks(updated, compendium, activeBooks);
  updated = moveLegacySkillPicks(updated, compendium, activeBooks);
  updated = dropLegacyMulticlassSkillEntries(updated);
  updated = dropLegacyBackgroundSkills(updated, compendium, activeBooks);
  updated = moveLegacyInnateCounters(updated, compendium, activeBooks);
  updated = renameSrdNames(updated, compendium);
  return JSON.stringify(updated) === JSON.stringify(character) ? character : updated;
}
