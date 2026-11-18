import type { ActiveBooks } from "../constants/books.ts";
import { DEFAULT_ACTIVE_BOOK_CODES } from "../constants/books.ts";
import type { Character } from "../types/character.ts";
import type { SpellData } from "../types/dnd5e.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { isKnown } from "./characterSpells.ts";
import { THIRD_CASTERS } from "./classData.ts";
import { isSpellAvailableForClass, profileSpellContext, type ClassSpellProfile } from "./spellcasting.ts";
import { getThirdCasterRestrictedSchools } from "./subclassSpells.ts";

export interface LearnableSpells {
  /** The spells the Spell Owner may learn, sorted by level and name. Restricted schools are not filtered out. */
  spells: SpellData[];
  /** The schools the owner's learnable spells are restricted to, outside cantrips. Empty when unrestricted. */
  restrictedSchools: string[];
}

/**
 * The spells one class Spell Owner may learn: its class list (Fighter and Rogue third casters read the
 * Wizard list), its subclass and expanded lists, up to its maximum spell level, minus the spells this
 * owner already knows. The owner's restricted schools are returned as data for the list to show.
 */
export function learnableSpells(
  character: Character,
  profile: ClassSpellProfile,
  opts: { compendium?: Compendium; activeBooks?: ActiveBooks } = {}
): LearnableSpells {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;
  const listClass = THIRD_CASTERS[profile.className] ? "Wizard" : profile.className;
  const context = { ...profileSpellContext(profile), classLevel: profile.level };
  const spells = compendium
    .for(activeBooks)
    .spells()
    .filter((spell) => spell.level <= profile.maxSpellLevel)
    .filter((spell) => isSpellAvailableForClass(spell, listClass, activeBooks, context))
    .filter((spell) => !isKnown(character, profile, spell))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  return {
    spells,
    restrictedSchools: getThirdCasterRestrictedSchools(profile.className, profile.subclass),
  };
}
