import type { AbilityKey, Character, InventoryItem } from "../types/character.ts";
import type { ClassData } from "../types/dnd5e.ts";
import type { ResolvedAncestry } from "./types.ts";
import { effectiveScores } from "./abilities.ts";
import {
  proficiencyBonus,
  totalLevel,
  proficiencies,
  MULTICLASS_PROFICIENCIES,
} from "./proficiencies.ts";

export interface WeaponAttackOption {
  item: InventoryItem;
  name: string;
  statUsed: AbilityKey;
  attackBonus: number;
  toHit: number;
  damage: string;
  damageString: string;
  damageDice: string;
  damageType?: string | null;
  range?: string | null;
  isProficient: boolean;
  isRanged: boolean;
  isFinesse: boolean;
  isLight: boolean;
  isOffHand?: boolean;
}

export interface DualWieldResult {
  isDualWielding: boolean;
  mainHand?: WeaponAttackOption;
  offHand?: WeaponAttackOption;
}

export interface StandardWeaponData {
  category: "simple" | "martial";
  type: "melee" | "ranged";
  damage: string;
  damageType: string;
  range?: string;
  properties: string[];
}

export const STANDARD_WEAPONS: Record<string, StandardWeaponData> = {
  // Simple Melee Weapons
  club: { category: "simple", type: "melee", damage: "1d4", damageType: "bludgeoning", properties: ["Light"] },
  dagger: { category: "simple", type: "melee", damage: "1d4", damageType: "piercing", range: "20/60", properties: ["Finesse", "Light", "Thrown"] },
  greatclub: { category: "simple", type: "melee", damage: "1d8", damageType: "bludgeoning", properties: ["Two-Handed"] },
  handaxe: { category: "simple", type: "melee", damage: "1d6", damageType: "slashing", range: "20/60", properties: ["Light", "Thrown"] },
  javelin: { category: "simple", type: "melee", damage: "1d6", damageType: "piercing", range: "30/120", properties: ["Thrown"] },
  "light hammer": { category: "simple", type: "melee", damage: "1d4", damageType: "bludgeoning", range: "20/60", properties: ["Light", "Thrown"] },
  mace: { category: "simple", type: "melee", damage: "1d6", damageType: "bludgeoning", properties: [] },
  quarterstaff: { category: "simple", type: "melee", damage: "1d6", damageType: "bludgeoning", properties: ["Versatile"] },
  sickle: { category: "simple", type: "melee", damage: "1d4", damageType: "slashing", properties: ["Light"] },
  spear: { category: "simple", type: "melee", damage: "1d6", damageType: "piercing", range: "20/60", properties: ["Thrown", "Versatile"] },
  "unarmed strike": { category: "simple", type: "melee", damage: "1", damageType: "bludgeoning", properties: [] },

  // Simple Ranged Weapons
  "light crossbow": { category: "simple", type: "ranged", damage: "1d8", damageType: "piercing", range: "80/320", properties: ["Ammunition", "Loading", "Two-Handed"] },
  "crossbow, light": { category: "simple", type: "ranged", damage: "1d8", damageType: "piercing", range: "80/320", properties: ["Ammunition", "Loading", "Two-Handed"] },
  dart: { category: "simple", type: "ranged", damage: "1d4", damageType: "piercing", range: "20/60", properties: ["Finesse", "Thrown"] },
  shortbow: { category: "simple", type: "ranged", damage: "1d6", damageType: "piercing", range: "80/320", properties: ["Ammunition", "Two-Handed"] },
  sling: { category: "simple", type: "ranged", damage: "1d4", damageType: "bludgeoning", range: "30/120", properties: ["Ammunition"] },

  // Martial Melee Weapons
  battleaxe: { category: "martial", type: "melee", damage: "1d8", damageType: "slashing", properties: ["Versatile"] },
  flail: { category: "martial", type: "melee", damage: "1d8", damageType: "bludgeoning", properties: [] },
  glaive: { category: "martial", type: "melee", damage: "1d10", damageType: "slashing", properties: ["Heavy", "Reach", "Two-Handed"] },
  greataxe: { category: "martial", type: "melee", damage: "1d12", damageType: "slashing", properties: ["Heavy", "Two-Handed"] },
  greatsword: { category: "martial", type: "melee", damage: "2d6", damageType: "slashing", properties: ["Heavy", "Two-Handed"] },
  halberd: { category: "martial", type: "melee", damage: "1d10", damageType: "slashing", properties: ["Heavy", "Reach", "Two-Handed"] },
  lance: { category: "martial", type: "melee", damage: "1d12", damageType: "piercing", properties: ["Reach", "Special"] },
  longsword: { category: "martial", type: "melee", damage: "1d8", damageType: "slashing", properties: ["Versatile"] },
  maul: { category: "martial", type: "melee", damage: "2d6", damageType: "bludgeoning", properties: ["Heavy", "Two-Handed"] },
  morningstar: { category: "martial", type: "melee", damage: "1d8", damageType: "piercing", properties: [] },
  pike: { category: "martial", type: "melee", damage: "1d10", damageType: "piercing", properties: ["Heavy", "Reach", "Two-Handed"] },
  rapier: { category: "martial", type: "melee", damage: "1d8", damageType: "piercing", properties: ["Finesse"] },
  scimitar: { category: "martial", type: "melee", damage: "1d6", damageType: "slashing", properties: ["Finesse", "Light"] },
  shortsword: { category: "martial", type: "melee", damage: "1d6", damageType: "piercing", properties: ["Finesse", "Light"] },
  trident: { category: "martial", type: "melee", damage: "1d6", damageType: "piercing", range: "20/60", properties: ["Thrown", "Versatile"] },
  "war pick": { category: "martial", type: "melee", damage: "1d8", damageType: "piercing", properties: [] },
  warhammer: { category: "martial", type: "melee", damage: "1d8", damageType: "bludgeoning", properties: ["Versatile"] },
  whip: { category: "martial", type: "melee", damage: "1d4", damageType: "slashing", properties: ["Finesse", "Reach"] },

  // Martial Ranged Weapons
  blowgun: { category: "martial", type: "ranged", damage: "1", damageType: "piercing", range: "25/100", properties: ["Ammunition", "Loading"] },
  "hand crossbow": { category: "martial", type: "ranged", damage: "1d6", damageType: "piercing", range: "30/120", properties: ["Ammunition", "Light", "Loading"] },
  "crossbow, hand": { category: "martial", type: "ranged", damage: "1d6", damageType: "piercing", range: "30/120", properties: ["Ammunition", "Light", "Loading"] },
  "heavy crossbow": { category: "martial", type: "ranged", damage: "1d10", damageType: "piercing", range: "100/400", properties: ["Ammunition", "Heavy", "Loading", "Two-Handed"] },
  "crossbow, heavy": { category: "martial", type: "ranged", damage: "1d10", damageType: "piercing", range: "100/400", properties: ["Ammunition", "Heavy", "Loading", "Two-Handed"] },
  longbow: { category: "martial", type: "ranged", damage: "1d8", damageType: "piercing", range: "150/600", properties: ["Ammunition", "Heavy", "Two-Handed"] },
  net: { category: "martial", type: "ranged", damage: "", damageType: "", range: "5/15", properties: ["Special", "Thrown"] },
};

