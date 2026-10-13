import type { ToolsClient } from "../types/models.ts";
import { resolveAllCopies } from "../parser/copy-resolver.ts";
import { renderEntries } from "../parser/entry-renderer.ts";
import { cleanTags } from "../parser/tag-cleaner.ts";
import type { OptionFeatureModel } from "../types/models.ts";

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

function formatOptionPrerequisites(prereqs: any[] | any | null | undefined): string | null {
  if (!prereqs) return null;
  const list = Array.isArray(prereqs) ? prereqs : [prereqs];
  if (list.length === 0) return null;

  const parts: string[] = [];

  for (const p of list) {
    if (!p || typeof p !== "object") continue;

    if (p.other) {
      parts.push(cleanTags(String(p.other), "plain"));
    }

    if (p.level) {
      if (typeof p.level === "number") {
        parts.push(`Level ${p.level}`);
      } else if (typeof p.level === "object") {
        const lvl = typeof p.level.level === "number" ? p.level.level : (parseInt(String(p.level.level), 10) || 1);
        const cls = p.level.class?.name || (typeof p.level.class === "string" ? p.level.class : "character");
        parts.push(`${lvl}${getOrdinal(lvl)}-level ${cls}`);
      }
    }

    if (p.pact) {
      parts.push(`Pact of the ${p.pact}`);
    }

    if (p.patron) {
      parts.push(`${p.patron} patron`);
    }

    if (Array.isArray(p.spell)) {
      const spells = p.spell
        .map((s: any) => {
          if (typeof s === "string") return cleanTags(s.replace(/#.*$/, ""), "plain");
          if (s && typeof s === "object") {
            if (s.choose) return `a ${s.choose} spell`;
            if (s.name) return cleanTags(String(s.name).replace(/#.*$/, ""), "plain");
          }
          return "";
        })
        .filter(Boolean);
      if (spells.length > 0) {
        parts.push(`${spells.join(", ")} cantrip/spell`);
      }
    } else if (typeof p.spell === "string") {
      parts.push(`${cleanTags(p.spell.replace(/#.*$/, ""), "plain")} cantrip/spell`);
    } else if (p.spell === true) {
      parts.push("Spellcasting or Pact Magic feature");
    } else if (p.spell && typeof p.spell === "object") {
      if (p.spell.choose) parts.push(`a ${p.spell.choose} spell`);
    }

    if (Array.isArray(p.item)) {
      const items = p.item
        .map((i: any) => {
          if (typeof i === "string") return cleanTags(i, "plain");
          if (i && typeof i === "object" && i.name) return cleanTags(String(i.name), "plain");
          return "";
        })
        .filter(Boolean);
      if (items.length > 0) parts.push(items.join(", "));
    } else if (typeof p.item === "string") {
      parts.push(cleanTags(p.item, "plain"));
    }

    if (Array.isArray(p.feature)) {
      const features = p.feature
        .map((f: any) => {
          if (typeof f === "string") return cleanTags(f, "plain");
          if (f && typeof f === "object" && f.name) return cleanTags(String(f.name), "plain");
          return "";
        })
        .filter(Boolean);
      if (features.length > 0) parts.push(features.join(", "));
    } else if (typeof p.feature === "string") {
      parts.push(cleanTags(p.feature, "plain"));
    }
  }

  return parts.length > 0 ? parts.join("; ") : null;
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
