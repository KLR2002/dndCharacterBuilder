import type {
  StartingEquipmentEntry,
  StartingEquipmentSlot,
} from "../types/startingEquipment.ts";

/**
 * Turns a class record's `startingEquipment` into slots. The record's `defaultData` is a list of slots, each either
 * `{ "_": [...] }` (granted whole) or `{ "a": [...], "b": [...] }` (the player takes one option, with two or more
 * letters). An entry is a `"name|source"` string, `{ "item": "name|source", "quantity": n }`, or
 * `{ "equipmentType": "weaponMartial", "quantity": n }`. A missing source is the PHB and a missing quantity is one.
 *
 * Nothing is dropped. A slot or entry of any other shape is kept in place as `unrecognised`, with its raw value, and
 * its line is listed in `unrecognised` so the scrape can report it. The 2024 kit form, whose options are keyed `A` to
 * `C` with `value` entries, is not read: its record gets no slots.
 */

/** What the parser read from one class record. */
export interface ParsedStartingEquipment {
  /** The slots in printed order, unrecognised ones included in place. Empty when the record has none. */
  slots: StartingEquipmentSlot[];
  /** One line per entry or slot the parser did not recognise. */
  unrecognised: string[];
}

/** An unrecognised entry or slot, named by the class that carries it. */
export interface StartingEquipmentIssue {
  owner: string;
  message: string;
}

/** The starting equipment problems a scrape collects, logged once the scrape has run. */
export interface StartingEquipmentReport {
  unrecognised: StartingEquipmentIssue[];
}

export function newStartingEquipmentReport(): StartingEquipmentReport {
  return { unrecognised: [] };
}

const DEFAULT_SOURCE = "PHB";
const FIXED_KEY = "_";
const OPTION_KEY = /^[a-z]$/;
const PRINTED_2024_KEY = /^[A-Z]$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}

export function parseStartingEquipment(raw: unknown): ParsedStartingEquipment {
  const result: ParsedStartingEquipment = { slots: [], unrecognised: [] };
  if (raw === undefined) return result;

  if (!isRecord(raw) || !Array.isArray(raw.defaultData)) {
    result.unrecognised.push(`no defaultData list in ${describe(raw)}`);
    return result;
  }

  const defaultData = raw.defaultData as unknown[];
  const isPrinted2024 = defaultData.some((slot) => isRecord(slot) && Object.keys(slot).some((key) => PRINTED_2024_KEY.test(key)));
  if (isPrinted2024) return result;

  defaultData.forEach((slot, index) => {
    result.slots.push(parseSlot(slot, index, result.unrecognised));
  });
  return result;
}

function parseSlot(slot: unknown, index: number, issues: string[]): StartingEquipmentSlot {
  const where = `slot ${index}`;
  if (!isRecord(slot)) return unrecognisedSlot(slot, `${where} is not an object`, issues);

  const keys = Object.keys(slot);
  if (keys.length === 1 && keys[0] === FIXED_KEY && Array.isArray(slot[FIXED_KEY])) {
    return { kind: "fixed", entries: parseEntries(slot[FIXED_KEY] as unknown[], where, issues) };
  }

  const isChoice = keys.length >= 2 && keys.every((key) => OPTION_KEY.test(key) && Array.isArray(slot[key]));
  if (isChoice) {
    return {
      kind: "choice",
      options: keys.map((letter) => ({
        letter,
        entries: parseEntries(slot[letter] as unknown[], `${where} option ${letter}`, issues),
      })),
    };
  }

  const shape = keys.length > 0 ? keys.join(", ") : "no keys";
  return unrecognisedSlot(slot, `${where} has ${shape}, which is neither a fixed slot nor a choice`, issues);
}

function unrecognisedSlot(raw: unknown, message: string, issues: string[]): StartingEquipmentSlot {
  issues.push(message);
  return { kind: "unrecognised", raw };
}

function parseEntries(list: unknown[], where: string, issues: string[]): StartingEquipmentEntry[] {
  return list.map((entry) => parseEntry(entry, where, issues));
}

function parseEntry(entry: unknown, where: string, issues: string[]): StartingEquipmentEntry {
  if (typeof entry === "string") {
    const item = parseItemName(entry);
    if (item) return { kind: "item", ...item, quantity: 1 };
  } else if (isRecord(entry)) {
    if (typeof entry.item === "string" && hasOnlyKeys(entry, ["item", "quantity"])) {
      const item = parseItemName(entry.item);
      const quantity = parseQuantity(entry.quantity);
      if (item && quantity !== undefined) return { kind: "item", ...item, quantity };
    } else if (typeof entry.equipmentType === "string" && hasOnlyKeys(entry, ["equipmentType", "quantity"])) {
      const quantity = parseQuantity(entry.quantity);
      const equipmentType = entry.equipmentType.trim();
      if (equipmentType && quantity !== undefined) return { kind: "type", equipmentType, quantity };
    }
  }

  issues.push(`${where}: ${describe(entry)} is not an item or a generic type`);
  return { kind: "unrecognised", raw: entry };
}

/** The name and source of a `"name|source"` reference. A reference with a third part is not one this reads. */
function parseItemName(text: string): { name: string; source: string } | undefined {
  const parts = text.split("|");
  const name = parts[0].trim();
  if (!name || parts.length > 2) return undefined;
  return { name, source: parts[1]?.trim() || DEFAULT_SOURCE };
}

/** A quantity is a whole number of one or more; a missing one is one. Anything else is not read. */
function parseQuantity(value: unknown): number | undefined {
  if (value === undefined) return 1;
  return Number.isInteger(value) && (value as number) >= 1 ? (value as number) : undefined;
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(record).every((key) => allowed.includes(key));
}