export const CLASS_WEAPON_PROFICIENCIES: Record<string, string[]> = {
  Barbarian: ["Simple weapons", "Martial weapons"],
  Bard: ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
  Cleric: ["Simple weapons"],
  Druid: ["Clubs", "Daggers", "Darts", "Javelins", "Maces", "Quarterstaffs", "Scimitars", "Sickles", "Slings", "Spears"],
  Fighter: ["Simple weapons", "Martial weapons"],
  Monk: ["Simple weapons", "Shortswords"],
  Paladin: ["Simple weapons", "Martial weapons"],
  Ranger: ["Simple weapons", "Martial weapons"],
  Rogue: ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
  Sorcerer: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
  Warlock: ["Simple weapons"],
  Wizard: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
  Artificer: ["Simple weapons"],
};

export const RACE_WEAPON_PROFICIENCIES: Record<string, string[]> = {
  Elf: ["Longswords", "Shortswords", "Shortbows", "Longbows"],
  "High Elf": ["Longswords", "Shortswords", "Shortbows", "Longbows"],
  "Wood Elf": ["Longswords", "Shortswords", "Shortbows", "Longbows"],
  Drow: ["Rapiers", "Shortswords", "Hand crossbows"],
  "Dark Elf (Drow)": ["Rapiers", "Shortswords", "Hand crossbows"],
  Dwarf: ["Battleaxes", "Handaxes", "Light hammers", "Warhammers"],
  "Hill Dwarf": ["Battleaxes", "Handaxes", "Light hammers", "Warhammers"],
  "Mountain Dwarf": ["Battleaxes", "Handaxes", "Light hammers", "Warhammers"],
  Githyanki: ["Shortswords", "Longswords", "Greatswords"],
};

