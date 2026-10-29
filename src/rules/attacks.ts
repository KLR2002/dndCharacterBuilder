import type { AbilityKey, Character, InventoryItem } from "../types/character.ts";
import type { ResolvedAncestry } from "./types.ts";
import type { CharacterCatalogs } from "./catalogs.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";
import { proficiencySheet } from "./proficiencySheet.ts";
import { getMartialArtsDie, getSneakAttackDice, getManeuverSaveDc } from "./combatDice.ts";
import { hasFightingStyle, hasInvocation } from "./ruleChoices.ts";
import { kenseiWeaponNames } from "./kenseiWeapons.ts";

export { getManeuverSaveDc };

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
  isMonkWeapon?: boolean;
  isSneakAttackEligible?: boolean;
  sneakAttackDice?: string;
  calculationBadges?: string[];
  archeryBonus?: number;
  duelingBonus?: number;
  infusionBonus?: number;
  itemBonus?: number;
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

export function isMonkWeapon(item: InventoryItem): boolean {
  const cleanName = item.name.toLowerCase().trim();
  if (cleanName === "shortsword" || cleanName === "shortswords") return true;
  if (cleanName === "unarmed strike" || cleanName === "unarmed strikes") return true;

  const std = findStandardWeapon(item.name);
  if (!std) return false;
  if (std.category !== "simple" || std.type !== "melee") return false;
  if (std.properties.includes("Two-Handed") || std.properties.includes("Heavy")) return false;
  return true;
}

export function parseMaxDieRoll(die: string): number {
  const clean = die.trim().toLowerCase();
  if (clean === "1") return 1;
  const match = clean.match(/^(\d+)d(\d+)$/);
  if (match) {
    const count = parseInt(match[1], 10);
    const faces = parseInt(match[2], 10);
    return count * faces;
  }
  return 0;
}

