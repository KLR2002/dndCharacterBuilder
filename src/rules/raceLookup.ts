import type { RaceData, SubraceData } from "../types/dnd5e.ts";

/** A race and subrace as a character holds them: the names and the books they were saved from. */
export interface HeldRace {
  name: string;
  source?: string;
  subraceName?: string;
  subraceSource?: string;
}

export interface ResolvedRace {
  race?: RaceData;
  subrace?: SubraceData;
}

/**
 * The race and subrace a held race resolves to within `races`. The record of the saved source comes first. Without one,
 * the record of an active book, then the first record in the given order. The subrace follows the same order within the
 * resolved race, and no subrace held means the plain form (the unnamed subrace, when the catalog lists one). Pass the
 * listings already scoped to the active books, and the books too, so both the scope and the order hold. The held
 * sources are read and never written.
 */
export function findHeldRace(
  races: readonly RaceData[],
  held: HeldRace | null | undefined,
  activeBooks?: readonly string[],
): ResolvedRace {
  if (!held) return { race: undefined, subrace: undefined };
  const race = pickRecord(races, held.name, held.source, activeBooks);
  const subrace = race ? pickRecord(race.subraces ?? [], held.subraceName ?? "", held.subraceSource, activeBooks) : undefined;
  return { race, subrace };
}

/**
 * Whether the catalog holds the race a character holds: the record of its saved source, or, when the catalog holds no record of
 * that source, a record of its name. The same rule decides whether a race's picks are checked against the catalog.
 */
export function heldRaceListed(held: { name: string; source: string } | null | undefined, races: readonly RaceData[]): boolean {
  if (!held) return false;
  if (races.some((race) => race.name === held.name && race.source === held.source)) return true;
  return !races.some((race) => race.source === held.source) && races.some((race) => race.name === held.name);
}

/**
 * The record a held name and saved source resolve to within `records`, by the rule findHeldRace follows: the record of the saved
 * source, then an active book's record, then the first record of the name. Used for every record kind a character saves with a
 * source (subclass, background, feat). The saved source is read and never written.
 */
export function findHeldRecord<T extends { name: string; source: string }>(
  records: readonly T[],
  held: { name: string; source?: string } | null | undefined,
  activeBooks?: readonly string[],
): T | undefined {
  if (!held) return undefined;
  return pickRecord(records, held.name, held.source, activeBooks);
}

/**
 * The source a held record's Rule Choice ids carry: the source it was saved under, else the record's own. A race saved on one
 * catalog keeps the ids it was saved with when another catalog resolves it, so its picks still apply.
 */
export function heldSourceOf(saved: string | undefined, record: { source: string }): string {
  return saved || record.source;
}

function pickRecord<T extends { name: string; source: string }>(
  records: readonly T[],
  name: string,
  source: string | undefined,
  activeBooks: readonly string[] | undefined,
): T | undefined {
  const named = records.filter((record) => record.name === name);
  const saved = source ? named.find((record) => record.source === source) : undefined;
  return saved ?? named.find((record) => activeBooks?.includes(record.source)) ?? named[0];
}