function normalizeName(name: string): string {
  let s = name.toLowerCase().trim();
  s = s.replace(/^crossbow,\s*(light|hand|heavy)$/i, "$1 crossbow");
  s = s.replace(/^(light|hand|heavy)\s+crossbow$/i, "$1 crossbow");
  return s;
}

export function findStandardWeapon(name: string): StandardWeaponData | undefined {
  const clean = normalizeName(name);
  if (STANDARD_WEAPONS[clean]) return STANDARD_WEAPONS[clean];

  for (const [key, data] of Object.entries(STANDARD_WEAPONS)) {
    const pattern = new RegExp(`\\b${key}\\b`, "i");
    if (pattern.test(clean)) return data;
  }
  return undefined;
}

export type LooseInventoryItem = InventoryItem & {
  itemCategory?: string;
  type?: string;
  properties?: string[];
  finesse?: boolean;
};

export type LooseCharacter = Character & {
  weaponProficiencies?: string[];
};

export function isWeaponItem(item: InventoryItem): boolean {
  if (!item.isEquipped) return false;
  // Shields or armor without explicit weapon damage are not weapons
  if (item.ac != null && (!item.damage || item.damage.trim() === "")) return false;
  const nameLower = item.name.toLowerCase();
  if (nameLower.includes("shield") && (!item.damage || item.damage.trim() === "")) return false;
  if (nameLower.includes("armor") && (!item.damage || item.damage.trim() === "")) return false;

  const raw = item as unknown as LooseInventoryItem;
  if (raw.itemCategory === "Weapon") return true;
  if (typeof raw.type === "string" && raw.type.toLowerCase().includes("weapon")) return true;

  if (findStandardWeapon(item.name)) return true;
  if (item.damage && item.damage.trim() !== "") return true;

  return false;
}

export function isFinesseWeapon(item: InventoryItem): boolean {
  const raw = item as unknown as LooseInventoryItem;
  if (Array.isArray(raw.properties) && raw.properties.some((p: unknown) => typeof p === "string" && /finesse/i.test(p))) {
    return true;
  }
  if (raw.finesse === true) return true;
  if (/finesse/i.test(item.description || "")) return true;

  const std = findStandardWeapon(item.name);
  return Boolean(std?.properties.some((p) => /finesse/i.test(p)));
}

export function isRangedWeapon(item: InventoryItem): boolean {
  const raw = item as unknown as LooseInventoryItem;
  if (typeof raw.type === "string" && raw.type.toLowerCase().includes("ranged")) return true;
  if (Array.isArray(raw.properties) && raw.properties.some((p: unknown) => typeof p === "string" && /ammunition|\branged\b/i.test(p))) {
    return true;
  }

  const std = findStandardWeapon(item.name);
  if (std?.type === "ranged") return true;

  if (/\branged weapon\b/i.test(item.description || "")) return true;

  const clean = normalizeName(item.name);
  if (/bow|crossbow|sling|blowgun/i.test(clean)) return true;

  return false;
}

export function isLightWeapon(item: InventoryItem): boolean {
  const raw = item as unknown as LooseInventoryItem;
  if (Array.isArray(raw.properties) && raw.properties.some((p: unknown) => typeof p === "string" && /\blight\b/i.test(p))) {
    return true;
  }
  if (/\blight\b/i.test(item.description || "")) return true;

  const std = findStandardWeapon(item.name);
  return Boolean(std?.properties.some((p) => /\blight\b/i.test(p)));
}

