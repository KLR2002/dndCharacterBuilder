import type { ClassData, ClassFeatureData, FeatureChoice, SubclassData } from "../src/types/dnd5e.ts";

/** The SRD archetypes per class. A subclass is kept when its name contains one of them. */
export const SRD_ARCHETYPES: Record<string, string[]> = {
  Barbarian: ["Berserker", "Path of the Berserker"],
  Bard: ["Lore", "College of Lore"],
  Cleric: ["Life", "Life Domain"],
  Druid: ["Land", "Circle of the Land"],
  Fighter: ["Champion"],
  Monk: ["Open Hand", "Way of the Open Hand"],
  Paladin: ["Devotion", "Oath of Devotion"],
  Ranger: ["Hunter"],
  Rogue: ["Thief"],
  Sorcerer: ["Draconic", "Draconic Bloodline"],
  Warlock: ["Fiend", "The Fiend"],
  Wizard: ["Evocation", "School of Evocation"],
};

/** Every option of a pick is an SRD option: the SRD names the book that prints it. */
function sourcedChoice(choice: FeatureChoice): FeatureChoice {
  if (!choice.options) return choice;
  return { ...choice, options: choice.options.map((option) => ({ ...option, source: "SRD" })) };
}

function srdFeature(feature: ClassFeatureData): ClassFeatureData {
  return feature.choices ? { ...feature, choices: sourcedChoice(feature.choices) } : feature;
}

function srdSubclass(subclass: SubclassData): SubclassData {
  const srd: SubclassData = {
    ...subclass,
    source: "SRD",
    features: subclass.features.map(srdFeature),
  };
  if (subclass.spellChoice) srd.spellChoice = sourcedChoice(subclass.spellChoice);
  return srd;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A rewrite of every old name in a string, matched case-insensitively and only as a whole name. A match written
 * in lower case after its first letter (a spell list's "Melf's acid arrow") takes the SRD name in lower case, as
 * the list keeps it; any other match takes the SRD name as it is written.
 */
function nameRewriter(renames: Map<string, string>): (text: string) => string {
  if (renames.size === 0) return (text) => text;
  const alternatives = [...renames.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "giu");
  return (text) =>
    text.replace(pattern, (match) => {
      const next = renames.get(match.toLowerCase()) as string;
      const restLower = match.slice(1) === match.slice(1).toLowerCase();
      return restLower ? next.toLowerCase() : next;
    });
}

function rewriteStrings(value: unknown, rewrite: (text: string) => string): unknown {
  if (typeof value === "string") return rewrite(value);
  if (Array.isArray(value)) return value.map((item) => rewriteStrings(item, rewrite));
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteStrings(item, rewrite)]));
  return value;
}

/**
 * The SRD Baseline's records by file, with the records the scraper names by their SRD name renamed. A record whose
 * `srdName` is set takes that name and drops the field. Every string in every record that names an old name is
 * rewritten to the SRD name, so references in class spell lists, descriptions and item text follow the rename.
 * The input is not changed.
 */
export function applySrdNames(files: Record<string, unknown[]>): Record<string, unknown[]> {
  const renames = new Map<string, string>();
  for (const records of Object.values(files)) {
    for (const record of records) {
      if (isObject(record) && typeof record.srdName === "string") renames.set(String(record.name).toLowerCase(), record.srdName);
    }
  }
  const rewrite = nameRewriter(renames);
  return Object.fromEntries(
    Object.entries(files).map(([file, records]) => [
      file,
      records.map((record) => {
        if (!isObject(record) || typeof record.srdName !== "string") return rewriteStrings(record, rewrite);
        const { srdName, ...rest } = record;
        return rewriteStrings({ ...rest, name: srdName }, rewrite);
      }),
    ]),
  );
}

/**
 * The SRD Baseline's classes, from the scraper's class records. The archetype filter and the SRD source
 * stay as the scraper gives them. The PHB intro prose of each class is non-SRD (ADR 0014), so each class
 * description is empty. The options a feature or subclass offers keep their names but carry source SRD.
 */
export function pruneClasses(rawClasses: ClassData[]): ClassData[] {
  return rawClasses
    .filter((c) => SRD_ARCHETYPES[c.name])
    .map((c) => {
      const allowed = SRD_ARCHETYPES[c.name];
      const subclasses = (c.subclasses || [])
        .filter((sc) => allowed.some((a) => sc.name.toLowerCase().includes(a.toLowerCase())))
        .map(srdSubclass);
      return {
        ...c,
        source: "SRD",
        description: "",
        features: c.features.map(srdFeature),
        subclasses,
      };
    });
}
