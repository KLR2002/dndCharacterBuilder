import type { ActiveBooks } from "../constants/books.ts";
import type { Compendium } from "../services/compendium.ts";
import type { Character } from "../types/character.ts";
import type { RaceData } from "../types/dnd5e.ts";
import { catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { findHeldRace } from "./raceLookup.ts";

/** The size a character takes when its race or lineage lists none. */
const DEFAULT_SIZE = "Medium";

/** The record whose sizes a character takes: the lineage it holds when the catalog lists it, else its race. */
function sizeRecordOf(character: Character, races: readonly RaceData[], activeBooks: ActiveBooks): RaceData | undefined {
  const lineage = character.lineageReplacement
    ? findHeldRace(races, { name: character.lineageReplacement }, activeBooks).race
    : undefined;
  return lineage ?? findHeldRace(races, character.race, activeBooks).race;
}

/**
 * The size a character takes: its Size Choice when the record lists it, else the record's first size, else the default.
 * Every reader of a character's size goes through here.
 */
export function resolvedSize(character: Character, catalogs?: CharacterCatalogs): string {
  const record = sizeRecordOf(character, catalogListings(catalogs).races(), catalogs?.activeBooks);
  if (character.sizeChoice && record?.size.includes(character.sizeChoice)) return character.sizeChoice;
  return record?.size[0] ?? DEFAULT_SIZE;
}

/** The sizes the player may pick: those the held race or lineage lists, when it lists two or more. A single size offers none. */
export function sizeOptionsOf(character: Character, catalogs?: CharacterCatalogs): string[] {
  const record = sizeRecordOf(character, catalogListings(catalogs).races(), catalogs?.activeBooks);
  return record && record.size.length > 1 ? [...record.size] : [];
}

/**
 * Releases the Size Choice when no race is held or the held race or lineage does not list it. A record the compendium does not
 * hold keeps the pick, so a pick saved on one catalog survives a switch to another. The saved race is never written.
 */
export function releaseSizeChoice(character: Character, compendium: Compendium, activeBooks: ActiveBooks): Character {
  if (character.sizeChoice === undefined) return character;
  if (character.race) {
    const record = sizeRecordOf(character, compendium.for(activeBooks).races(), activeBooks);
    if (!record || record.size.includes(character.sizeChoice)) return character;
  }
  return { ...character, sizeChoice: undefined };
}
