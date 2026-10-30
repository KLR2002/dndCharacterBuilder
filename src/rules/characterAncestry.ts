import type { ActiveBooks } from "../constants/books.ts";
import type { Character } from "../types/character.ts";
import type { RaceData } from "../types/dnd5e.ts";
import { findHeldRace, type ResolvedRace } from "./raceLookup.ts";

/**
 * The race and subrace a character resolves to, read from the catalog. A lineage replacement stands
 * in for the race. Shared by the evaluator and the Proficiency Sheet, so both read the same traits.
 */
export function resolveCharacterAncestry(
  character: Character,
  raceCatalog: readonly RaceData[] | undefined,
  activeBooks: ActiveBooks,
): ResolvedRace {
  if (character.lineageReplacement && raceCatalog) {
    const lineage = findHeldRace(raceCatalog, { name: character.lineageReplacement }, activeBooks).race;
    if (lineage) return { race: lineage, subrace: undefined };
  }
  if (!character.race || !raceCatalog) return {};
  return findHeldRace(raceCatalog, character.race, activeBooks);
}
