import { ToolsClient } from "../client.js";
import { resolveAllCopies } from "../parser/copy-resolver.js";
import { renderEntries } from "../parser/entry-renderer.js";
import { cleanTags } from "../parser/tag-cleaner.js";
import { OptionFeatureModel } from "../types/models.js";

const FEATURE_TYPE_MAP: Record<string, string> = {
  AI: "Artificer Infusion",
  AS: "Arcane Shot",
  ED: "Elemental Discipline",
  EI: "Eldritch Invocation",
  "FS:B": "Fighting Style (Bard)",
  "FS:F": "Fighting Style (Fighter)",
  "FS:P": "Fighting Style (Paladin)",
  "FS:R": "Fighting Style (Ranger)",
  MM: "Metamagic",
  "MV:B": "Maneuver (Battle Master)",
  PB: "Pact Boon",
  RN: "Rune (Rune Knight)",
  DG: "Dark Gift",
  SG: "Supernatural Gift",
  CS: "Character Secret",
  "RF:B": "Regional Feature",
};

export async function scrapeOptions(client: ToolsClient): Promise<OptionFeatureModel[]> {
  console.log("  → Fetching optional features from data/optionalfeatures.json...");
  const rawOpt = await client.fetchJson<{ optionalfeature: any[] }>("data/optionalfeatures.json");

  console.log("  → Fetching character creation options from data/charcreationoptions.json...");
  const rawChar = await client.fetchJson<{ charoption: any[] }>("data/charcreationoptions.json");

  const resolvedOpt = resolveAllCopies(rawOpt.optionalfeature || []);
  const resolvedChar = resolveAllCopies(rawChar.charoption || []);

  const results: OptionFeatureModel[] = [];

  for (const raw of resolvedOpt) {
    const featureTypes: string[] = Array.isArray(raw.featureType) ? raw.featureType : [];
    const category =
      featureTypes.map((ft) => FEATURE_TYPE_MAP[ft] || ft).join(", ") || "Other Option";

    results.push({
      name: cleanTags(raw.name, "plain"),
      source: raw.source,
      category,
      featureType: featureTypes,
      prerequisite: formatOptionPrerequisites(raw.prerequisite),
      description: renderEntries(raw.entries, "markdown"),
      rawEntries: raw.entries,
    });
  }

  for (const raw of resolvedChar) {
    const optionTypes: string[] = Array.isArray(raw.optionType) ? raw.optionType : [];
    const category =
      optionTypes.map((ot) => FEATURE_TYPE_MAP[ot] || ot).join(", ") || "Character Option";

    results.push({
      name: cleanTags(raw.name, "plain"),
      source: raw.source,
      category,
      featureType: optionTypes,
      prerequisite: formatOptionPrerequisites(raw.prerequisite),
      description: renderEntries(raw.entries, "markdown"),
      rawEntries: raw.entries,
    });
  }

  return results;
}

function formatOptionPrerequisites(prereqs: any[] | null | undefined): string | null {
  if (!prereqs || !Array.isArray(prereqs) || prereqs.length === 0) return null;

  const parts: string[] = [];

  for (const p of prereqs) {
    if (!p || typeof p !== "object") continue;

    if (p.other) {
      parts.push(cleanTags(p.other, "plain"));
    }

    if (p.level) {
      if (typeof p.level === "number") {
        parts.push(`Level ${p.level}`);
      } else if (typeof p.level === "object") {
        const cls = p.level.class?.name || "character";
        parts.push(`${p.level.level}${getOrdinal(p.level.level)}-level ${cls}`);
      }
    }

    if (p.pact) {
      parts.push(`Pact of the ${p.pact}`);
    }

    if (p.patron) {
      parts.push(`${p.patron} patron`);
    }

    if (Array.isArray(p.spell)) {
      const spells = p.spell.map((s: string) => cleanTags(s.replace(/#.*$/, ""), "plain"));
      parts.push(`${spells.join(", ")} cantrip/spell`);
    }

    if (Array.isArray(p.item)) {
      const items = p.item.map((i: string) => cleanTags(i, "plain"));
      parts.push(items.join(", "));
    }

    if (Array.isArray(p.feature)) {
      const features = p.feature.map((f: string) => cleanTags(f, "plain"));
      parts.push(features.join(", "));
    }
  }

  return parts.length > 0 ? parts.join("; ") : null;
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
