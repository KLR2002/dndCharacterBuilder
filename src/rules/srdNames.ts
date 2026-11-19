import type { Compendium } from "../services/compendium.ts";
import type { Character } from "../types/character.ts";
import { SRD_SOURCE } from "../constants/books.ts";

/**
 * Renames the spells and items a character saved under an old name from the SRD. The integrated catalog's record
 * for the old name gives the SRD name (its `srdName`), so no name list lives in the app. Only a saved name with
 * source SRD is renamed; a name with no source, or another source, is kept. With the SRD Baseline nothing is
 * renamed, since its records already carry the SRD names. Returns the character itself when nothing changes.
 */
export function renameSrdNames(character: Character, compendium: Compendium): Character {
  if (!compendium.integrated) return character;

  const spellName = (name: string, source: string): string =>
    source === SRD_SOURCE ? compendium.findSpell(name)?.srdName ?? name : name;
  const itemName = (name: string, source: string): string =>
    source === SRD_SOURCE ? compendium.findItem(name)?.srdName ?? name : name;

  const knownSpells = character.knownSpells?.map((spell) => withName(spell, spellName(spell.name, spell.source)));
  const preparedSpells = character.preparedSpells?.map((key) => renamedPreparedKey(key, spellName));
  const ritualBook = character.ritualBook?.map((entry) => withName(entry, spellName(entry.name, entry.source)));
  const items = character.items.map((entry) => withName(entry, itemName(entry.name, entry.source)));

  const unchanged = [
    sameElements(knownSpells, character.knownSpells),
    sameElements(preparedSpells, character.preparedSpells),
    sameElements(ritualBook, character.ritualBook),
    sameElements(items, character.items),
  ].every(Boolean);
  if (unchanged) return character;

  return {
    ...character,
    ...(knownSpells ? { knownSpells } : {}),
    ...(preparedSpells ? { preparedSpells } : {}),
    ...(ritualBook ? { ritualBook } : {}),
    items,
  };
}

/** The record with its name replaced. The record itself comes back when the name is the same. */
function withName<T extends { name: string }>(record: T, name: string): T {
  return name === record.name ? record : { ...record, name };
}

/** A prepared key reads `name__source__owner`; only the name of an SRD-sourced key changes. */
function renamedPreparedKey(key: string, spellName: (name: string, source: string) => string): string {
  const [name, source, ...rest] = key.split("__");
  if (source === undefined) return key;
  const next = spellName(name, source);
  return next === name ? key : [next, source, ...rest].join("__");
}

function sameElements<T>(next: T[] | undefined, previous: T[] | undefined): boolean {
  if (next === undefined || previous === undefined) return next === previous;
  return next.length === previous.length && next.every((value, i) => value === previous[i]);
}
