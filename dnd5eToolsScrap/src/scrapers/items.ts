import { ToolsClient } from "../client.js";
import { resolveAllCopies } from "../parser/copy-resolver.js";
import { renderEntries } from "../parser/entry-renderer.js";
import { cleanTags } from "../parser/tag-cleaner.js";
import { ItemModel } from "../types/models.js";

const ITEM_TYPE_MAP: Record<string, string> = {
  M: "Melee Weapon",
  R: "Ranged Weapon",
  LA: "Light Armor",
  MA: "Medium Armor",
  HA: "Heavy Armor",
  S: "Shield",
  W: "Wondrous Item",
  P: "Potion",
  SC: "Scroll",
  RG: "Ring",
  RD: "Rod",
  ST: "Staff",
  WD: "Wand",
  G: "Adventuring Gear",
  T: "Tool",
  AT: "Artisan's Tools",
  GS: "Gaming Set",
  INS: "Instrument",
  MNT: "Mount",
  VEH: "Vehicle (Land)",
  SHP: "Vehicle (Water)",
  AIR: "Vehicle (Air)",
  SPC: "Vehicle (Space)",
  TAH: "Tack and Harness",
  TG: "Trade Good",
  EXP: "Explosive",
  FD: "Food and Drink",
  A: "Ammunition",
  AF: "Futuristic Ammunition",
  SCF: "Spellcasting Focus",
  OTH: "Other",
  "$A": "Treasure (Art Object)",
  "$C": "Treasure (Coinage)",
  "$G": "Treasure (Gemstone)",
};

const PROPERTY_MAP: Record<string, string> = {
  A: "Ammunition",
  AF: "Ammunition (Futuristic)",
  BF: "Burst Fire",
  F: "Finesse",
  H: "Heavy",
  L: "Light",
  LD: "Loading",
  R: "Reach",
  RLD: "Reload",
  S: "Special",
  T: "Thrown",
  "2H": "Two-Handed",
  V: "Versatile",
};

const DAMAGE_TYPE_MAP: Record<string, string> = {
  S: "slashing",
  P: "piercing",
  B: "bludgeoning",
  A: "acid",
  C: "cold",
  F: "fire",
  O: "force",
  L: "lightning",
  N: "necrotic",
  I: "poison",
  Y: "psychic",
  R: "radiant",
  T: "thunder",
};

