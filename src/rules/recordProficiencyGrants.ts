import type { Character } from "../types/character.ts";
import type { BackgroundData, ProficiencyGrant, RaceData } from "../types/dnd5e.ts";
import { sourceToolAndLanguageGrants } from "./proficiencyPools.ts";

/**
 * The race, subrace and background a character holds, each with the tool and language grants its record
 * gives. A leaf module: the granted-features pass and the reconciler both read it, so it imports no
 * module that imports them back.
 */

/** A record-level grant source: the feature it is read as, and the owner it is keyed under. */
export interface RecordGrantSource {
  origin: "Race" | "Subrace" | "Background";
  name: string;
  source: string;
  /** The race for a subrace, the record's own name otherwise. */
  owner: string;
  grants: ProficiencyGrant[];
}

/** The record with this name, from this source when one is named and the name alone when it is not found there. Names match without case. */
function recordNamed<T extends { name: string; source: string }>(records: readonly T[], name: string, source?: string): T | undefined {
  const wanted = name.toLowerCase();
  const named = (r: T) => r.name.toLowerCase() === wanted;
  return records.find((r) => named(r) && (!source || r.source === source)) ?? records.find(named);
}

/**
 * The tool and language grant sources of the race, subrace and background the character holds, in that
 * order. A lineage replacement does not change them: the race is still the one chosen. A custom background
 * has no record.
 */
export function recordGrantSources(
  character: Character,
  catalog: { races: readonly RaceData[]; backgrounds: readonly BackgroundData[] },
): RecordGrantSource[] {
  const out: RecordGrantSource[] = [];
  if (character.race) {
    const race = recordNamed(catalog.races, character.race.name, character.race.source);
    const raceGrants = sourceToolAndLanguageGrants(race?.grants);
    if (race && raceGrants.length > 0) out.push({ origin: "Race", name: race.name, source: race.source, owner: race.name, grants: raceGrants });
    const subrace = race && character.race.subraceName
      ? recordNamed(race.subraces ?? [], character.race.subraceName, character.race.subraceSource)
      : undefined;
    const subraceGrants = sourceToolAndLanguageGrants(subrace?.grants);
    if (race && subrace && subraceGrants.length > 0) {
      out.push({ origin: "Subrace", name: subrace.name, source: subrace.source, owner: race.name, grants: subraceGrants });
    }
  }
  const background = character.background && !character.background.isCustom
    ? recordNamed(catalog.backgrounds, character.background.name, character.background.source)
    : undefined;
  const backgroundGrants = sourceToolAndLanguageGrants(background?.grants);
  if (background && backgroundGrants.length > 0) {
    out.push({ origin: "Background", name: background.name, source: background.source, owner: background.name, grants: backgroundGrants });
  }
  return out;
}
