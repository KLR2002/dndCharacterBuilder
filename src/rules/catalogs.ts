import type { ClassData } from "../types/dnd5e.ts";
import { currentCompendium, type Compendium, type CompendiumListings } from "../services/compendium.ts";

/** The one catalog bundle the rules take: names resolve against a Compendium, scoped to the active books. */
export interface CharacterCatalogs {
  /** Defaults to the process-wide current Compendium. */
  compendium?: Compendium;
  /** Scopes listings to these books. Omitted means unscoped. */
  activeBooks?: string[];
}

/** The listings a rules function reads from the bundle's Compendium, scoped to its active books. */
export function catalogListings(catalogs?: CharacterCatalogs): CompendiumListings {
  return (catalogs?.compendium ?? currentCompendium()).for(catalogs?.activeBooks);
}

/**
 * Every class in the bundle's Compendium, unscoped. A held class resolves by its name and source whatever
 * the active books, so a character keeps the class it holds when a book is turned off.
 */
export function allCatalogClasses(catalogs?: CharacterCatalogs): readonly ClassData[] {
  return (catalogs?.compendium ?? currentCompendium()).for().classes();
}

/**
 * The catalog class a character's class entry refers to. Two classes can share a name from different
 * sources, so the exact name and source match wins (the source compared case-insensitively). An entry
 * whose source is empty or matches no class falls back to the first class with that name, as a saved
 * character always has resolved before the source was recorded.
 */
export function findClassData<T extends { name: string; source: string }>(
  classes: readonly T[],
  entry: { className: string; source?: string },
): T | undefined {
  const source = entry.source?.toLowerCase();
  if (source) {
    const exact = classes.find((c) => c.name === entry.className && c.source.toLowerCase() === source);
    if (exact) return exact;
  }
  return classes.find((c) => c.name === entry.className);
}
