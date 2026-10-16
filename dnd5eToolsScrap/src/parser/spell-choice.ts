import type { FeatureChoice, SubclassAdditionalSpells } from "../types/models.ts";

/**
 * Lifts a subclass's `additionalSpells` into the pick it grants, when they carry one. Two shapes
 * are a pick:
 *
 * - Named alternatives: two or more named entries, one per option (Circle of the Land biomes,
 *   Divine Soul affinities, Genie kinds). The description lists the spells the entry grants.
 * - Unnamed alternatives: two or more unnamed entries, each granting exactly one cantrip through
 *   `innate` (Path of the Giant). The option is the cantrip, with no description.
 *
 * Anything else, a single entry included, is not a pick and lifts to undefined. The raw
 * `additionalSpells` are left as they are; this only reads them.
 */
export function liftSpellChoice(
  additionalSpells: readonly SubclassAdditionalSpells[] | undefined
): FeatureChoice | undefined {
  if (!additionalSpells || additionalSpells.length < 2) return undefined;

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
    const cantrips = additionalSpells.map(innateCantripName);
    if (cantrips.every((name): name is string => name !== undefined)) {
      return {
        pick: 1,
        options: cantrips.map((name) => ({ name: titleCase(name), description: "" })),
      };
    }
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

/** Capitalises each space-separated word: "hold person" becomes "Hold Person". */
function titleCase(text: string): string {
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
