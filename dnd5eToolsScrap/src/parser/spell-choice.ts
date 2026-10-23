import type { FeatureChoice, SubclassAdditionalSpells } from "../types/models.ts";

/**
 * Lifts a subclass's `additionalSpells` into the pick it grants, when they carry one. Three shapes
 * are a pick:
 *
 * - Named alternatives: two or more named entries, one per option (Circle of the Land biomes,
 *   Divine Soul affinities, Genie kinds). The description lists the spells the entry grants.
 * - Unnamed alternatives: two or more unnamed entries, each granting exactly one cantrip through
 *   `innate` (Path of the Giant). The option is the cantrip, with no description.
 * - A cantrip list: a subclass with no named entries whose `known` grants a `choose` filter
 *   (Nature, Death and Arcana domains). The pick is the filter, and its count when one is given.
 *   Only `known` filters count; `prepared` filters are not a cantrip choice. Two different filters
 *   name no single list, so they lift to nothing.
 *
 * Anything else, a single unnamed entry included, is not a pick and lifts to undefined. The raw
 * `additionalSpells` are left as they are; this only reads them.
 */
export function liftSpellChoice(
  additionalSpells: readonly SubclassAdditionalSpells[] | undefined
): FeatureChoice | undefined {
  if (!additionalSpells || additionalSpells.length === 0) return undefined;

  const named = additionalSpells.filter((entry) => Boolean(entry.name));
  if (named.length >= 2) {
    return {
      pick: 1,
      options: named.map((entry) => ({
        name: entry.name as string,
        description: grantedSpellNames(entry).map(titleCase).join(", "),
      })),
    };
  }

  if (named.length === 0) {
    if (additionalSpells.length >= 2) {
      const cantrips = additionalSpells.map(innateCantripName);
      if (cantrips.every((name): name is string => name !== undefined)) {
        return {
          pick: 1,
          options: cantrips.map((name) => ({ name: titleCase(name), description: "" })),
        };
      }
    }
    return cantripListChoice(additionalSpells);
  }

  return undefined;
}

/** The spell names a named entry grants through `prepared`, `known` and `expanded`, once each, in order. */
function grantedSpellNames(entry: SubclassAdditionalSpells): string[] {
  const names: string[] = [];
  for (const grants of [entry.prepared, entry.known, entry.expanded]) {
    for (const spells of Object.values(grants ?? {})) {
      // Filter objects (`choose`, `all`, `_`) are not spell names and are skipped.
      if (!Array.isArray(spells)) continue;
      for (const spell of spells) {
        if (typeof spell === "string" && !names.includes(spell)) names.push(spell);
      }
    }
  }
  return names;
}

/** The one cantrip an unnamed entry grants through `innate`, or undefined when it grants other than exactly one. */
function innateCantripName(entry: SubclassAdditionalSpells): string | undefined {
  const names = new Set<string>();
  for (const spells of Object.values(entry.innate ?? {})) {
    if (!Array.isArray(spells)) return undefined;
    for (const spell of spells) {
      if (typeof spell !== "string") return undefined;
      names.add(spell);
    }
  }
  return names.size === 1 ? [...names][0] : undefined;
}

/** A `known` choose filter at one spell level, with the count it grants when given. */
interface KnownFilterGrant {
  level: number;
  filter: string;
  count?: number;
}

/**
 * The cantrip-list pick the `known` entries name, or undefined when they name none or name two
 * different filters. The filter at the lowest level key is the one offered.
 */
function cantripListChoice(additionalSpells: readonly SubclassAdditionalSpells[]): FeatureChoice | undefined {
  const grants = additionalSpells.flatMap(knownFilterGrants);
  if (grants.length === 0) return undefined;
  if (new Set(grants.map((grant) => grant.filter)).size > 1) return undefined;

  const lowest = grants.reduce((first, grant) => (grant.level < first.level ? grant : first));
  if (lowest.count === undefined) return { pick: 1, from: { filter: lowest.filter } };
  return { pick: lowest.count, from: { filter: lowest.filter, count: lowest.count } };
}

/** The `choose` filters an entry's `known` grants at each numeric level, read from `_`. */
function knownFilterGrants(entry: SubclassAdditionalSpells): KnownFilterGrant[] {
  const grants: KnownFilterGrant[] = [];
  for (const [levelKey, byKey] of Object.entries(entry.known ?? {}) as [string, unknown][]) {
    const level = Number(levelKey);
    if (!Number.isInteger(level) || !isRecord(byKey) || !Array.isArray(byKey._)) continue;
    for (const item of byKey._ as unknown[]) {
      if (!isRecord(item) || typeof item.choose !== "string") continue;
      const count = typeof item.count === "number" ? item.count : undefined;
      grants.push(count === undefined ? { level, filter: item.choose } : { level, filter: item.choose, count });
    }
  }
  return grants;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Capitalises each space-separated word: "hold person" becomes "Hold Person". */
function titleCase(text: string): string {
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
