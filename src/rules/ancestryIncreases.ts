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
