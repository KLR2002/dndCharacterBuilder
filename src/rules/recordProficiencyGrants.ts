import type { Character } from "../types/character.ts";
import type { BackgroundData, ProficiencyGrant, RaceData, SubraceData } from "../types/dnd5e.ts";
import { sourceRecordGrants } from "./proficiencyPools.ts";
import { ruleChoiceId } from "./choices/types.ts";
import { isCustomBackground } from "./customBackground.ts";
import { findHeldRace, findHeldRecord } from "./raceLookup.ts";

/**
 * The race, subrace and background a character holds, each with the tool, language and skill grants its record
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

/** The trait a race gives its skill pick under, and that a descent may replace with one of its own options. */
const SKILL_VERSATILITY = "Skill Versatility";

/** Whether a grant is a skill choice, the only grant a descent's Skill Versatility gates. */
const isSkillChoice = (grant: ProficiencyGrant): boolean => grant.kind === "choice" && grant.category === "skills";

/** The descent's own Variant Feature option that takes the place of Skill Versatility, when the descent has one. */
function replacesSkillVersatility(subrace: SubraceData): boolean {
  return subrace.traits.some((trait) => trait.choice?.replaces === SKILL_VERSATILITY);
}

/** Whether the character's pick on a descent's Variant Feature choice is Skill Versatility. */
function descentPicksSkillVersatility(race: RaceData, subrace: SubraceData, character: Pick<Character, "ruleChoices">): boolean {
  const trait = subrace.traits.find((candidate) => candidate.choice?.replaces === SKILL_VERSATILITY);
  if (!trait) return false;
  const id = ruleChoiceId({ source: subrace.source, race: race.name, subrace: { name: subrace.name }, trait: trait.name });
  return (character.ruleChoices ?? []).find((rc) => rc.id === id)?.picked.includes(SKILL_VERSATILITY) ?? false;
}

/**
 * Whether a race's skill choice applies to the character. The Half-Elf's Skill Versatility is the race's own pick,
 * and a descent replaces it with one of its options. The pick applies to a Half-Elf with no descent, and to one
 * whose descent picked Skill Versatility and carries no skill choice of its own (the descent's pick is then the
 * one offered, so it is never offered twice). A Mark, which has no pick, does not get it. A race without the trait
 * is not gated.
 */
export function raceSkillPickApplies(
  race: RaceData,
  subrace: SubraceData | undefined,
  character: Pick<Character, "ruleChoices">,
  grant: ProficiencyGrant,
): boolean {
  if (!isSkillChoice(grant)) return true;
  if (!race.traits.some((trait) => trait.name === SKILL_VERSATILITY) || !subrace) return true;
  if (sourceRecordGrants(subrace.grants).some(isSkillChoice)) return false;
  return descentPicksSkillVersatility(race, subrace, character);
}

/**
 * Whether a descent's skill choice applies. A descent that replaces Skill Versatility carries its pick as a skill
 * choice, which applies only while its own Variant Feature pick is Skill Versatility. A descent with no such
 * replacement is not gated.
 */
export function subracePickApplies(
  race: RaceData,
  subrace: SubraceData,
  character: Pick<Character, "ruleChoices">,
  grant: ProficiencyGrant,
): boolean {
  if (!isSkillChoice(grant) || !replacesSkillVersatility(subrace)) return true;
  return descentPicksSkillVersatility(race, subrace, character);
}

/**
 * The subrace of a race the character holds, resolved by the shared lookup within `activeBooks` when given. The race
 * is `race` itself: the lookup is given it alone, so only its own subraces are read.
 */
export function heldSubraceOf(race: RaceData, character: Pick<Character, "race">, activeBooks?: readonly string[]): SubraceData | undefined {
  return findHeldRace([race], character.race, activeBooks).subrace;
}

/**
 * The tool, language and skill grant sources of the race, subrace and background the character holds, in that
 * order. A lineage replacement does not change them: the race is still the one chosen. A custom background
 * has no record. The records resolve by the shared record lookup, scoped to `activeBooks` when given.
 */
export function recordGrantSources(
  character: Character,
  catalog: { races: readonly RaceData[]; backgrounds: readonly BackgroundData[]; activeBooks?: readonly string[] },
): RecordGrantSource[] {
  const out: RecordGrantSource[] = [];
  if (character.race) {
    const { race, subrace } = findHeldRace(catalog.races, character.race, catalog.activeBooks);
    const raceGrants = race
      ? sourceRecordGrants(race.grants).filter((grant) => raceSkillPickApplies(race, subrace, character, grant))
      : [];
    if (race && raceGrants.length > 0) out.push({ origin: "Race", name: race.name, source: race.source, owner: race.name, grants: raceGrants });
    const subraceGrants = race && subrace ? sourceRecordGrants(subrace.grants).filter((grant) => subracePickApplies(race, subrace, character, grant)) : [];
    if (race && subrace && subraceGrants.length > 0) {
      out.push({ origin: "Subrace", name: subrace.name, source: subrace.source, owner: race.name, grants: subraceGrants });
    }
  }
  const background = character.background && !isCustomBackground(character.background)
    ? findHeldRecord(catalog.backgrounds, character.background, catalog.activeBooks)
    : undefined;
  const backgroundGrants = sourceRecordGrants(background?.grants);
  if (background && backgroundGrants.length > 0) {
    out.push({ origin: "Background", name: background.name, source: background.source, owner: background.name, grants: backgroundGrants });
  }
  return out;
}
