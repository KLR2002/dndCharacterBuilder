import type { ClassRules } from "./classData.ts";
import { currentCompendium, type Compendium, type CompendiumListings } from "../services/compendium.ts";

/** The one catalog bundle the rules take: names resolve against a Compendium, scoped to the active books. */
export interface CharacterCatalogs {
  /** Defaults to the process-wide current Compendium. */
  compendium?: Compendium;
  /** Scopes listings to these books. Omitted means unscoped. */
  activeBooks?: string[];
  classRules?: Record<string, ClassRules>;
}

/** The listings a rules function reads from the bundle's Compendium, scoped to its active books. */
export function catalogListings(catalogs?: CharacterCatalogs): CompendiumListings {
  return (catalogs?.compendium ?? currentCompendium()).for(catalogs?.activeBooks);
}
