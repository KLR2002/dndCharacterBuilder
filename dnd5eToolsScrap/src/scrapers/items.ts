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

  const combined = [...(baseData.baseitem || []), ...(itemData.item || [])];
  const resolved = resolveAllCopies(combined);

  const seen = new Set<string>();
  const items: ItemModel[] = [];

  for (const raw of resolved) {
    const key = `${raw.name.toLowerCase()}__${(raw.source || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rawType = raw.type || "";
    const type = ITEM_TYPE_MAP[rawType] || rawType || "Item";
    const itemCategory = getItemCategory(rawType, raw);

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
        properties.push(PROPERTY_MAP[p] || p);
      }
    }

    // Armor AC
    const ac = typeof raw.ac === "number" ? raw.ac : null;
    const strengthRequirement = typeof raw.strength === "number" ? raw.strength : null;
    const stealthDisadvantage = Boolean(raw.stealth);

    items.push({
      name: cleanTags(raw.name, "plain"),
      source: raw.source,
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
    });
  }

  return items;
}

function getItemCategory(typeCode: string, raw: any): string {
  if (typeCode === "M" || typeCode === "R") return "Weapon";
  if (typeCode === "LA" || typeCode === "MA" || typeCode === "HA" || typeCode === "S") return "Armor";
  if (typeCode === "P") return "Potion";
  if (typeCode === "SC") return "Scroll";
  if (typeCode === "RG") return "Ring";
  if (typeCode === "RD") return "Rod";
  if (typeCode === "ST") return "Staff";
  if (typeCode === "WD") return "Wand";
  if (typeCode === "W") return "Wondrous Item";
  if (typeCode === "T" || typeCode === "AT" || typeCode === "GS" || typeCode === "INS") return "Tool";
  if (typeCode === "G" || typeCode === "SCF" || typeCode === "A") return "Adventuring Gear";
  if (raw.wondrous) return "Wondrous Item";
  return "Item";
}

function formatValue(value: number): string {
  // Value in 5e.tools is in copper pieces (cp)
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
