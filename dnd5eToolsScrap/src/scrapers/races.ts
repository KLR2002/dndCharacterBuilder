import type { ToolsClient } from "../types/models.ts";
import { resolveAllCopies } from "../parser/copy-resolver.ts";
import { renderEntries } from "../parser/entry-renderer.ts";
import { cleanTags } from "../parser/tag-cleaner.ts";
import { extractRuleChoices, RULE_CHOICE_LEVELS, ruleChoiceKey, type ExtractedRuleChoice } from "./rule-choices.ts";
import type { RaceModel, SubraceModel, TraitModel } from "../types/models.ts";
import type { ProficiencyReport } from "../types/proficiency.ts";
import { newProficiencyReport, structuredGrants } from "../parser/proficiency-grants.ts";

/** 5e.tools prefixes variant subraces with this; it is a source convention, not a rules term. */
const VARIANT_PREFIX = /^Variant;?\s*/;

/**
 * Normalises a subrace name and reports whether it is a variant.
 *
 * All thirteen variant subraces in the catalog use this convention - one is
 * named `Variant` and twelve are named `Variant; <descent>` - so anything
 * matching an exact name was only ever finding the first kind.
 */
function normalizeSubraceName(rawName: string | null | undefined): { name: string; isVariant: boolean } {
  const name = (rawName ?? "").trim();
  const isVariant = VARIANT_PREFIX.test(name);
  if (!isVariant) return { name, isVariant };
  // "Variant" on its own is Variant Human, which the prefix would empty out.
  return { name: name.replace(VARIANT_PREFIX, "") || "Variant", isVariant };
}

/**
 * Attaches curated Rule Choices to the trait that grants them. A scraped choice
 * with no curated level is skipped rather than guessed at; the scraper's test
 * fails if that ever happens, so this stays a backstop rather than a path.
 */
function attachChoices(
  traits: TraitModel[],
  extracted: ExtractedRuleChoice[],
  parts: { source: string; race: string; subrace?: string | null }
): TraitModel[] {
  if (extracted.length === 0) return traits;
  const byName = new Map<string, ExtractedRuleChoice[]>();
  for (const choice of extracted) {
    const group = byName.get(choice.traitName) ?? [];
    group.push(choice);
    byName.set(choice.traitName, group);
  }
  const remaining = new Map(byName);
  return traits.map((trait) => {
    const group = remaining.get(trait.name);
    if (!group || group.length === 0) return trait;
    // One trait can grant several choices (Simic Hybrid picks a second
    // enhancement at 5th level), so consume them in document order.
    const choice = group.shift()!;
    const curated = RULE_CHOICE_LEVELS[ruleChoiceKey({ ...parts, trait: trait.name, index: choice.index })];
    if (!curated || curated.momentary || curated.deferred) return trait;
    return {
      ...trait,
      choice: {
        pick: choice.pick,
        level: curated.level,
        ...(curated.effectLevel != null ? { effectLevel: curated.effectLevel } : {}),
        ...(choice.replaces ? { replaces: choice.replaces } : {}),
        options: choice.options,
      },
    };
  });
}

const SIZE_MAP: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan",
};

export async function scrapeRaces(
  client: ToolsClient,
  report: ProficiencyReport = newProficiencyReport()
): Promise<RaceModel[]> {
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

    const hasName = Boolean(rawSub.name && rawSub.name.trim());
    const hasAbility = Boolean(
      rawSub.ability &&
        (Array.isArray(rawSub.ability)
          ? rawSub.ability.length > 0
          : Object.keys(rawSub.ability).length > 0)
    );
    const hasEntries = Boolean(rawSub.entries && rawSub.entries.length > 0);
    if (!hasName && !hasAbility && !hasEntries) continue;

    const parentKey = `${parentName.toLowerCase()}__${(parentSource || "").toLowerCase()}`;

    const traits: TraitModel[] = [];
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

    const normalized = normalizeSubraceName(rawSub.name);

    // Structured proficiency fields on the subrace, owned by "Subrace" and named with its race.
    const proficiencies = structuredGrants(
      { source: rawSub.source, owner: "Subrace", feature: `${parentName} (${normalized.name})`, level: 0 },
      {
        skills: rawSub.skillProficiencies,
        tools: rawSub.toolProficiencies,
        languages: rawSub.languageProficiencies,
        weapons: rawSub.weaponProficiencies,
        armor: rawSub.armorProficiencies,
      }
    );
    if (proficiencies.unparsed.length > 0) {
      report.unparsed.push({ owner: "Subrace", feature: `${parentName} (${normalized.name})`, level: 0, unparsed: proficiencies.unparsed });
    }

    const subraceModel: SubraceModel = {
      ...(proficiencies.grants.length > 0 ? { grants: proficiencies.grants } : {}),
      name: normalized.name,
      isVariant: normalized.isVariant,
      source: rawSub.source,
      raceName: parentName,
      raceSource: parentSource || "",
      abilityScoreIncrease: parseAbilityScores(rawSub.ability),
      darkvision: parseDarkvision(rawSub),
      traits: attachChoices(traits, extractRuleChoices(rawSub.entries, [renderEntries(rawSub.entries, "plain")]), {
        source: rawSub.source,
        race: parentName,
        subrace: normalized.name,
      }),
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
    const traits: TraitModel[] = [];
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
    const traitsWithChoices = attachChoices(traits, extractRuleChoices(raw.entries, [renderEntries(raw.entries, "plain")]), {
      source: raw.source,
      race: raw.name,
      subrace: null,
    });

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

    // Structured proficiency fields on the race itself; a block the mapping cannot state is reported, not granted.
    const proficiencies = structuredGrants(
      { source: raw.source, owner: "Race", feature: raw.name, level: 0 },
      {
        skills: raw.skillProficiencies,
        tools: raw.toolProficiencies,
        languages: raw.languageProficiencies,
        weapons: raw.weaponProficiencies,
        armor: raw.armorProficiencies,
      }
    );
    if (proficiencies.unparsed.length > 0) {
      report.unparsed.push({ owner: "Race", feature: raw.name, level: 0, unparsed: proficiencies.unparsed });
    }

    races.push({
      ...(proficiencies.grants.length > 0 ? { grants: proficiencies.grants } : {}),
      name: raw.name,
      source: raw.source,
      size: sizes,
      speed,
      abilityScoreIncrease: parseAbilityScores(raw.ability),
      darkvision: parseDarkvision(raw),
      traits: traitsWithChoices,
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
