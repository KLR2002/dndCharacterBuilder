import type { Character } from "../types/character.ts";
export { MULTICLASS_PREREQUISITES } from "../constants/rules.ts";

export function totalLevel(character: Character): number {
  return (character.classes || []).reduce((sum, c) => sum + c.level, 0) || 1;
}
export function proficiencyBonus(level: number): number { return Math.floor((level - 1) / 4) + 2; }
export function normalizeArmorProficiency(name: string): string {
  const clean = name.trim().toLowerCase();
  if (clean === "light" || clean === "light armor") return "Light armor";
  if (clean === "medium" || clean === "medium armor") return "Medium armor";
  if (clean === "heavy" || clean === "heavy armor") return "Heavy armor";
  if (clean === "shield" || clean === "shields") return "Shields";
  return name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
}

const WEAPON_NORMALIZATION_MAP: Record<string, string> = {
  simple: "Simple weapons",
  "simple weapons": "Simple weapons",
  "simple weapon": "Simple weapons",
  martial: "Martial weapons",
  "martial weapons": "Martial weapons",
  "martial weapon": "Martial weapons",
  "hand crossbow": "Hand crossbows",
  "hand crossbows": "Hand crossbows",
  longsword: "Longswords",
  longswords: "Longswords",
  shortsword: "Shortswords",
  shortswords: "Shortswords",
  rapier: "Rapiers",
  rapiers: "Rapiers",
  shortbow: "Shortbows",
  shortbows: "Shortbows",
  longbow: "Longbows",
  longbows: "Longbows",
  battleaxe: "Battleaxes",
  battleaxes: "Battleaxes",
  handaxe: "Handaxes",
  handaxes: "Handaxes",
  "light hammer": "Light hammers",
  "light hammers": "Light hammers",
  warhammer: "Warhammers",
  warhammers: "Warhammers",
  greatsword: "Greatswords",
  greatswords: "Greatswords",
  spear: "Spears",
  spears: "Spears",
  javelin: "Javelins",
  javelins: "Javelins",
  trident: "Tridents",
  tridents: "Tridents",
  scimitar: "Scimitars",
  scimitars: "Scimitars",
  net: "Nets",
  nets: "Nets",
  blowgun: "Blowguns",
  blowguns: "Blowguns",
};

export function normalizeWeaponProficiency(name: string): string {
  const clean = name.trim().toLowerCase();
  return WEAPON_NORMALIZATION_MAP[clean] || (name.trim().charAt(0).toUpperCase() + name.trim().slice(1));
}

export const STANDARD_SIMPLE_WEAPONS = new Set<string>([
  "Club", "Clubs",
  "Dagger", "Daggers",
  "Greatclub", "Greatclubs",
  "Handaxe", "Handaxes",
  "Javelin", "Javelins",
  "Light hammer", "Light hammers",
  "Mace", "Maces",
  "Quarterstaff", "Quarterstaffs",
  "Sickle", "Sickles",
  "Spear", "Spears",
  "Unarmed strike", "Unarmed strikes",
  "Light crossbow", "Light crossbows",
  "Crossbow, light",
  "Dart", "Darts",
  "Shortbow", "Shortbows",
  "Sling", "Slings",
]);

export const STANDARD_MARTIAL_WEAPONS = new Set<string>([
  "Battleaxe", "Battleaxes",
  "Flail", "Flails",
  "Glaive", "Glaives",
  "Greataxe", "Greataxes",
  "Greatsword", "Greatswords",
  "Halberd", "Halberds",
  "Lance", "Lances",
  "Longsword", "Longswords",
  "Maul", "Mauls",
  "Morningstar", "Morningstars",
  "Pike", "Pikes",
  "Rapier", "Rapiers",
  "Scimitar", "Scimitars",
  "Shortsword", "Shortswords",
  "Trident", "Tridents",
  "War pick", "War picks",
  "Warhammer", "Warhammers",
  "Whip", "Whips",
  "Blowgun", "Blowguns",
  "Hand crossbow", "Hand crossbows",
  "Crossbow, hand",
  "Heavy crossbow", "Heavy crossbows",
  "Crossbow, heavy",
  "Longbow", "Longbows",
  "Net", "Nets",
]);

export function deduplicateWeaponProficiencies(weapons: string[]): string[] {
  const normWeapons = Array.from(new Set(weapons.map(normalizeWeaponProficiency)));
  const hasMartial = normWeapons.includes("Martial weapons");
  const hasSimple = normWeapons.includes("Simple weapons");

  return normWeapons.filter((w) => {
    if (w === "Martial weapons" || w === "Simple weapons") return true;
    if (hasMartial && STANDARD_MARTIAL_WEAPONS.has(w)) return false;
    if (hasSimple && STANDARD_SIMPLE_WEAPONS.has(w)) return false;
    return true;
  });
}