export function isProficientWithWeapon(
  character: Character,
  item: InventoryItem,
  opts: { classes?: ClassData[]; ancestry?: ResolvedAncestry } = {}
): boolean {
  const profs = new Set<string>();

  const rawChar = character as unknown as LooseCharacter;
  if (Array.isArray(rawChar.weaponProficiencies)) {
    for (const p of rawChar.weaponProficiencies) {
      if (typeof p === "string") profs.add(p);
    }
  }

  if (Array.isArray(character.multiclassProficiencies)) {
    for (const mp of character.multiclassProficiencies) {
      for (const w of mp.weapons || []) profs.add(w);
    }
  }

  if (character.classes && character.classes.length > 0) {
    if (opts.classes) {
      const derived = proficiencies(character, opts.classes);
      for (const w of derived.weapons) profs.add(w);
    } else {
      const firstClass = character.classes[0];
      if (firstClass && firstClass.level >= 1) {
        const initial = CLASS_WEAPON_PROFICIENCIES[firstClass.className];
        for (const w of initial || []) profs.add(w);
      }
      for (const c of character.classes.slice(1)) {
        if (c.level >= 1) {
          const mc = MULTICLASS_PROFICIENCIES[c.className]?.weapons;
          for (const w of mc || []) profs.add(w);
        }
      }
    }
  }

  if (character.race?.name) {
    const raceProfs =
      RACE_WEAPON_PROFICIENCIES[character.race.name] ||
      (character.race.subraceName ? RACE_WEAPON_PROFICIENCIES[character.race.subraceName] : undefined);
    for (const w of raceProfs || []) profs.add(w);
  }

  const std = findStandardWeapon(item.name);
  const category = (std?.category || (/martial/i.test(item.description || "") ? "martial" : "simple")).toLowerCase();
  const isSimple = category === "simple";
  const isMartial = category === "martial";

  const cleanItemName = normalizeName(item.name);
  const singularItem = cleanItemName.replace(/s$/, "");

  for (const prof of profs) {
    const pClean = normalizeName(prof);
    if (isSimple && (pClean === "simple" || pClean.includes("simple"))) return true;
    if (isMartial && (pClean === "martial" || pClean.includes("martial"))) return true;
    if (pClean.includes("all weapon")) return true;

    const singularProf = pClean.replace(/s$/, "");
    if (singularProf === singularItem) return true;

    const pattern = new RegExp(`\\b${singularProf}\\b`, "i");
    if (pattern.test(cleanItemName) || pattern.test(singularItem)) return true;
  }

  return false;
}

export function formatDamageString(damageDice: string, abilityMod: number, isOffHand = false): string {
  const dice = damageDice || "1d4";
  if (isOffHand && abilityMod > 0) {
    return dice;
  }
  if (abilityMod > 0) {
    return `${dice} + ${abilityMod}`;
  }
  if (abilityMod < 0) {
    return `${dice} - ${Math.abs(abilityMod)}`;
  }
  return dice;
}

export function getWeaponAttacks(
  character: Character,
  opts: { classes?: ClassData[]; ancestry?: ResolvedAncestry } = {}
): WeaponAttackOption[] {
  const { modifiers } = effectiveScores(character, opts.ancestry);
  const pb = proficiencyBonus(totalLevel(character));

  const equipped = (character.items || []).filter(
    (item) => item.isEquipped && isWeaponItem(item)
  );

  return equipped.map((item) => {
    const std = findStandardWeapon(item.name);
    const isFinesse = isFinesseWeapon(item);
    const isRanged = isRangedWeapon(item);
    const isLight = isLightWeapon(item);

    const statUsed: AbilityKey = isFinesse
      ? modifiers.dex > modifiers.str
        ? "dex"
        : "str"
      : isRanged
      ? "dex"
      : "str";

    const isProficient = isProficientWithWeapon(character, item, opts);
    const abilityMod = modifiers[statUsed];
    const attackBonus = abilityMod + (isProficient ? pb : 0);

    const damageDice = item.damage?.trim() || std?.damage || "1d4";
    const damageString = formatDamageString(damageDice, abilityMod, false);

    return {
      item,
      name: item.name,
      statUsed,
      attackBonus,
      toHit: attackBonus,
      damage: damageString,
      damageString,
      damageDice,
      damageType: item.damageType ?? std?.damageType ?? null,
      range: item.range ?? std?.range ?? null,
      isProficient,
      isRanged,
      isFinesse,
      isLight,
    };
  });
}

export function checkDualWielding(
  character: Character,
  attacks?: WeaponAttackOption[]
): DualWieldResult {
  const weaponAttacks = attacks ?? getWeaponAttacks(character);
  const lightMeleeAttacks = weaponAttacks.filter(
    (a) => a.isLight && !a.isRanged
  );

  if (lightMeleeAttacks.length < 2) {
    return { isDualWielding: false };
  }

  const mainHand = lightMeleeAttacks[0];
  const second = lightMeleeAttacks[1];

  const { modifiers } = effectiveScores(character);
  const secondAbilityMod = modifiers[second.statUsed];
  const offHandDamage = formatDamageString(second.damageDice, secondAbilityMod, true);

  const offHand: WeaponAttackOption = {
    ...second,
    damage: offHandDamage,
    damageString: offHandDamage,
    isOffHand: true,
  };

  return {
    isDualWielding: true,
    mainHand,
    offHand,
  };
}