export type LooseInventoryItem = InventoryItem & {
  itemCategory?: string;
  type?: string;
  properties?: string[];
  finesse?: boolean;
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

export function isThrownWeapon(item: InventoryItem): boolean {
  const raw = item as unknown as LooseInventoryItem;
  if (Array.isArray(raw.properties) && raw.properties.some((p: unknown) => typeof p === "string" && /thrown/i.test(p))) {
    return true;
  }
  if (/thrown/i.test(item.description || "")) return true;

  const std = findStandardWeapon(item.name);
  return Boolean(std?.properties.some((p) => /thrown/i.test(p)));
}

export function isTwoHandedWeapon(item: InventoryItem): boolean {
  const raw = item as unknown as LooseInventoryItem;
  if (Array.isArray(raw.properties) && raw.properties.some((p: unknown) => typeof p === "string" && /two-handed/i.test(p))) {
    return true;
  }
  if (/two-handed/i.test(item.description || "")) return true;

  const std = findStandardWeapon(item.name);
  return Boolean(std?.properties.some((p) => /two-handed/i.test(p)));
}

export function isItemInfusedWith(
  character: Character,
  item: InventoryItem,
  infusionName: string,
  fallbackTarget?: "weapon"
): boolean {
  const norm = infusionName.toLowerCase().trim();
  if (item.infusedWith?.toLowerCase().trim() === norm) return true;

  const activeList = character.activeInfusions || [];
  const activeMatch = activeList.find(
    (inf) => inf.infusionName.toLowerCase().trim() === norm
  );
  if (!activeMatch) return false;

  if (activeMatch.targetItemId && item.id) {
    return activeMatch.targetItemId === item.id;
  }
  if (activeMatch.targetItemName) {
    return activeMatch.targetItemName.toLowerCase().trim() === item.name.toLowerCase().trim();
  }

  if (fallbackTarget === "weapon" && isWeaponItem(item)) {
    const firstEquipped = (character.items || []).find((i) => i.isEquipped && isWeaponItem(i));
    if (firstEquipped && (firstEquipped.id ? firstEquipped.id === item.id : firstEquipped.name === item.name)) {
      return true;
    }
  }

  return false;
}

/**
 * Whether the item is a weapon the character is proficient with, given the weapon names on the
 * Proficiency Sheet. A category name ("Simple weapons", "Martial weapons") covers every
 * weapon of that category.
 */
export function isProficientWithWeapon(item: InventoryItem, sheetWeapons: string[]): boolean {
  const std = findStandardWeapon(item.name);
  const category = (std?.category || (/martial/i.test(item.description || "") ? "martial" : "simple")).toLowerCase();
  const isSimple = category === "simple";
  const isMartial = category === "martial";

  const cleanItemName = normalizeName(item.name);
  const singularItem = cleanItemName.replace(/s$/, "");

  for (const prof of sheetWeapons) {
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

export function formatDamageString(
  damageDice: string,
  abilityMod: number,
  isOffHand = false,
  extraBonus = 0
): string {
  const dice = damageDice || "1d4";
  const modPart = isOffHand && abilityMod > 0 ? 0 : abilityMod;
  const totalMod = modPart + extraBonus;
  if (totalMod > 0) {
    return `${dice} + ${totalMod}`;
  }
  if (totalMod < 0) {
    return `${dice} - ${Math.abs(totalMod)}`;
  }
  return dice;
}

export function getWeaponAttacks(
  character: Character,
  opts: { catalogs: CharacterCatalogs; ancestry?: ResolvedAncestry }
): WeaponAttackOption[] {
  const { modifiers } = effectiveScores(character, opts.ancestry);
  const pb = proficiencyBonus(totalLevel(character));
  const sheetWeapons = proficiencySheet(character, opts.catalogs).weapons.map((weapon) => weapon.name);
  const kenseiWeapons = new Set(kenseiWeaponNames(character, opts.catalogs).map((name) => name.toLowerCase()));

  const monk = (character.classes || []).find((c) => c.className === "Monk");
  const rogue = (character.classes || []).find((c) => c.className === "Rogue");
  const martialArtsDie = monk ? getMartialArtsDie(monk.level) : null;
  const sneakDice = rogue ? getSneakAttackDice(rogue.level) : null;

  const hasArchery = hasFightingStyle(character, "Archery");
  const hasDueling = hasFightingStyle(character, "Dueling");
  const hasThrown = hasFightingStyle(character, "Thrown Weapon Fighting");

  const equipped = (character.items || []).filter(
    (item) => item.isEquipped && isWeaponItem(item)
  );

  // Dueling check:
  // Character has single equipped melee weapon in main hand and no other weapon equipped (shield is fine)
  const equippedWeapons = (character.items || []).filter(
    (item) => item.isEquipped && isWeaponItem(item) && item.name.toLowerCase().trim() !== "unarmed strike"
  );
  const isSingleMeleeWeapon =
    equippedWeapons.length === 1 &&
    !isRangedWeapon(equippedWeapons[0]) &&
    !isTwoHandedWeapon(equippedWeapons[0]);
  const duelingWeaponId = isSingleMeleeWeapon ? equippedWeapons[0].id : null;

  const hasEquippedUnarmed = equipped.some(
    (i) => i.name.toLowerCase().trim() === "unarmed strike"
  );
  const itemsToEvaluate = [...equipped];
  if (monk && !hasEquippedUnarmed) {
    itemsToEvaluate.push({
      id: "unarmed_strike_virtual",
      name: "Unarmed Strike",
      source: "PHB",
      section: "equipped",
      quantity: 1,
      weight: 0,
      isEquipped: true,
      damage: "1",
      damageType: "bludgeoning",
    });
  }

  return itemsToEvaluate.map((item) => {
    const std = findStandardWeapon(item.name);
    const isFinesse = isFinesseWeapon(item);
    const isRanged = isRangedWeapon(item);
    const isLight = isLightWeapon(item);
    const isMonk = isMonkWeapon(item) || kenseiWeapons.has(item.name.trim().toLowerCase());
    const isThrown = isThrownWeapon(item);

    let statUsed: AbilityKey = isFinesse
      ? modifiers.dex > modifiers.str
        ? "dex"
        : "str"
      : isRanged
      ? "dex"
      : "str";

    if (monk && isMonk && modifiers.dex > modifiers.str) {
      statUsed = "dex";
    }

    const isProficient =
      item.name.toLowerCase().trim() === "unarmed strike" ||
      isProficientWithWeapon(item, sheetWeapons);
    const abilityMod = modifiers[statUsed];

    const artificer = (character.classes || []).find(
      (c) => c.className.toLowerCase() === "artificer"
    );
    const artificerLevel = artificer ? artificer.level : 0;
    const ewBonus = artificerLevel >= 10 ? 2 : 1;

    let weaponInfusionBonus = 0;
    if (isItemInfusedWith(character, item, "Enhanced Weapon", "weapon")) {
      weaponInfusionBonus = ewBonus;
    } else if (
      isItemInfusedWith(character, item, "Repeating Shot", "weapon") ||
      isItemInfusedWith(character, item, "Radiant Weapon", "weapon") ||
      isItemInfusedWith(character, item, "Returning Weapon", "weapon")
    ) {
      weaponInfusionBonus = 1;
    }

    const rawItemBonus = item.bonusWeapon ?? (() => {
      const m = item.name.match(/\+(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    })();
    const isAttuned = !item.attunement || item.isAttuned === true;
    const itemWeaponBonus = isAttuned ? rawItemBonus : 0;

    const calculationBadges: string[] = [];
    let archeryBonus = 0;
    let attackBonus = abilityMod + (isProficient ? pb : 0) + weaponInfusionBonus + itemWeaponBonus;
    if (hasArchery && isRanged) {
      attackBonus += 2;
      archeryBonus = 2;
      calculationBadges.push("Archery +2");
    }

    let extraDamage = weaponInfusionBonus + itemWeaponBonus;
    let duelingBonus = 0;
    if (hasDueling && duelingWeaponId === item.id) {
      extraDamage += 2;
      duelingBonus = 2;
      calculationBadges.push("Dueling +2");
    }
    if (hasThrown && isThrown) {
      extraDamage += 2;
    }

    if (itemWeaponBonus > 0) {
      calculationBadges.push(`Item +${itemWeaponBonus}`);
    }
    if (item.attunement && !item.isAttuned) {
      calculationBadges.push("Unattuned");
    }
    if (weaponInfusionBonus > 0) {
      calculationBadges.push(`Infused +${weaponInfusionBonus}`);
    }

    let damageDice = item.damage?.trim() || std?.damage || "1d4";
    if (monk && isMonk && martialArtsDie) {
      if (parseMaxDieRoll(martialArtsDie) > parseMaxDieRoll(damageDice)) {
        damageDice = martialArtsDie;
      }
    }
    const damageString = formatDamageString(damageDice, abilityMod, false, extraDamage);

    const isSneakAttackEligible = Boolean(rogue && (isFinesse || isRanged));

    return {
      item,
      name: item.name,
      statUsed,
      attackBonus,
      toHit: attackBonus,
      damage: damageString,
      damageString,
      damageDice,
      damageType:
        item.damageType ??
        std?.damageType ??
        (item.name.toLowerCase().trim() === "unarmed strike" ? "bludgeoning" : null),
      range: item.range ?? std?.range ?? null,
      isProficient,
      isRanged,
      isFinesse,
      isLight,
      isMonkWeapon: isMonk,
      isSneakAttackEligible,
      sneakAttackDice: isSneakAttackEligible && sneakDice ? sneakDice : undefined,
      calculationBadges: calculationBadges.length > 0 ? calculationBadges : undefined,
      archeryBonus: archeryBonus || undefined,
      duelingBonus: duelingBonus || undefined,
      infusionBonus: weaponInfusionBonus || undefined,
      itemBonus: itemWeaponBonus || undefined,
    };
  });
}

export function checkDualWielding(
  character: Character,
  weaponAttacks: WeaponAttackOption[]
): DualWieldResult {
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
  const hasTwf = hasFightingStyle(character, "Two-Weapon Fighting");
  const hasThrown = hasFightingStyle(character, "Thrown Weapon Fighting");
  const isOffHandPenalty = !hasTwf;

  const artificer = (character.classes || []).find(
    (c) => c.className.toLowerCase() === "artificer"
  );
  const artificerLevel = artificer ? artificer.level : 0;
  const ewBonus = artificerLevel >= 10 ? 2 : 1;

  const offHandWeapon = second.item;
  const rawOffHandBonus = second.itemBonus ?? offHandWeapon.bonusWeapon ?? (() => {
    const m = offHandWeapon.name.match(/\+(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  })();
  const isOffHandAttuned = !offHandWeapon.attunement || offHandWeapon.isAttuned === true;
  const offHandItemBonus = isOffHandAttuned ? rawOffHandBonus : 0;

  let offHandInfusionBonus = 0;
  if (isItemInfusedWith(character, offHandWeapon, "Enhanced Weapon", "weapon")) {
    offHandInfusionBonus = ewBonus;
  } else if (
    isItemInfusedWith(character, offHandWeapon, "Repeating Shot", "weapon") ||
    isItemInfusedWith(character, offHandWeapon, "Radiant Weapon", "weapon") ||
    isItemInfusedWith(character, offHandWeapon, "Returning Weapon", "weapon")
  ) {
    offHandInfusionBonus = 1;
  }

  const extraDamage =
    (hasThrown && isThrownWeapon(second.item) ? 2 : 0) +
    offHandInfusionBonus +
    offHandItemBonus;
  const offHandDamage = formatDamageString(second.damageDice, secondAbilityMod, isOffHandPenalty, extraDamage);

  const offHandBadges: string[] = [];
  if (offHandItemBonus > 0) {
    offHandBadges.push(`Item +${offHandItemBonus}`);
  }
  if (offHandWeapon.attunement && !offHandWeapon.isAttuned) {
    offHandBadges.push("Unattuned");
  }
  if (offHandInfusionBonus > 0) {
    offHandBadges.push(`Infused +${offHandInfusionBonus}`);
  }

  const offHand: WeaponAttackOption = {
    ...second,
    damage: offHandDamage,
    damageString: offHandDamage,
    isOffHand: true,
    calculationBadges: offHandBadges.length > 0 ? offHandBadges : undefined,
    infusionBonus: offHandInfusionBonus || undefined,
    itemBonus: offHandItemBonus || undefined,
  };

  return {
    isDualWielding: true,
    mainHand,
    offHand,
  };
}

/**
 * Calculates damage for Eldritch Blast, including Charisma modifier if Agonizing Blast is chosen.
 */
export function getEldritchBlastDamage(character: Character): string {
  const hasAgonizing = hasInvocation(character, "Agonizing Blast");
  if (!hasAgonizing) {
    return "1d10 force";
  }
  const { modifiers } = effectiveScores(character);
  const chaMod = modifiers.cha;
  if (chaMod >= 0) {
    return `1d10 + ${chaMod} force`;
  }
  return `1d10 - ${Math.abs(chaMod)} force`;
}

