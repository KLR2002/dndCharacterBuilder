import type { Character, InventoryItem } from "../types/character.ts";
import type { ItemData } from "../types/dnd5e.ts";
import { armorCategoryOfType } from "./ac.ts";

export const ATTUNEMENT_LIMIT = 3;

export type Coin = "cp" | "sp" | "ep" | "gp" | "pp";

export type AttunementResult = { character: Character } | { swapNeeded: true };

/** A catalog item record as the library lists it. The legacy keys are read when a record still carries them. */
export type CatalogItemRecord = Pick<ItemData, "name"> &
  Partial<Omit<ItemData, "name">> & { value?: string | null; dmg1?: string | null; dmgType?: string | null };

/** The custom item form's fields, as typed. Numbers are parsed here, not in the form. */
export interface CustomItemFields {
  name: string;
  weight: string;
  cost: string;
  damage: string;
  ac: string;
  bonusWeapon: string;
  bonusAc: string;
  description: string;
  equipped: boolean;
}

function makeItemId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function withItems(character: Character, items: InventoryItem[]): Character {
  return { ...character, items };
}

function updateItem(character: Character, itemId: string, change: Partial<InventoryItem>): Character {
  return withItems(
    character,
    character.items.map((i) => (i.id === itemId ? { ...i, ...change } : i)),
  );
}

function attunedCount(character: Character): number {
  return character.items.filter((i) => Boolean(i.attunement) && i.isAttuned === true).length;
}

export function toggleEquipped(character: Character, itemId: string): Character {
  const item = character.items.find((i) => i.id === itemId);
  if (!item) return character;
  return updateItem(character, itemId, { isEquipped: !item.isEquipped });
}

/** Adds one to the quantity, or takes one away; an item that would reach zero leaves the list. */
export function changeItemQuantity(character: Character, itemId: string, delta: number): Character {
  return withItems(
    character,
    character.items
      .map((i) => {
        if (i.id !== itemId) return i;
        const quantity = i.quantity + delta;
        return quantity > 0 ? { ...i, quantity } : null;
      })
      .filter((i): i is InventoryItem => i !== null),
  );
}

export function removeItem(character: Character, itemId: string): Character {
  return withItems(character, character.items.filter((i) => i.id !== itemId));
}

export function addItem(character: Character, item: InventoryItem): Character {
  return withItems(character, [...character.items, item]);
}

/**
 * Unattunes an attuned item. Attunes the item otherwise, unless the limit is reached: then the caller must
 * choose an attuned item to give up, through swapAttunement.
 */
export function toggleAttunement(character: Character, itemId: string): AttunementResult {
  const item = character.items.find((i) => i.id === itemId);
  if (!item) return { character };
  if (item.isAttuned) return { character: updateItem(character, itemId, { isAttuned: false }) };
  if (attunedCount(character) >= ATTUNEMENT_LIMIT) return { swapNeeded: true };
  return { character: updateItem(character, itemId, { isAttuned: true }) };
}

/** Gives up attunement to one item and takes it for another, in one change. */
export function swapAttunement(character: Character, unattuneId: string, attuneId: string): Character {
  return withItems(
    character,
    character.items.map((i) => {
      if (i.id === unattuneId) return { ...i, isAttuned: false };
      if (i.id === attuneId) return { ...i, isAttuned: true };
      return i;
    }),
  );
}

function pouchOf(character: Character): Character["pouch"] {
  return character.pouch || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
}

/** Adds to a coin or takes from it; a coin never goes below zero. */
export function changeCoin(character: Character, coin: Coin, delta: number): Character {
  const pouch = pouchOf(character);
  return { ...character, pouch: { ...pouch, [coin]: Math.max(0, (pouch[coin] || 0) + delta) } };
}

/** Sets a coin from typed text. Text that is not a whole number sets zero. */
export function setCoin(character: Character, coin: Coin, text: string): Character {
  const value = parseInt(text, 10);
  return { ...character, pouch: { ...pouchOf(character), [coin]: isNaN(value) ? 0 : Math.max(0, value) } };
}

/** An item taken from the catalog, with its rarity, attunement and armor class as the record gives them. */
export function itemFromCatalog(record: CatalogItemRecord): InventoryItem {
  return {
    id: makeItemId("item"),
    name: record.name,
    source: record.source || "PHB",
    quantity: 1,
    isEquipped: false,
    weight: record.weight ?? null,
    cost: record.cost || record.value || null,
    damage: record.damage || record.dmg1 || null,
    damageType: record.damageType || record.dmgType || null,
    range: record.range || null,
    ac: record.ac ?? null,
    rarity: record.rarity || "None",
    attunement: record.attunement || false,
    isAttuned: false,
    bonusWeapon: record.bonusWeapon ?? undefined,
    bonusAc: record.bonusAc ?? undefined,
    itemCategory: record.itemCategory || undefined,
    armorCategory: armorCategoryOfType(record.type),
    description: record.description || (Array.isArray(record.rawEntries) ? record.rawEntries.join("\n") : "") || "",
  };
}

/**
 * An item the player typed in. A "+N" in the name gives a weapon bonus when a damage is set and an AC bonus
 * when an armor class is set, unless the bonus fields say otherwise.
 */
export function customItem(fields: CustomItemFields): InventoryItem {
  const name = fields.name.trim();
  const nameBonus = (() => {
    const m = name.match(/\+(\d+)/);
    return m ? parseInt(m[1], 10) : undefined;
  })();
  const bonusWeapon = fields.bonusWeapon.trim()
    ? parseInt(fields.bonusWeapon, 10)
    : fields.damage.trim() ? nameBonus : undefined;
  const bonusAc = fields.bonusAc.trim()
    ? parseInt(fields.bonusAc, 10)
    : fields.ac.trim() ? nameBonus : undefined;

  return {
    id: makeItemId("custom"),
    name,
    source: "Custom",
    quantity: 1,
    isEquipped: fields.equipped,
    weight: fields.weight ? parseFloat(fields.weight) : null,
    cost: fields.cost.trim() || null,
    damage: fields.damage.trim() || null,
    ac: fields.ac ? parseInt(fields.ac, 10) : null,
    description: fields.description.trim() || "",
    isCustom: true,
    bonusWeapon,
    bonusAc,
  };
}
