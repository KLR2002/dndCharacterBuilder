import type { Character } from "../types/character.ts";
import type { RaceData, SubraceData } from "../types/dnd5e.ts";
import type { ResolvedAncestry } from "./types.ts";

/**
 * The race and subrace a character resolves to, read from the catalog. A lineage replacement stands
 * in for the race. Shared by the evaluator and the Proficiency Sheet, so both read the same traits.
 */
export function resolveCharacterAncestry(character: Character, raceCatalog?: RaceData[]): ResolvedAncestry {
  if (character.lineageReplacement && raceCatalog) {
    const lineage = raceCatalog.find((r) => r.name === character.lineageReplacement);
    if (lineage) return { race: lineage, subrace: undefined };
  }
  const choice = character.race;
  if (!choice || !raceCatalog) return {};

  const race = raceCatalog.find((r) => r.name === choice.name && (!choice.source || r.source === choice.source));
  const subrace = race?.subraces?.find(
    (s: SubraceData) =>
      s.name === choice.subraceName && (!choice.subraceSource || s.source === choice.subraceSource)
  );

  return { race, subrace };
}
