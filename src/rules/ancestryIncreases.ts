import type { AbilityKey } from "../types/character.ts";
import type { AbilityScoreChoiceData, RaceData, SubraceData } from "../types/dnd5e.ts";

/** The ability increases a race record or subrace record states, read from its own `abilityScoreIncrease`. */
export interface IncreaseSource {
  abilityScoreIncrease?: Record<string, number>[];
}

export interface SubraceIncreaseSource extends IncreaseSource {
  /** Set when the subrace replaces its race's increases rather than adding to them. */
  replacesRaceAbilityScores?: true;
}

/**
 * One Fixed Increase the held race or subrace gives: the entry at `index` of its `abilityScoreIncrease`, for the ability `name`
 * (as the record writes it). `owner` says whether the race or the subrace states it.
 */
export interface FixedIncrease {
  owner: "race" | "subrace";
  index: number;
  name: string;
  amount: number;
}

function fixedIncreasesOf(owner: FixedIncrease["owner"], source: IncreaseSource | undefined): FixedIncrease[] {
  return (source?.abilityScoreIncrease ?? []).flatMap((entry, index) =>
    Object.entries(entry).flatMap(([name, amount]) => (typeof amount === "number" ? [{ owner, index, name, amount }] : [])),
  );
}

/**
 * The Fixed Increases of a held race and subrace. A subrace that replaces its race's increases gives only its own; otherwise
 * both apply. The only code that combines the two.
 */
export function heldFixedIncreases(race: IncreaseSource | undefined, subrace?: SubraceIncreaseSource): FixedIncrease[] {
  const raceIncreases = subrace?.replacesRaceAbilityScores ? [] : fixedIncreasesOf("race", race);
  return [...raceIncreases, ...fixedIncreasesOf("subrace", subrace)];
}

/** The held race's and subrace's Fixed Increases summed per ability, keyed as the record writes them, lowercased. */
export function heldFixedBonuses(race: IncreaseSource | undefined, subrace?: SubraceIncreaseSource): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const { name, amount } of heldFixedIncreases(race, subrace)) {
    const key = name.toLowerCase();
    bonuses[key] = (bonuses[key] ?? 0) + amount;
  }
  return bonuses;
}

/** An Increase Choice the held race or subrace states, with the id its picks are saved under (ADR 0019). */
export interface HeldIncreaseChoice extends AbilityScoreChoiceData {
  id: string;
}

/**
 * The Increase Choices of a held race and subrace. The id names the record that states the choice and its position in it, so
 * a saved pick keeps its choice whatever else changes. A subrace that replaces its race's increases offers only its own.
 */
export function heldIncreaseChoices(race: RaceData | undefined, subrace?: SubraceData): HeldIncreaseChoice[] {
  const raceOwned =
    race && !subrace?.replacesRaceAbilityScores
      ? (race.abilityScoreChoices ?? []).map((choice, index) => ({ ...choice, id: `choice|race|${race.name}|${race.source}|${index}` }))
      : [];
  const subraceOwned = subrace
    ? (subrace.abilityScoreChoices ?? []).map((choice, index) => ({
        ...choice,
        id: `choice|subrace|${subrace.raceName}|${subrace.raceSource}|${subrace.name}|${subrace.source}|${index}`,
      }))
    : [];
  return [...raceOwned, ...subraceOwned];
}

/** Whether the held race or subrace gives Flexible Increases: it has neither Fixed Increases nor an Increase Choice. */
export function heldFlexibleIncreases(race: RaceData | undefined, subrace?: SubraceData): boolean {
  return heldFixedIncreases(race, subrace).length === 0 && heldIncreaseChoices(race, subrace).length === 0;
}

const ABILITY_ORDER: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

function sameScores(a: readonly string[], b: readonly string[]): boolean {
  const set = new Set(a);
  return set.size === b.length && b.every((key) => set.has(key));
}

function scoreList(keys: readonly AbilityKey[]): string {
  const names = keys.map((key) => key.toUpperCase());
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

function choiceSummary(choice: AbilityScoreChoiceData, fixedKeys: string[]): string {
  const { from, count, amount } = choice;
  const others = ABILITY_ORDER.filter((key) => !fixedKeys.includes(key));
  if (sameScores(from, ABILITY_ORDER)) return `+${amount} to ${count} score${count > 1 ? "s" : ""}`;
  if (sameScores(from, others)) return `+${amount} to ${count} other${count > 1 ? "s" : ""}`;
  return count > 1 ? `+${amount} to ${count} of ${scoreList(from)}` : `+${amount} ${scoreList(from)}`;
}

/**
 * The one-line summary of the Increases a held race or subrace gives: its Fixed Increases summed per ability, then its
 * Increase Choices. A subrace that replaces its race's increases is summarized alone.
 */
export function increaseSummary(race: RaceData | undefined, subrace?: SubraceData): string {
  const bonuses = heldFixedBonuses(race, subrace);
  const fixedKeys = Object.keys(bonuses);
  const fixedParts = Object.entries(bonuses).map(([key, amount]) => `${key.toUpperCase()} +${amount}`);
  const choiceParts = heldIncreaseChoices(race, subrace).map((choice) => choiceSummary(choice, fixedKeys));
  return [...fixedParts, ...choiceParts].join(", ");
}
