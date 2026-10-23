import type { Character, InventoryItem, StartingEquipmentPicks } from "../types/character.ts";
import type {
  ClassData,
  ItemData,
  StartingEquipmentEntry,
  StartingEquipmentOption,
  StartingEquipmentSlot,
} from "../types/dnd5e.ts";
import { allCatalogClasses, catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { isProficientWithWeapon } from "./attacks.ts";
import { proficiencySheet, type ProficiencySheet } from "./proficiencySheet.ts";
import { STARTING_EQUIPMENT_TYPES } from "./startingEquipmentTypes.ts";
import {
  picksOfFirstClass,
  startingEquipmentEntryKey,
} from "./startingEquipmentPicks.ts";

export { pruneStartingEquipmentPicks, startingEquipmentEntryKey } from "./startingEquipmentPicks.ts";

/** Where one generic entry sits: its slot index, the option letter (null for a fixed slot) and its entry index. */
export interface StartingEquipmentAddress {
  slot: number;
  option: string | null;
  entry: number;
}

/** A choice slot, by slot index, with the option letters the character is offered for it now. */
export interface StartingEquipmentOffer {
  slot: number;
  options: string[];
}

/** A class's starting equipment as the claim sees it. `items` is the whole kit when `complete`, and empty otherwise. */
export interface StartingEquipmentKit {
  hasSlots: boolean;
  complete: boolean;
  items: InventoryItem[];
}

const WEAPON_TYPES = new Set(["Melee Weapon", "Ranged Weapon"]);

/** The Proficiency Sheet name each body armor and shield type needs. */
const ARMOR_PROFICIENCY: Record<string, string> = {
  "Light Armor": "Light armor",
  "Medium Armor": "Medium armor",
  "Heavy Armor": "Heavy armor",
  Shield: "Shields",
};

const isSimpleWeapon = (item: ItemData) => WEAPON_TYPES.has(item.type) && item.weaponCategory === "simple";
const isMartialWeapon = (item: ItemData) => WEAPON_TYPES.has(item.type) && item.weaponCategory === "martial";
const isFocus = (item: ItemData) => item.type === "Spellcasting Focus";

/** The Spellcasting Focus names each focus kind takes, by the 5e rules. */
const FOCUS_NAMES = {
  arcane: ["Crystal", "Orb", "Rod", "Staff", "Wand"],
  holy: ["Amulet", "Emblem", "Reliquary"],
  druidic: ["Sprig of Mistletoe", "Totem", "Wooden Staff", "Yew Wand"],
};

const isNamedFocus = (names: string[]) => (item: ItemData) =>
  isFocus(item) && names.some((name) => name.toLowerCase() === item.name.toLowerCase());

/**
 * The catalog items each generic type names. The catalog does not say which focus kind (arcane, holy, druidic) an
 * item serves, so each focus type takes the Spellcasting Focus items named for its kind in FOCUS_NAMES.
 */
const GENERIC_FILTERS: Record<string, (item: ItemData) => boolean> = {
  weaponSimple: isSimpleWeapon,
  weaponMartial: isMartialWeapon,
  weaponSimpleMelee: (item) => isSimpleWeapon(item) && item.type === "Melee Weapon",
  weaponMartialMelee: (item) => isMartialWeapon(item) && item.type === "Melee Weapon",
  instrumentMusical: (item) => item.type === "Instrument",
  focusSpellcastingArcane: isNamedFocus(FOCUS_NAMES.arcane),
  focusSpellcastingHoly: isNamedFocus(FOCUS_NAMES.holy),
  focusSpellcastingDruidic: isNamedFocus(FOCUS_NAMES.druidic),
};

/** The filter a generic type names, or undefined for a type the app does not know (see STARTING_EQUIPMENT_TYPES). */
function genericFilter(equipmentType: string): ((item: ItemData) => boolean) | undefined {
  return STARTING_EQUIPMENT_TYPES.has(equipmentType) ? GENERIC_FILTERS[equipmentType] : undefined;
}

/**
 * The class record the character's first class entry names. When the entry names a print, that print is used;
 * otherwise the first print of the class that carries slots.
 */
function heldClassData(character: Character, catalogs: CharacterCatalogs): ClassData | undefined {
  const first = character.classes[0];
  if (!first) return undefined;
  const prints = allCatalogClasses(catalogs).filter((c) => c.name === first.className);
  const source = (first.source ?? "").toLowerCase();
  return (
    prints.find((c) => source && c.source.toLowerCase() === source) ??
    prints.find((c) => (c.startingEquipment?.length ?? 0) > 0) ??
    prints[0]
  );
}

function slotsOf(character: Character, catalogs: CharacterCatalogs): StartingEquipmentSlot[] {
  return heldClassData(character, catalogs)?.startingEquipment ?? [];
}

/** The catalog item with this name, preferring the printed source. Name lookups are never scoped by active books. */
function catalogItem(name: string, source: string, catalogs: CharacterCatalogs): ItemData | undefined {
  const lower = name.toLowerCase();
  const named = catalogListings({ compendium: catalogs.compendium }).items().filter((i) => i.name.toLowerCase() === lower);
  return named.find((i) => i.source.toLowerCase() === source.toLowerCase()) ?? named[0];
}

/**
 * True when a sheet armor name is the needed name, or the needed name followed by a parenthesised restriction, as
 * the Druid's shield proficiency is printed: "Shields (druids will not wear armor or use shields made of metal)".
 */
const namesArmorProficiency = (sheetName: string, needed: string) =>
  sheetName === needed || sheetName.startsWith(`${needed} (`);

/**
 * Whether the character is proficient with a catalog item the option names. Weapons go through the existing
 * weapon matcher; the catalog's weapon category is passed as the description it reads when the standard table has
 * no entry for the weapon. Body armor and shields need the armor category on the sheet. Anything else is not gated.
 */
function proficientWith(item: ItemData, sheet: ProficiencySheet): boolean {
  if (WEAPON_TYPES.has(item.type)) {
    const category = item.weaponCategory ? (item.weaponCategory === "martial" ? "martial weapon" : "simple weapon") : item.description;
    const asItem: InventoryItem = {
      id: "",
      name: item.name,
      source: item.source,
      quantity: 1,
      isEquipped: false,
      section: "carried",
      description: category,
    };
    return isProficientWithWeapon(asItem, sheet.weapons.map((w) => w.name));
  }
  const needed = ARMOR_PROFICIENCY[item.type];
  return needed ? sheet.armor.some((a) => namesArmorProficiency(a.name, needed)) : true;
}

/** An option is offered when the character is proficient with every catalog armor and weapon it names. */
function optionOffered(option: StartingEquipmentOption, sheet: ProficiencySheet, catalogs: CharacterCatalogs): boolean {
  return option.entries.every((entry) => {
    if (entry.kind !== "item") return true;
    const item = catalogItem(entry.name, entry.source, catalogs);
    return !item || proficientWith(item, sheet);
  });
}

/** True when the first class has starting equipment slots, so the equipment claim applies. A class with none takes gold only. */
export function hasStartingEquipmentChoices(character: Character, catalogs: CharacterCatalogs = {}): boolean {
  return slotsOf(character, catalogs).length > 0;
}

/** The choice slots, by slot index, with the option letters offered to the character now. Fixed slots are not listed. */
export function startingEquipmentOffers(character: Character, catalogs: CharacterCatalogs = {}): StartingEquipmentOffer[] {
  const slots = slotsOf(character, catalogs);
  if (slots.length === 0) return [];
  const sheet = proficiencySheet(character, catalogs);
  return slots.flatMap((slot, index) =>
    slot.kind === "choice"
      ? [{ slot: index, options: slot.options.filter((o) => optionOffered(o, sheet, catalogs)).map((o) => o.letter) }]
      : [],
  );
}

/** The names a generic type can be resolved to: each catalog item of the type once, in the active books, sorted. */
export function startingEquipmentPool(equipmentType: string, catalogs: CharacterCatalogs = {}): string[] {
  const filter = genericFilter(equipmentType);
  if (!filter) return [];
  const names = new Map<string, string>();
  for (const item of catalogListings(catalogs).items()) {
    const key = item.name.toLowerCase();
    if (filter(item) && !names.has(key)) names.set(key, item.name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

function freshPicks(character: Character): StartingEquipmentPicks {
  const first = character.classes[0];
  return { className: first?.className ?? "", source: first?.source ?? "", options: {}, items: {} };
}

/**
 * Picks the option letter of a choice slot. Refused (the character returned unchanged) when the slot has no such
 * option or the option is not offered now. Changing the option drops the generic picks the slot held.
 */
export function setStartingEquipmentOption(
  character: Character,
  slot: number,
  letter: string,
  catalogs: CharacterCatalogs = {},
): Character {
  const target = slotsOf(character, catalogs)[slot];
  if (target?.kind !== "choice") return character;
  const offered = startingEquipmentOffers(character, catalogs).find((o) => o.slot === slot)?.options ?? [];
  if (!offered.includes(letter)) return character;

  const base = picksOfFirstClass(character) ?? freshPicks(character);
  const changed = base.options[String(slot)] !== letter;
  const items = changed
    ? Object.fromEntries(Object.entries(base.items).filter(([key]) => !key.startsWith(`${slot}.`)))
    : base.items;
  return {
    ...character,
    startingEquipmentPicks: { ...base, options: { ...base.options, [String(slot)]: letter }, items },
  };
}

/**
 * Picks the item names for a generic entry: one name per quantity, each in the entry's pool, the same name allowed
 * more than once. Refused when the address is not an entry the character has chosen, or a name is outside the pool.
 */
export function setStartingEquipmentItems(
  character: Character,
  address: StartingEquipmentAddress,
  names: string[],
  catalogs: CharacterCatalogs = {},
): Character {
  const slot = slotsOf(character, catalogs)[address.slot];
  if (!slot || slot.kind === "unrecognised") return character;
  let entries: StartingEquipmentEntry[];
  if (slot.kind === "fixed") {
    if (address.option !== null) return character;
    entries = slot.entries;
  } else {
    const option = slot.options.find((o) => o.letter === address.option);
    if (!option || picksOfFirstClass(character)?.options[String(address.slot)] !== option.letter) return character;
    entries = option.entries;
  }
  const entry = entries[address.entry];
  if (entry?.kind !== "type" || names.length > entry.quantity) return character;

  const pool = startingEquipmentPool(entry.equipmentType, catalogs);
  const canonical: string[] = [];
  for (const name of names) {
    const match = pool.find((p) => p.toLowerCase() === name.toLowerCase());
    if (!match) return character;
    canonical.push(match);
  }

  const base = picksOfFirstClass(character) ?? freshPicks(character);
  return {
    ...character,
    startingEquipmentPicks: { ...base, items: { ...base.items, [startingEquipmentEntryKey(address)]: canonical } },
  };
}

/** The catalog record a generic pick names, from the active books, so the pick resolves to the item the pool offered. */
function poolRecord(equipmentType: string, name: string, catalogs: CharacterCatalogs): ItemData | undefined {
  const filter = genericFilter(equipmentType);
  const lower = name.toLowerCase();
  return catalogListings(catalogs).items().find((i) => filter?.(i) && i.name.toLowerCase() === lower);
}

/**
 * The equip rule for one granted item. Melee weapons are equipped. Of the body armor and shields a kit grants, only
 * the first of each is equipped; the rest are carried. Ranged weapons, ammunition, packs, tools and foci are carried.
 */
function equipRule(record: ItemData | undefined, worn: { armor: boolean; shield: boolean }): boolean {
  if (!record) return false;
  if (record.type === "Shield") {
    if (worn.shield) return false;
    worn.shield = true;
    return true;
  }
  if (ARMOR_PROFICIENCY[record.type]) {
    if (worn.armor) return false;
    worn.armor = true;
    return true;
  }
  return record.type === "Melee Weapon";
}

interface Grant {
  name: string;
  source: string;
  quantity: number;
  record?: ItemData;
}

/**
 * The first class's starting equipment as the claim grants it. Every slot must be resolved: a choice slot needs an
 * offered option, and each generic entry in the taken entries needs its quantity of names. Incomplete picks give no
 * items. Fixed and picked entries become items with ids `start_<class>_<n>`, equipped by the equip rule.
 */
export function resolveStartingEquipment(character: Character, catalogs: CharacterCatalogs = {}): StartingEquipmentKit {
  const slots = slotsOf(character, catalogs);
  const incomplete: StartingEquipmentKit = { hasSlots: slots.length > 0, complete: false, items: [] };
  if (slots.length === 0) return incomplete;

  const picks = picksOfFirstClass(character);
  const sheet = proficiencySheet(character, catalogs);
  const grants: Grant[] = [];

  for (const [index, slot] of slots.entries()) {
    if (slot.kind === "unrecognised") return incomplete;
    let option: string | null = null;
    let entries: StartingEquipmentEntry[];
    if (slot.kind === "fixed") {
      entries = slot.entries;
    } else {
      const chosen = slot.options.find((o) => o.letter === picks?.options[String(index)]);
      if (!chosen || !optionOffered(chosen, sheet, catalogs)) return incomplete;
      option = chosen.letter;
      entries = chosen.entries;
    }

    for (const [entryIndex, entry] of entries.entries()) {
      if (entry.kind === "unrecognised") return incomplete;
      if (entry.kind === "item") {
        const record = catalogItem(entry.name, entry.source, catalogs);
        grants.push({ name: record?.name ?? entry.name, source: record?.source ?? entry.source, quantity: entry.quantity, record });
        continue;
      }
      const names = picks?.items[startingEquipmentEntryKey({ slot: index, option, entry: entryIndex })] ?? [];
      const pool = new Set(startingEquipmentPool(entry.equipmentType, catalogs).map((n) => n.toLowerCase()));
      if (names.length !== entry.quantity || !names.every((n) => pool.has(n.toLowerCase()))) return incomplete;
      for (const name of names) {
        const record = poolRecord(entry.equipmentType, name, catalogs);
        grants.push({ name: record?.name ?? name, source: record?.source ?? "", quantity: 1, record });
      }
    }
  }

  const className = character.classes[0].className;
  const worn = { armor: false, shield: false };
  const items = grants.map((grant, n): InventoryItem => {
    const record = grant.record;
    const isEquipped = equipRule(record, worn);
    return {
      id: `start_${className.toLowerCase()}_${n}`,
      name: grant.name,
      source: grant.source,
      quantity: grant.quantity,
      isEquipped,
      section: isEquipped ? "equipped" : "carried",
      weight: record?.weight ?? null,
      cost: record?.cost ?? null,
      damage: record?.damage ?? null,
      damageType: record?.damageType ?? null,
      range: record?.range ?? null,
      ac: record?.ac ?? null,
      description: record?.description ?? "",
    };
  });
  return { hasSlots: true, complete: true, items };
}
