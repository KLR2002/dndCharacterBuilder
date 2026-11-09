import { isNatural20, type D20Mode, type Roll } from "./dice.ts";

/**
 * One entry of the session Roll Log: a completed Roll from `src/rules/dice.ts` with where it came
 * from. The log lives in app state only; entries are never stored on a Character.
 */
export interface RollLogEntry {
  id: number;
  /** Absent for dice-tray rolls. */
  characterName?: string;
  source: string;
  roll: Roll;
  d20Mode: D20Mode;
  critical: boolean;
  /** Epoch milliseconds when the Roll was made. */
  time: number;
  /** An optional follow-up shown as its own button on the result card ("Roll damage" after an attack). */
  followUp?: RollFollowUp;
}

/** A follow-up action on the result card: a label and what it does. */
export interface RollFollowUp {
  label: string;
  onPress: () => void;
}

/** What `makeRollLogEntry` needs: a completed Roll plus its source; the rest default. */
export interface RollLogEntryInput {
  roll: Roll;
  source: string;
  characterName?: string;
  d20Mode?: D20Mode;
  critical?: boolean;
  followUp?: RollFollowUp;
}

/** Builds one log entry. The caller assigns the id (ascending) and the time. */
export function makeRollLogEntry(input: RollLogEntryInput, id: number, time: number): RollLogEntry {
  return {
    id,
    characterName: input.characterName,
    source: input.source,
    roll: input.roll,
    d20Mode: input.d20Mode ?? "none",
    critical: input.critical ?? false,
    time,
    followUp: input.followUp,
  };
}

/** The entry's heading: "Kara · Longsword attack", or just the source ("Dice tray") without a character. */
export function entryHeading(entry: Pick<RollLogEntry, "characterName" | "source">): string {
  return entry.characterName ? `${entry.characterName} · ${entry.source}` : entry.source;
}

export type RollMarker = "natural20" | "natural1" | "critical";

/** The markers a Roll shows on its result: a kept d20's natural 20 or 1, and Critical on critical damage. */
export function rollMarkers(entry: Pick<RollLogEntry, "roll" | "critical">): RollMarker[] {
  const markers: RollMarker[] = [];
  if (isNatural20(entry.roll)) markers.push("natural20");
  if (entry.roll.dice.some((die) => die.sides === 20 && !die.dropped && die.face === 1)) markers.push("natural1");
  if (entry.critical) markers.push("critical");
  return markers;
}

/** The entry's time as a 24-hour HH:MM:SS clock. */
export function formatRollTime(time: number): string {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** One dice term of the tray's pool, like 2d6. */
export interface PoolTerm {
  count: number;
  sides: number;
}

/** The die buttons of the tray, in row order. */
export const DIE_SIZES: readonly number[] = [4, 6, 8, 10, 12, 20, 100];

/** Adds one die of `sides` to the pool, merging with an existing term of the same sides. */
export function addDieToPool(terms: readonly PoolTerm[], sides: number): PoolTerm[] {
  const existing = terms.find((term) => term.sides === sides);
  if (existing) return terms.map((term) => (term.sides === sides ? { ...term, count: term.count + 1 } : term));
  return [...terms, { count: 1, sides }];
}

/** Removes the whole term of `sides` from the pool (one chip of the expression line). */
export function removePoolTerm(terms: readonly PoolTerm[], sides: number): PoolTerm[] {
  return terms.filter((term) => term.sides !== sides);
}

/** Whether the pool is exactly one d20, the only pool the Disadvantage / Normal / Advantage choice applies to. */
export function isSingleD20(terms: readonly PoolTerm[]): boolean {
  return terms.length === 1 && terms[0].count === 1 && terms[0].sides === 20;
}

/** The pool as `parseDicePool` reads it, like "2d6+1d8+3" or "1d20-2". */
export function poolExpression(terms: readonly PoolTerm[], modifier: number): string {
  let text = terms.map((term) => `${term.count}d${term.sides}`).join("+");
  if (modifier > 0) text += `+${modifier}`;
  else if (modifier < 0) text += `${modifier}`;
  return text;
}

/** The pool the way the tray writes it, like "2d6 + 1d8 + 3" or "1d20 − 2". */
export function poolLabel(terms: readonly PoolTerm[], modifier: number): string {
  let text = terms.map((term) => `${term.count}d${term.sides}`).join(" + ");
  if (modifier > 0) text += ` + ${modifier}`;
  else if (modifier < 0) text += ` − ${-modifier}`;
  return text;
}
