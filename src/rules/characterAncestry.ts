import type { ActiveBooks } from "../constants/books.ts";
import type { Character } from "../types/character.ts";
import type { RaceData } from "../types/dnd5e.ts";
import type { ResolvedAncestry } from "./types.ts";
import { findHeldRace } from "./raceLookup.ts";

/**
 * The race and subrace a character resolves to, read from the catalog. A lineage replacement stands
 * in for the race. Shared by the evaluator and the Proficiency Sheet, so both read the same traits.
 */
export function resolveCharacterAncestry(
  character: Character,
  raceCatalog: RaceData[] | undefined,
  activeBooks: ActiveBooks,
): ResolvedAncestry {
  if (character.lineageReplacement && raceCatalog) {
    const lineage = findHeldRace(raceCatalog, { name: character.lineageReplacement }, activeBooks).race;
    if (lineage) return { race: lineage, subrace: undefined };
  }
  if (!character.race || !raceCatalog) return {};
  return findHeldRace(raceCatalog, character.race, activeBooks);
}
