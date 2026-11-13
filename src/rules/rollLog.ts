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
  /** The Roll's own text (such as "a(d20,d20)+5") that replaces the source in the heading. */
  label?: string;
  roll: Roll;
  d20Mode: D20Mode;
  critical: boolean;
  /** Epoch milliseconds when the Roll was made. */
  time: number;
  /** An optional follow-up shown as its own button on the result card ("Roll damage" after an attack). */
  followUp?: RollFollowUp;
  /** The id shared by the Rolls published together; a single Roll is a batch of one. */
  batchId: number;
  /** This Roll's position in its batch, from 0. */
  batchIndex: number;
  /** How many Rolls the batch holds. */
  batchSize: number;
}

/** Where a Roll sits in the batch it was published with. */
export interface RollBatchPosition {
  batchId: number;
  batchIndex: number;
  batchSize: number;
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
  label?: string;
}

/**
 * Builds one log entry. The caller assigns the id (ascending) and the time. `batch` defaults to a
 * batch of one under the entry's own id.
 */
export function makeRollLogEntry(input: RollLogEntryInput, id: number, time: number, batch?: RollBatchPosition): RollLogEntry {
  const position = batch ?? { batchId: id, batchIndex: 0, batchSize: 1 };
  return {
    id,
    characterName: input.characterName,
    source: input.source,
    label: input.label,
    roll: input.roll,
    d20Mode: input.d20Mode ?? "none",
    critical: input.critical ?? false,
    time,
    followUp: input.followUp,
    batchId: position.batchId,
    batchIndex: position.batchIndex,
    batchSize: position.batchSize,
  };
}

/**
 * The entry's heading: "Kara · Longsword attack", or just the source ("Dice tray") without a character.
 * A label replaces the source, keeping the character prefix.
 */
export function entryHeading(entry: Pick<RollLogEntry, "characterName" | "source" | "label">): string {
  const what = entry.label ?? entry.source;
  return entry.characterName ? `${entry.characterName} · ${what}` : what;
}

export type RollMarker = "natural20" | "natural1" | "critical";

/**
 * Whether a Roll is a d20 test: only d20s were rolled and exactly one is kept — a badge's d20 roll
 * (plain, or with advantage/disadvantage where the other die is dropped) or a lone-d20 tray roll.
 * A tray pool of several d20s is not a d20 test.
 */
export function isD20Test(roll: Pick<Roll, "dice">): boolean {
  return (
    roll.dice.length > 0 &&
    roll.dice.every((die) => die.sides === 20) &&
    roll.dice.filter((die) => !die.dropped).length === 1
  );
}

/** The markers a Roll shows on its result: Natural 20 / Natural 1 on a d20 test's kept die, and Critical on critical damage. */
export function rollMarkers(entry: Pick<RollLogEntry, "roll" | "critical">): RollMarker[] {
  const markers: RollMarker[] = [];
  if (isD20Test(entry.roll)) {
    if (isNatural20(entry.roll)) markers.push("natural20");
    if (entry.roll.dice.some((die) => die.sides === 20 && !die.dropped && die.face === 1)) markers.push("natural1");
  }
  if (entry.critical) markers.push("critical");
  return markers;
}

/** The entry's time as a 24-hour HH:MM:SS clock. */
export function formatRollTime(time: number): string {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** The die buttons of the tray, in row order. */
export const DIE_SIZES: readonly number[] = [4, 6, 8, 10, 12, 20, 100];
