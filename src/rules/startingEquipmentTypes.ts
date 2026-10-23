/**
 * The generic equipment types a class's starting equipment may name in place of an item, as the 2014 print data spells
 * them (`{ "equipmentType": "weaponMartial" }` is any martial weapon). An entry of any other type is not one the app
 * can resolve.
 */
export const STARTING_EQUIPMENT_TYPES: ReadonlySet<string> = new Set([
  "weaponSimple",
  "weaponMartial",
  "weaponSimpleMelee",
  "weaponMartialMelee",
  "instrumentMusical",
  "focusSpellcastingArcane",
  "focusSpellcastingHoly",
  "focusSpellcastingDruidic",
]);
