import type { Character } from "../types/character.ts";
import { catalogListings, findClassData, type CharacterCatalogs } from "./catalogs.ts";
import { validPicks } from "./proficiencyPools.ts";
import type { FeatureInstance } from "./types.ts";

/**
 * Whether a weapon pick on this feature marks a Monk Weapon. The rule is the shape of the grant: a weapon
 * choice on a Monk's subclass feature. Every such pick counts, so the picker offers its whole pool, including
 * weapons the sheet already holds: a held weapon still gains the Monk Weapon effect.
 */
export function weaponPickMarksMonkWeapon(feature: FeatureInstance): boolean {
  return (
    feature.origin === "Subclass" &&
    feature.className === "Monk" &&
    (feature.grants ?? []).some((grant) => grant.kind === "choice" && grant.category === "weapons")
  );
}

/**
 * The kensei weapons a character has chosen: the saved weapon picks on the weapon choices of the Monk's
 * subclass features the character holds at its level. Each one is a Monk Weapon whatever its properties. Read
 * from the Catalog's grants, so without the Catalog there are none (the picks themselves are kept).
 */
export function kenseiWeaponNames(character: Character, catalogs: CharacterCatalogs = {}): string[] {
  const monk = character.classes.find((c) => c.className === "Monk" && c.subclassName);
  if (!monk?.subclassName) return [];
  const listings = catalogListings(catalogs);
  const subclass = findClassData(listings.classes(), monk)?.subclasses.find((s) => s.name === monk.subclassName);
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
