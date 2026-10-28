import type { ToolsClient } from "../types/models.ts";
import { resolveAllCopies } from "../parser/copy-resolver.ts";
import { renderEntries } from "../parser/entry-renderer.ts";
import { cleanTags } from "../parser/tag-cleaner.ts";
import type { FeatModel } from "../types/models.ts";
import type { ProficiencyReport } from "../types/proficiency.ts";
import { newProficiencyReport, resolveFeatureGrants, type GrantSubject } from "../parser/proficiency-grants.ts";
import { PROFICIENCY_GRANT_OVERRIDES } from "../overrides/proficiency-grants.ts";
import { resolveInitiativeBonuses } from "../parser/initiative-bonuses.ts";
import { INITIATIVE_BONUS_OVERRIDES } from "../overrides/initiative-bonuses.ts";
import { parseAdditionalSpells } from "../parser/additional-spells.ts";
import type { AdditionalSpells } from "../types/models.ts";

const STAT_NAMES: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export async function scrapeFeats(
  client: ToolsClient,
  report: ProficiencyReport = newProficiencyReport()
): Promise<FeatModel[]> {
  console.log("  → Fetching feats from data/feats.json...");
  const rawData = await client.fetchJson<{ feat: any[] }>("data/feats.json");

  const resolvedFeats = resolveAllCopies(rawData.feat || []);
  const feats: FeatModel[] = [];

  for (const raw of resolvedFeats) {
    const prerequisite = formatPrerequisites(raw.prerequisite);
    const additionalSpells = parseAdditionalSpells(raw.additionalSpells);

    feats.push({
      name: cleanTags(raw.name, "plain"),
      source: raw.source,
      prerequisite,
      abilityScoreIncrease: parseAbilityScores(raw.ability),
      description: renderEntries(raw.entries, "markdown"),
      rawEntries: raw.entries,
      ...(additionalSpells ? { additionalSpells } : {}),
    });
  }

  // A feat is its own grant owner: its prose is the feature.
  const subjects: GrantSubject[] = feats.map((feat) => ({
    source: feat.source,
    owner: "Feat",
    feature: feat.name,
    level: 0,
    description: feat.description,
  }));
  const resolved = resolveFeatureGrants(subjects, PROFICIENCY_GRANT_OVERRIDES.feats, report);
  resolved.forEach((result, i) => {
    if (result.grants.length > 0) feats[i].grants = result.grants;
  });
  const bonuses = resolveInitiativeBonuses(subjects, INITIATIVE_BONUS_OVERRIDES, report);
  bonuses.forEach((bonus, i) => {
    if (bonus) feats[i].initiativeBonus = bonus;
  });

  return feats;
}

/** The key a feat's spell grants are looked up by: its cleaned name and its source. */
export function featKey(name: string, source: string): string {
  return `${name}|${source}`;
}

/** The spell grants of each feat in a raw feats file, keyed by featKey. A feat without grants is absent. */
export function additionalSpellsByFeat(rawData: { feat?: any[] }): Map<string, AdditionalSpells[]> {
  const grants = new Map<string, AdditionalSpells[]>();
  for (const raw of resolveAllCopies(rawData.feat || [])) {
    const spells = parseAdditionalSpells(raw.additionalSpells);
    if (spells) grants.set(featKey(cleanTags(raw.name, "plain"), raw.source), spells);
  }
  return grants;
}

function parseAbilityScores(ability: any): Array<Record<string, number>> | null {
  if (!ability) return null;
  const list = Array.isArray(ability) ? ability : [ability];
  const result: Array<Record<string, number>> = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === "number") {
        scores[STAT_NAMES[k] || k] = v;
      }
    }
    if (Object.keys(scores).length > 0) {
      result.push(scores);
    }
  }

  return result.length > 0 ? result : null;
}

function formatPrerequisites(prereqs: any[] | null | undefined): string | null {
  if (!prereqs || !Array.isArray(prereqs) || prereqs.length === 0) return null;

  const parts: string[] = [];

  for (const p of prereqs) {
    if (!p || typeof p !== "object") continue;

    if (p.other) {
      parts.push(cleanTags(p.other, "plain"));
    }

    if (p.level) {
      parts.push(`Level ${p.level}`);
    }

    if (p.spellcasting) {
      parts.push("The ability to cast at least one spell");
    }

    if (Array.isArray(p.ability)) {
      const abilityParts: string[] = [];
      for (const a of p.ability) {
        for (const [k, v] of Object.entries(a)) {
          abilityParts.push(`${STAT_NAMES[k] || k.toUpperCase()} ${v} or higher`);
        }
      }
      if (abilityParts.length > 0) parts.push(abilityParts.join(" or "));
    }

    if (Array.isArray(p.race)) {
      const raceParts = p.race.map((r: any) => cleanTags(r.name || r.subrace || "", "plain"));
      if (raceParts.length > 0) parts.push(raceParts.join(" or "));
    }

    if (Array.isArray(p.proficiency)) {
      for (const prof of p.proficiency) {
        if (prof.armor) parts.push(`Proficiency with ${prof.armor} armor`);
        if (prof.weapon) parts.push(`Proficiency with ${prof.weapon}`);
      }
    }

    if (Array.isArray(p.feat)) {
      const featParts = p.feat.map((f: string) => cleanTags(f.split("|")[0], "plain"));
      parts.push(featParts.join(", "));
    }
  }

  return parts.length > 0 ? parts.join("; ") : null;
}
