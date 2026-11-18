import type { ActiveBooks } from "../constants/books.ts";
import { BACKGROUND_FEAT_SOURCE } from "../constants/rules.ts";
import type { AbilityKey, AsiSelection, Character } from "../types/character.ts";
import type { FeatData } from "../types/dnd5e.ts";
import type { Compendium } from "../services/compendium.ts";
import { ABILITY_NAMES } from "./abilities.ts";
import { withNotices } from "./needsReview.ts";

/**
 * The ability increase a feat grants, read from the Catalog alone. It sits below the Feat Slot module so the Character
 * Reconciler can release saved increases without importing the transitions that the module depends on (ADR 0023).
 */

/** The ability increase a feat grants: the fixed +1 its record states, the Increase Choice it states, or none. */
export interface FeatAbilityBonusOptions {
  type: "fixed" | "choice" | "none";
  abilities: AbilityKey[];
  amount: number;
}

const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

const NO_INCREASE: FeatAbilityBonusOptions = { type: "none", abilities: [], amount: 0 };

/**
 * The feat with this name, from the active books. A source narrows it to one record. Without a source it is found only when
 * exactly one active feat has the name. The Background marker names where a background granted the feat, not a book, so it
 * is found by name.
 */
export function findFeat(
  name: string,
  source: string | undefined,
  compendium: Compendium,
  activeBooks: ActiveBooks
): FeatData | null {
  const wanted = name.trim().toLowerCase();
  const bookSource = source === BACKGROUND_FEAT_SOURCE ? undefined : source;
  const matches = compendium
    .for(activeBooks)
    .feats()
    .filter((feat) => feat.name.trim().toLowerCase() === wanted && (!bookSource || feat.source === bookSource));
  if (bookSource) return matches[0] ?? null;
  return matches.length === 1 ? matches[0] : null;
}

/**
 * The increase a feat grants, read from the record alone. A record with an Increase Choice gives its choice; a record with one
 * fixed score gives that +1; a record with neither, or no record, gives none.
 */
export function featIncreaseOptions(feat: FeatData | null): FeatAbilityBonusOptions {
  if (!feat) return NO_INCREASE;
  const choice = feat.abilityScoreChoices?.[0];
  if (choice) return { type: "choice", abilities: [...choice.from], amount: choice.amount };
  const fixed = fixedAbilitiesOf(feat);
  if (fixed.length === 1) return { type: "fixed", abilities: fixed, amount: 1 };
  return NO_INCREASE;
}

function fixedAbilitiesOf(feat: FeatData): AbilityKey[] {
  const abilities: AbilityKey[] = [];
  for (const increase of feat.abilityScoreIncrease ?? []) {
    for (const key of Object.keys(increase)) {
      const ability = key.toLowerCase().slice(0, 3) as AbilityKey;
      if (ABILITY_KEYS.includes(ability) && !abilities.includes(ability)) abilities.push(ability);
    }
  }
  return abilities;
}

const RELEASED_INCREASE_NOTICE = (ability: AbilityKey, featName: string) =>
  `Ability increase to ${ABILITY_NAMES[ability]} removed from ${featName}: the feat no longer offers it`;

/**
 * Releases the saved feat increases that their feat's Increase Choice no longer offers, with a notice each. Only a feat found in
 * the active books that states an Increase Choice releases a pick, and only when the saved score is outside it: a stale catalog
 * releases nothing, and a feat with no Increase Choice, or a fixed increase, keeps its pick. A released pick loses its score and
 * its ASI entry, so the score drops by one. Deterministic, so a second pass changes nothing.
 */
export function releaseFeatIncreasesOutsidePool(character: Character, compendium: Compendium, activeBooks: ActiveBooks): Character {
  if (compendium.stale) return character;
  const notices: string[] = [];
  const releaseEntry = (entry: AsiSelection): AsiSelection => {
    if (entry.type !== "feat" || !entry.featName || !entry.featAbility) return entry;
    const increase = featIncreaseOptions(findFeat(entry.featName, entry.featSource, compendium, activeBooks));
    if (increase.type !== "choice" || increase.abilities.includes(entry.featAbility)) return entry;
    notices.push(RELEASED_INCREASE_NOTICE(entry.featAbility, entry.featName));
    const released = { ...entry };
    delete released.featAbility;
    delete released.asi;
    return released;
  };
  const asiSelections = character.asiSelections?.map(releaseEntry);
  const originFeats = character.originFeats?.map(releaseEntry);
  if (notices.length === 0) return character;
  return withNotices({ ...character, asiSelections, originFeats }, notices);
}