export async function scrapeItems(client: ToolsClient): Promise<ItemModel[]> {
  console.log("  → Fetching base items from data/items-base.json...");
  const baseData = await client.fetchJson<{ baseitem?: any[] }>("data/items-base.json");

  console.log("  → Fetching items from data/items.json...");
  const itemData = await client.fetchJson<{ item?: any[] }>("data/items.json");

  // Attempt to fetch magicvariants.json if available
  let magicVariantsData: { magicvariant?: any[]; variant?: any[] } | null = null;
  try {
    magicVariantsData = await client.fetchJson<{ magicvariant?: any[]; variant?: any[] }>("data/magicvariants.json");
  } catch {
    // Offline fallback or file missing; handled gracefully by built-in generator
  }

  const baseItemsList = baseData.baseitem || [];
  const combined = [...baseItemsList, ...(itemData.item || [])];
  const resolved = resolveAllCopies(combined);

  const seen = new Set<string>();
  const items: ItemModel[] = [];

  for (const raw of resolved) {
    const rawType = raw.type || "";
    const baseTypeCode = rawType.split("|")[0].trim();

    let type = ITEM_TYPE_MAP[baseTypeCode] || ITEM_TYPE_MAP[rawType] || rawType || "Item";
    if (type === "Item" && raw.staff) type = "Staff";
    if (type === "Item" && raw.wondrous) type = "Wondrous Item";

    const itemCategory = getItemCategory(rawType, raw);

    const name = cleanTags(raw.name, "plain");
    const source = raw.source || "PHB";
    const key = `${name.toLowerCase()}__${source.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Rarity
    const rawRarity = raw.rarity || "none";
    const rarity = rawRarity.charAt(0).toUpperCase() + rawRarity.slice(1);

    // Attunement
    let attunement: boolean | string = false;
    if (raw.reqAttune != null) {
      if (typeof raw.reqAttune === "boolean") {
        attunement = raw.reqAttune;
      } else if (typeof raw.reqAttune === "string") {
        attunement = cleanTags(raw.reqAttune, "plain");
      }
    }

    // Cost
    let cost: string | null = null;
    if (raw.value != null) {
      cost = formatValue(raw.value);
    }

    // Weight
    const weight = typeof raw.weight === "number" ? raw.weight : null;

    // Damage & Properties
    const damage = raw.dmg1 || null;
    const damageType = raw.dmgType ? DAMAGE_TYPE_MAP[raw.dmgType] || raw.dmgType : null;
    const range = raw.range ? `${raw.range}` : null;

    const properties: string[] = [];
    if (Array.isArray(raw.property)) {
      for (const p of raw.property) {
        const cleanProp = typeof p === "string" ? p.split("|")[0].trim() : p;
        properties.push(PROPERTY_MAP[cleanProp] || cleanProp);
      }
    }

    // Armor AC
    const ac = typeof raw.ac === "number" ? raw.ac : null;
    const strengthRequirement = typeof raw.strength === "number" ? raw.strength : null;
    const stealthDisadvantage = Boolean(raw.stealth);

    // Parse enhancement bonuses (+1, +2, +3)
    let bonusWeapon: number | undefined;
    let bonusAc: number | undefined;

    if (raw.bonusWeapon != null) {
      bonusWeapon = parseInt(String(raw.bonusWeapon), 10);
    } else if (raw.bonusAttack != null) {
      bonusWeapon = parseInt(String(raw.bonusAttack), 10);
    }

    if (raw.bonusAc != null) {
      bonusAc = parseInt(String(raw.bonusAc), 10);
    }

    // Name-based fallback for +1, +2, +3 items
    const plusMatch = name.match(/,\s*\+([123])$/i) ||
                      name.match(/^\+([123])\s+/i) ||
                      name.match(/\b\+([123])\s+(?:weapon|armor|shield)\b/i);
    if (plusMatch) {
      const val = parseInt(plusMatch[1], 10);
      if (bonusWeapon == null && (itemCategory === "Weapon" || baseTypeCode === "M" || baseTypeCode === "R")) {
        bonusWeapon = val;
      }
      if (bonusAc == null && (itemCategory === "Armor" || itemCategory === "Shield" || ["LA", "MA", "HA", "S"].includes(baseTypeCode))) {
        bonusAc = val;
      }
    }

    items.push({
      name,
      source,
      type,
      itemCategory,
      rarity,
      attunement,
      cost,
      weight,
      damage,
      damageType,
      range,
      properties,
      ac,
      strengthRequirement,
      stealthDisadvantage,
      description: renderEntries(raw.entries, "markdown"),
      rawEntries: raw.entries,
      ...(bonusWeapon != null && !isNaN(bonusWeapon) ? { bonusWeapon } : {}),
      ...(bonusAc != null && !isNaN(bonusAc) ? { bonusAc } : {}),
    });
  }

  // Generate concrete magic variants for all standard 2014 PHB base weapons and armors
  console.log("  → Generating concrete magic variants (weapons +1/+2/+3, Warning, Vicious, armor +1/+2/+3, Adamantine, Mithral)...");
  const generatedVariants = generateMagicVariants(baseItemsList);
  for (const item of generatedVariants) {
    const key = `${item.name.toLowerCase()}__${item.source.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  }

  return items;
}

function getItemCategory(typeCode: string, raw: any): string {
  const baseCode = typeCode.split("|")[0].trim();
  if (baseCode === "M" || baseCode === "R") return "Weapon";
  if (baseCode === "LA" || baseCode === "MA" || baseCode === "HA") return "Armor";
  if (baseCode === "S") return "Shield";
  if (baseCode === "P") return "Potion";
  if (baseCode === "SC") return "Scroll";
  if (baseCode === "RG") return "Ring";
  if (baseCode === "RD") return "Rod";
  if (baseCode === "ST" || raw?.staff) return "Staff";
  if (baseCode === "WD") return "Wand";
  if (baseCode === "W" || raw?.wondrous) return "Wondrous Item";
  if (baseCode === "T" || baseCode === "AT" || baseCode === "GS" || baseCode === "INS") return "Tool";
  if (baseCode === "G" || baseCode === "SCF" || baseCode === "A" || baseCode === "AF") return "Adventuring Gear";
  return "Item";
}

function formatValue(value: number): string {
  if (value >= 100) {
    const gp = value / 100;
    return `${Number.isInteger(gp) ? gp : gp.toFixed(2)} gp`;
  }
  if (value >= 10) {
    const sp = value / 10;
    return `${Number.isInteger(sp) ? sp : sp.toFixed(1)} sp`;
  }
  return `${value} cp`;
}

function generateMagicVariants(baseItems: any[]): ItemModel[] {
  const results: ItemModel[] = [];

  // Filter 2014 PHB standard weapons and armors
  const phbWeapons = baseItems.filter(
    (b) => (b.source === "PHB" || !b.source) && (b.type === "M" || b.type === "R")
  );
  const phbArmors = baseItems.filter(
    (b) => (b.source === "PHB" || !b.source) && ["LA", "MA", "HA", "S"].includes(b.type)
  );

  const formatProps = (props: any[] | undefined): string[] => {
    if (!Array.isArray(props)) return [];
    return props.map((p) => {
      const clean = typeof p === "string" ? p.split("|")[0].trim() : p;
      return PROPERTY_MAP[clean] || clean;
    });
  };

  // 1. Weapon Variants (+1, +2, +3, Weapon of Warning, Vicious Weapon)
  for (const w of phbWeapons) {
    const weaponName = cleanTags(w.name, "plain");
    const weight = typeof w.weight === "number" ? w.weight : null;
    const damage = w.dmg1 || null;
    const damageType = w.dmgType ? DAMAGE_TYPE_MAP[w.dmgType] || w.dmgType : null;
    const range = w.range ? `${w.range}` : null;
    const properties = formatProps(w.property);
    const type = w.type === "R" ? "Ranged Weapon" : "Melee Weapon";

    // +1 Weapon
    results.push({
      name: `${weaponName}, +1`,
      source: "DMG",
      type,
      itemCategory: "Weapon",
      rarity: "Uncommon",
      attunement: false,
      cost: null,
      weight,
      damage,
      damageType,
      range,
      properties,
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      bonusWeapon: 1,
      description: "You have a +1 bonus to attack and damage rolls made with this magic weapon.",
    });

    // +2 Weapon
    results.push({
      name: `${weaponName}, +2`,
      source: "DMG",
      type,
      itemCategory: "Weapon",
      rarity: "Rare",
      attunement: false,
      cost: null,
      weight,
      damage,
      damageType,
      range,
      properties,
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      bonusWeapon: 2,
      description: "You have a +2 bonus to attack and damage rolls made with this magic weapon.",
    });

    // +3 Weapon
    results.push({
      name: `${weaponName}, +3`,
      source: "DMG",
      type,
      itemCategory: "Weapon",
      rarity: "Very Rare",
      attunement: false,
      cost: null,
      weight,
      damage,
      damageType,
      range,
      properties,
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      bonusWeapon: 3,
      description: "You have a +3 bonus to attack and damage rolls made with this magic weapon.",
    });

    // Weapon of Warning
    results.push({
      name: `${weaponName} of Warning`,
      source: "DMG",
      type,
      itemCategory: "Weapon",
      rarity: "Uncommon",
      attunement: "requires attunement",
      cost: null,
      weight,
      damage,
      damageType,
      range,
      properties,
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      description:
        "This magic weapon warns you of danger. While the weapon is on your person, you have advantage on initiative rolls. In addition, you and any of your companions within 30 feet of you can't be surprised, except when incapacitated by something other than nonmagical sleep. The weapon magically awakens you and your companions within range if any of you are sleeping naturally when combat begins.",
    });

    // Vicious Weapon
    results.push({
      name: `Vicious ${weaponName}`,
      source: "DMG",
      type,
      itemCategory: "Weapon",
      rarity: "Rare",
      attunement: false,
      cost: null,
      weight,
      damage,
      damageType,
      range,
      properties,
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      description: "When you roll a 20 on your attack roll with this magic weapon, the target takes an extra 7 damage of the weapon's type.",
    });
  }

  // 2. Armor and Shield Variants (+1, +2, +3, Adamantine, Mithral)
  for (const a of phbArmors) {
    const armorName = cleanTags(a.name, "plain");
    const weight = typeof a.weight === "number" ? a.weight : null;
    const baseAc = typeof a.ac === "number" ? a.ac : 10;
    const strengthRequirement = typeof a.strength === "number" ? a.strength : null;
    const stealthDisadvantage = Boolean(a.stealth);
    const isShield = a.type === "S" || armorName.toLowerCase() === "shield";
    const type = isShield
      ? "Shield"
      : a.type === "LA"
      ? "Light Armor"
      : a.type === "MA"
      ? "Medium Armor"
      : "Heavy Armor";
    const itemCategory = isShield ? "Shield" : "Armor";

    if (isShield) {
      // Shield, +1
      results.push({
        name: "Shield, +1",
        source: "DMG",
        type: "Shield",
        itemCategory: "Shield",
        rarity: "Uncommon",
        attunement: false,
        cost: null,
        weight,
        damage: null,
        damageType: null,
        range: null,
        properties: [],
        ac: baseAc,
        strengthRequirement: null,
        stealthDisadvantage: false,
        bonusAc: 1,
        description: "While holding this shield, you have a +1 bonus to AC. This bonus is in addition to the shield's normal bonus to AC.",
      });

      // Shield, +2
      results.push({
        name: "Shield, +2",
        source: "DMG",
        type: "Shield",
        itemCategory: "Shield",
        rarity: "Rare",
        attunement: false,
        cost: null,
        weight,
        damage: null,
        damageType: null,
        range: null,
        properties: [],
        ac: baseAc,
        strengthRequirement: null,
        stealthDisadvantage: false,
        bonusAc: 2,
        description: "While holding this shield, you have a +2 bonus to AC. This bonus is in addition to the shield's normal bonus to AC.",
      });

      // Shield, +3
      results.push({
        name: "Shield, +3",
        source: "DMG",
        type: "Shield",
        itemCategory: "Shield",
        rarity: "Very Rare",
        attunement: false,
        cost: null,
        weight,
        damage: null,
        damageType: null,
        range: null,
        properties: [],
        ac: baseAc,
        strengthRequirement: null,
        stealthDisadvantage: false,
        bonusAc: 3,
        description: "While holding this shield, you have a +3 bonus to AC. This bonus is in addition to the shield's normal bonus to AC.",
      });
    } else {
      // Armor, +1
      results.push({
        name: `${armorName}, +1`,
        source: "DMG",
        type,
        itemCategory: "Armor",
        rarity: "Rare",
        attunement: false,
        cost: null,
        weight,
        damage: null,
        damageType: null,
        range: null,
        properties: [],
        ac: baseAc,
        strengthRequirement,
        stealthDisadvantage,
        bonusAc: 1,
        description: "You have a +1 bonus to AC while wearing this armor.",
      });

      // Armor, +2
      results.push({
        name: `${armorName}, +2`,
        source: "DMG",
        type,
        itemCategory: "Armor",
        rarity: "Very Rare",
        attunement: false,
        cost: null,
        weight,
        damage: null,
        damageType: null,
        range: null,
        properties: [],
        ac: baseAc,
        strengthRequirement,
        stealthDisadvantage,
        bonusAc: 2,
        description: "You have a +2 bonus to AC while wearing this armor.",
      });

      // Armor, +3
      results.push({
        name: `${armorName}, +3`,
        source: "DMG",
        type,
        itemCategory: "Armor",
        rarity: "Legendary",
        attunement: false,
        cost: null,
        weight,
        damage: null,
        damageType: null,
        range: null,
        properties: [],
        ac: baseAc,
        strengthRequirement,
        stealthDisadvantage,
        bonusAc: 3,
        description: "You have a +3 bonus to AC while wearing this armor.",
      });

      // Adamantine & Mithral (Medium & Heavy armor except Hide)
      const isEligibleMetal = (a.type === "MA" || a.type === "HA") && armorName.toLowerCase() !== "hide armor";
      if (isEligibleMetal) {
        results.push({
          name: `Adamantine ${armorName}`,
          source: "DMG",
          type,
          itemCategory: "Armor",
          rarity: "Uncommon",
          attunement: false,
          cost: null,
          weight,
          damage: null,
          damageType: null,
          range: null,
          properties: [],
          ac: baseAc,
          strengthRequirement,
          stealthDisadvantage,
          description: "This suit of armor is reinforced with adamantine, one of the hardest substances in existence. While you're wearing it, any critical hit against you becomes a normal hit.",
        });

        results.push({
          name: `Mithral ${armorName}`,
          source: "DMG",
          type,
          itemCategory: "Armor",
          rarity: "Uncommon",
          attunement: false,
          cost: null,
          weight,
          damage: null,
          damageType: null,
          range: null,
          properties: [],
          ac: baseAc,
          strengthRequirement: null,
          stealthDisadvantage: false,
          description: "Mithral is a light, flexible metal. A mithral chain shirt or breastplate can be worn under normal clothes. If the armor normally imposes disadvantage on Dexterity (Stealth) checks or has a Strength requirement, the mithral version of the armor doesn't.",
        });
      }
    }
  }

  // 3. Generic Templates (for custom/homebrew base items)
  const genericTemplates: ItemModel[] = [
    {
      name: "Weapon, +1",
      source: "DMG",
      type: "Melee or Ranged Weapon",
      itemCategory: "Weapon",
      rarity: "Uncommon",
      attunement: false,
      cost: null,
      weight: null,
      damage: null,
      damageType: null,
      range: null,
      properties: [],
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      bonusWeapon: 1,
      description: "You have a +1 bonus to attack and damage rolls made with this magic weapon.",
    },
    {
      name: "Weapon, +2",
      source: "DMG",
      type: "Melee or Ranged Weapon",
      itemCategory: "Weapon",
      rarity: "Rare",
      attunement: false,
      cost: null,
      weight: null,
      damage: null,
      damageType: null,
      range: null,
      properties: [],
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      bonusWeapon: 2,
      description: "You have a +2 bonus to attack and damage rolls made with this magic weapon.",
    },
    {
      name: "Weapon, +3",
      source: "DMG",
      type: "Melee or Ranged Weapon",
      itemCategory: "Weapon",
      rarity: "Very Rare",
      attunement: false,
      cost: null,
      weight: null,
      damage: null,
      damageType: null,
      range: null,
      properties: [],
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      bonusWeapon: 3,
      description: "You have a +3 bonus to attack and damage rolls made with this magic weapon.",
    },
    {
      name: "Weapon of Warning",
      source: "DMG",
      type: "Melee or Ranged Weapon",
      itemCategory: "Weapon",
      rarity: "Uncommon",
      attunement: "requires attunement",
      cost: null,
      weight: null,
      damage: null,
      damageType: null,
      range: null,
      properties: [],
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      description:
        "This magic weapon warns you of danger. While the weapon is on your person, you have advantage on initiative rolls. In addition, you and any of your companions within 30 feet of you can't be surprised, except when incapacitated by something other than nonmagical sleep. The weapon magically awakens you and your companions within range if any of you are sleeping naturally when combat begins.",
    },
    {
      name: "Vicious Weapon",
      source: "DMG",
      type: "Melee or Ranged Weapon",
      itemCategory: "Weapon",
      rarity: "Rare",
      attunement: false,
      cost: null,
      weight: null,
      damage: null,
      damageType: null,
      range: null,
      properties: [],
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      description: "When you roll a 20 on your attack roll with this magic weapon, the target takes an extra 7 damage of the weapon's type.",
    },
    {
      name: "Armor, +1",
      source: "DMG",
      type: "Light, Medium, or Heavy Armor",
      itemCategory: "Armor",
      rarity: "Rare",
      attunement: false,
      cost: null,
      weight: null,
      damage: null,
      damageType: null,
      range: null,
      properties: [],
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      bonusAc: 1,
      description: "You have a +1 bonus to AC while wearing this armor.",
    },
    {
      name: "Armor, +2",
      source: "DMG",
      type: "Light, Medium, or Heavy Armor",
      itemCategory: "Armor",
      rarity: "Very Rare",
      attunement: false,
      cost: null,
      weight: null,
      damage: null,
      damageType: null,
      range: null,
      properties: [],
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      bonusAc: 2,
      description: "You have a +2 bonus to AC while wearing this armor.",
    },
    {
      name: "Armor, +3",
      source: "DMG",
      type: "Light, Medium, or Heavy Armor",
      itemCategory: "Armor",
      rarity: "Legendary",
      attunement: false,
      cost: null,
      weight: null,
      damage: null,
      damageType: null,
      range: null,
      properties: [],
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      bonusAc: 3,
      description: "You have a +3 bonus to AC while wearing this armor.",
    },
    {
      name: "Adamantine Armor",
      source: "DMG",
      type: "Medium or Heavy Armor",
      itemCategory: "Armor",
      rarity: "Uncommon",
      attunement: false,
      cost: null,
      weight: null,
      damage: null,
      damageType: null,
      range: null,
      properties: [],
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      description: "This suit of armor is reinforced with adamantine, one of the hardest substances in existence. While you're wearing it, any critical hit against you becomes a normal hit.",
    },
    {
      name: "Mithral Armor",
      source: "DMG",
      type: "Medium or Heavy Armor",
      itemCategory: "Armor",
      rarity: "Uncommon",
      attunement: false,
      cost: null,
      weight: null,
      damage: null,
      damageType: null,
      range: null,
      properties: [],
      ac: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
      description: "Mithral is a light, flexible metal. A mithral chain shirt or breastplate can be worn under normal clothes. If the armor normally imposes disadvantage on Dexterity (Stealth) checks or has a Strength requirement, the mithral version of the armor doesn't.",
    },
  ];

  results.push(...genericTemplates);

  return results;
}
