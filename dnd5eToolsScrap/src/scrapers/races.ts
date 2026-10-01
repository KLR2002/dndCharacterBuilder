import { ToolsClient } from "../client.js";
import { resolveAllCopies } from "../parser/copy-resolver.js";
import { renderEntries } from "../parser/entry-renderer.js";
import { cleanTags } from "../parser/tag-cleaner.js";
import { RaceModel, SubraceModel } from "../types/models.js";

const SIZE_MAP: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan",
};

export async function scrapeRaces(client: ToolsClient): Promise<RaceModel[]> {
  console.log("  → Fetching races from data/races.json...");
  const rawData = await client.fetchJson<{ race: any[]; subrace?: any[] }>("data/races.json");

  const resolvedRaces = resolveAllCopies(rawData.race || []);
  const resolvedSubraces = resolveAllCopies(rawData.subrace || []);

  // Map subraces by parent race key: "name__source"
  const subraceMap = new Map<string, SubraceModel[]>();

  for (const rawSub of resolvedSubraces) {
    const parentName = rawSub.raceName || rawSub._copy?.raceName;
    const parentSource = rawSub.raceSource || rawSub._copy?.raceSource;

    if (!parentName) continue;
    const parentKey = `${parentName.toLowerCase()}__${(parentSource || "").toLowerCase()}`;

    const traits: Array<{ name: string; description: string }> = [];
    if (Array.isArray(rawSub.entries)) {
      for (const ent of rawSub.entries) {
        if (ent && typeof ent === "object" && ent.name) {
          traits.push({
            name: cleanTags(ent.name, "plain"),
            description: renderEntries(ent.entries || ent.entry, "markdown"),
          });
        }
      }
    }

    const subraceModel: SubraceModel = {
      name: rawSub.name,
      source: rawSub.source,
      raceName: parentName,
      raceSource: parentSource || "",
      abilityScoreIncrease: parseAbilityScores(rawSub.ability),
      darkvision: parseDarkvision(rawSub),
      traits,
      description: renderEntries(rawSub.entries, "markdown"),
      rawEntries: rawSub.entries,
    };

    const existing = subraceMap.get(parentKey) || [];
    existing.push(subraceModel);
    subraceMap.set(parentKey, existing);
  }

  const races: RaceModel[] = [];

  for (const raw of resolvedRaces) {
    // Process size
    const sizes = (raw.size || ["M"]).map((s: string) => SIZE_MAP[s] || s);

    // Process speed
    let speed = { walk: 30 };
    if (typeof raw.speed === "number") {
      speed = { walk: raw.speed };
    } else if (raw.speed && typeof raw.speed === "object") {
      speed = {
        walk: raw.speed.walk ?? 30,
        ...(raw.speed.fly != null && { fly: typeof raw.speed.fly === "number" ? raw.speed.fly : 30 }),
        ...(raw.speed.swim != null && { swim: typeof raw.speed.swim === "number" ? raw.speed.swim : 30 }),
        ...(raw.speed.climb != null && { climb: typeof raw.speed.climb === "number" ? raw.speed.climb : 30 }),
        ...(raw.speed.burrow != null && { burrow: typeof raw.speed.burrow === "number" ? raw.speed.burrow : 30 }),
      };
    }

    // Process traits
    const traits: Array<{ name: string; description: string }> = [];
    if (Array.isArray(raw.entries)) {
      for (const ent of raw.entries) {
        if (ent && typeof ent === "object" && ent.name) {
          traits.push({
            name: cleanTags(ent.name, "plain"),
            description: renderEntries(ent.entries || ent.entry, "markdown"),
          });
        }
      }
    }

    // Process languages
    const languages: string[] = [];
    if (Array.isArray(raw.languageProficiencies)) {
      for (const langObj of raw.languageProficiencies) {
        for (const [key, val] of Object.entries(langObj)) {
          if (val) {
            if (key === "anyStandard") languages.push(`${val} of your choice`);
            else languages.push(key.charAt(0).toUpperCase() + key.slice(1));
          }
        }
      }
    }

    // Get subraces
    const raceKey = `${raw.name.toLowerCase()}__${raw.source.toLowerCase()}`;
    const raceKeyNoSource = `${raw.name.toLowerCase()}__`;
    const attachedSubraces = subraceMap.get(raceKey) || subraceMap.get(raceKeyNoSource) || [];

    races.push({
      name: raw.name,
      source: raw.source,
      size: sizes,
      speed,
      abilityScoreIncrease: parseAbilityScores(raw.ability),
      darkvision: parseDarkvision(raw),
      traits,
      languages,
      subraces: attachedSubraces,
      description: renderEntries(raw.entries, "markdown"),
      rawEntries: raw.entries,
    });
  }

  return races;
}

function parseAbilityScores(ability: any): Array<Record<string, number>> {
  if (!ability) return [];
  const list = Array.isArray(ability) ? ability : [ability];
  const result: Array<Record<string, number>> = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === "number") {
        scores[k] = v;
      }
    }
    if (Object.keys(scores).length > 0) {
      result.push(scores);
    }
  }

  return result;
}

function parseDarkvision(raw: any): number | null {
  if (raw.darkvision != null && typeof raw.darkvision === "number") {
    return raw.darkvision;
  }
  if (Array.isArray(raw.senses)) {
    for (const s of raw.senses) {
      const match = typeof s === "string" && s.match(/darkvision\s*(\d+)/i);
      if (match) return Number(match[1]);
    }
  }
  if (Array.isArray(raw.entries)) {
    for (const ent of raw.entries) {
      if (ent?.name?.toLowerCase().includes("darkvision")) {
        const desc = typeof ent.entries?.[0] === "string" ? ent.entries[0] : "";
        const m = desc.match(/(\d+)\s*feet/i);
        if (m) return Number(m[1]);
        return 60;
      }
    }
  }
  return null;
}
