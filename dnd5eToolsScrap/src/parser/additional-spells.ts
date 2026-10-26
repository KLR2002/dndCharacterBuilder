import { cleanTags } from "./tag-cleaner.ts";
import type { AdditionalSpells } from "../types/models.ts";

/**
 * Reads the structured spell grants of a subclass, feat, race or background (5e.tools `additionalSpells`) into the shape the
 * app reads. Spell names are normalised: the `#c` and `|source` suffixes are dropped, and a `choose` filter is kept as the
 * source gives it, for the player's pick to read. Nothing is resolved against the catalog here.
 */

function cleanSpellNameString(str: string): string {
  if (typeof str !== "string") return str;
  if (str.includes("=")) return str.trim();
  let s = cleanTags(str, "plain").trim();
  if (s.includes("#")) s = s.split("#")[0].trim();
  if (s.includes("|")) s = s.split("|")[0].trim();
  return s;
}

function cleanSpellVal(val: any): any {
  if (Array.isArray(val)) {
    return val.map((item) => cleanSpellVal(item));
  }
  if (val && typeof val === "object") {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = cleanSpellVal(v);
    }
    return res;
  }
  if (typeof val === "string") {
    return cleanSpellNameString(val);
  }
  return val;
}

/** The spell grants of one raw `additionalSpells` array, or undefined when it is absent or empty. */
export function parseAdditionalSpells(rawAdditionalSpells: any): AdditionalSpells[] | undefined {
  if (!Array.isArray(rawAdditionalSpells) || rawAdditionalSpells.length === 0) return undefined;
  return rawAdditionalSpells.map((entry) => {
    const res: AdditionalSpells = {};
    if (entry.name) res.name = cleanTags(entry.name, "plain");
    if (entry.ability !== undefined) res.ability = cleanSpellVal(entry.ability);
    for (const cat of ["prepared", "known", "expanded", "innate"] as const) {
      if (entry[cat]) {
        res[cat] = cleanSpellVal(entry[cat]);
      }
    }
    return res;
  });
}
