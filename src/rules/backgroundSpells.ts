import type { BackgroundData } from "../types/dnd5e.ts";
import type { Character, KnownSpell, LegacyKnownSpell } from "../types/character.ts";
import type { Compendium } from "../services/compendium.ts";
import { isSpellAvailableForClass } from "./spellcasting.ts";
import { normalizeKey, resolveSpellName } from "./subclassSpells.ts";

/**
 * The spell names a background's expanded lists add to the list of each spellcasting class the character has (ADR 0017).
 * The lists are keyed by spell level (the cantrip list is `s0`); a background's lists carry no level gate, so every name
 * counts. A background without lists gives none.
 */
export function backgroundExpandedSpellNames(background: BackgroundData | undefined): string[] {
  const names: string[] = [];
  for (const grant of background?.additionalSpells ?? []) {
    for (const list of Object.values(grant.expanded ?? {})) {
      if (!Array.isArray(list)) continue;
      for (const name of list) {
        if (typeof name === "string") names.push(name);
      }
    }
  }
  return names;
}

/**
 * The known spells that only the background's expanded lists make available: each is on the background's list and on no list
 * the character's classes give without it (their own lists and subclass expansions). A spell a class gives stays known, and so
 * does a name the Catalog does not hold. Clearing the background releases these, as a subclass change releases its own
 * expanded spells (see getOrphanedSubclassSpells).
 */
export function backgroundOnlyKnownSpells(
  character: Character,
  background: BackgroundData | undefined,
  compendium: Compendium,
  activeBooks?: string[]
): (KnownSpell | LegacyKnownSpell)[] {
  const listed = new Set(backgroundExpandedSpellNames(background).map(normalizeKey));
  if (listed.size === 0) return [];
  return (character.knownSpells ?? []).filter((known) => {
    if (!listed.has(normalizeKey(known.name))) return false;
    const spell = resolveSpellName(known.name, activeBooks, compendium);
    if (!spell) return false;
    // The background is held no longer, so only the classes' own lists are asked. Books are not gated here: a spell on a
    // class's list in a book that is off is still that class's spell.
    return !(character.classes ?? []).some((cls) =>
      isSpellAvailableForClass(spell, cls.className, undefined, {
        subclassName: cls.subclassName || cls.subclass,
        classLevel: cls.level,
        ruleChoices: character.ruleChoices,
      })
    );
  });
}
