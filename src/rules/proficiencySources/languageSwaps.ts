import type { ProficiencyGrant } from "../../types/dnd5e.ts";
import type { FeatureInstance } from "../types.ts";
import { ALL_LANGUAGE_NAMES } from "../proficienciesAndLanguages.ts";
import { normalizeLanguageName, type ChoiceProficiencyGrant } from "../proficiencyPools.ts";
import { SWAP_MARK, swapId } from "./swapIds.ts";

/** One fixed language of a held race or subrace that a swap may replace. */
export interface LanguageSwapSlot {
  id: string;
  /** The feature the fixed language is printed on. */
  feature: string;
  original: string;
  /** The SRD languages the swap may take. Held languages and the replacements of earlier swaps are left out. */
  pool: string[];
  /** The replacement picked, when it is in the pool. Undefined otherwise. */
  replacement?: string;
}

const lower = (text: string) => text.trim().toLowerCase();

/**
 * The swap slots of the Race and Subrace features, one per distinct language, in feature order. A language that several
 * grants name (a subrace repeating its race's languages) has one slot, whose id uses the first grant that names it.
 * `held` is every language the character holds from the features as they are before any swap. A slot's pool leaves out
 * `held` and the replacements of earlier valid swaps, so when two swaps pick the same language the earlier one keeps it.
 * Without `available` no pick is in effect.
 */
export function languageSwapSlots(
  features: readonly FeatureInstance[],
  held: readonly string[],
  picks: Record<string, string[]> | undefined,
  available: boolean,
): LanguageSwapSlot[] {
  const heldKeys = new Set(held.map(lower));
  const taken = new Set<string>();
  const seen = new Set<string>();
  const slots: LanguageSwapSlot[] = [];
  for (const feature of features) {
    if (feature.origin !== "Race" && feature.origin !== "Subrace") continue;
    for (const grant of feature.grants ?? []) {
      if (grant.kind !== "fixed" || grant.category !== "languages") continue;
      for (const raw of grant.names) {
        const original = normalizeLanguageName(raw);
        if (seen.has(lower(original))) continue;
        seen.add(lower(original));
        const id = swapId(grant.id, original);
        const pool = ALL_LANGUAGE_NAMES.filter((name) => !heldKeys.has(lower(name)) && !taken.has(lower(name)));
        const pick = picks?.[id]?.[0];
        const replacement = available && pick !== undefined ? pool.find((name) => lower(name) === lower(pick)) : undefined;
        if (replacement !== undefined) taken.add(lower(replacement));
        slots.push({ id, feature: feature.name, original, pool, replacement });
      }
    }
  }
  return slots;
}

/**
 * The features with each applied swap in effect. Its original leaves every Race and Subrace fixed grant that names it, and
 * the swap's own Proficiency Choice is added beside the grant its id carries, over the swap's pool. Other features keep
 * their grants, so a background that names the same language still grants it.
 */
export function withLanguageSwaps(features: readonly FeatureInstance[], slots: readonly LanguageSwapSlot[]): FeatureInstance[] {
  if (slots.length === 0) return [...features];
  const replaced = new Set(slots.filter((slot) => slot.replacement !== undefined).map((slot) => lower(slot.original)));
  return features.map((feature) => {
    if (!feature.grants?.length) return feature;
    const isRaceSource = feature.origin === "Race" || feature.origin === "Subrace";
    const grants = feature.grants.flatMap((grant): ProficiencyGrant[] => {
      if (grant.kind !== "fixed" || grant.category !== "languages") return [grant];
      const names = isRaceSource ? grant.names.filter((name) => !replaced.has(lower(normalizeLanguageName(name)))) : grant.names;
      const choices: ChoiceProficiencyGrant[] = slots
        .filter((slot) => slot.id.startsWith(`${grant.id}${SWAP_MARK}`))
        .map((slot) => ({
          id: slot.id,
          kind: "choice",
          category: "languages",
          count: 1,
          pool: { kind: "names", names: slot.pool },
        }));
      if (names.length === grant.names.length && choices.length === 0) return [grant];
      return [...(names.length > 0 ? [{ ...grant, names }] : []), ...choices];
    });
    return { ...feature, grants };
  });
}
