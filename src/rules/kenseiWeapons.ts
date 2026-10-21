import type { Character } from "../types/character.ts";
import { catalogListings, findClassData, type CharacterCatalogs } from "./catalogs.ts";
import { validPicks } from "./proficiencyPools.ts";

/** The Monk subclass whose weapon picks are kensei weapons. */
const KENSEI_SUBCLASS = "Way of the Kensei";

/**
 * The kensei weapons a character has chosen: the saved weapon picks on the Way of the Kensei features the
 * character holds at its level. Each one is a Monk Weapon whatever its properties. Read from the Catalog's
 * grants, so without the Catalog there are none (the picks themselves are kept).
 */
export function kenseiWeaponNames(character: Character, catalogs: CharacterCatalogs = {}): string[] {
  const monk = character.classes.find((c) => c.className === "Monk" && c.subclassName === KENSEI_SUBCLASS);
  if (!monk) return [];
  const listings = catalogListings(catalogs);
  const subclass = findClassData(listings.classes(), monk)?.subclasses.find((s) => s.name === KENSEI_SUBCLASS);
  const items = listings.items();
  return (subclass?.features ?? [])
    .filter((feature) => feature.level <= monk.level)
    .flatMap((feature) =>
      (feature.grants ?? []).flatMap((grant) =>
        grant.kind === "choice" && grant.category === "weapons"
          ? validPicks(grant, character.proficiencyPicks?.[grant.id] ?? [], items)
          : [],
      ),
    );
}
