import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { scrapeBackgrounds } from "../src/scrapers/backgrounds.ts";
import { scrapeRaces } from "../src/scrapers/races.ts";
import { resolveAllCopies } from "../src/parser/copy-resolver.ts";
import { cleanTags } from "../src/parser/tag-cleaner.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";
import type { ProficiencyCategory, ProficiencyGrant, ProficiencyReport } from "../src/types/proficiency.ts";
import type { ToolsClient } from "../src/types/models.ts";
import { PROFICIENCY_GRANT_OVERRIDES } from "../src/overrides/proficiency-grants.ts";

// Every choice a race, subrace or background's structured fields call for must come out of the scraper as a
// choice grant of the same category and count. The raw records are the scraper's own cache of the 5e.tools
// payloads (dnd5eToolsScrap/.cache, written by an earlier scrape and gitignored), read through the real scrapers
// with no network. Where that cache is absent, the shipped data is checked instead (see the last test).

const CACHE_RACES = new URL("../.cache/data_races.json.json", import.meta.url);
const CACHE_BACKGROUNDS = new URL("../.cache/data_backgrounds.json.json", import.meta.url);
const SNAPSHOT_AVAILABLE = fs.existsSync(CACHE_RACES) && fs.existsSync(CACHE_BACKGROUNDS);

/**
 * Records whose choice is not stated as a grant, each with the one-line reason. Each must be either reported as
 * unparsed by the scraper or covered by a reviewed override, so an entry here is never a silent gap. An entry that
 * no longer has a missing choice fails the test, so this list cannot go stale.
 */
const ALLOWLIST: Array<{ owner: "Race" | "Subrace" | "Background"; name: string; source: string; reason: string }> = [
  {
    owner: "Race",
    name: "Hobgoblin",
    source: "VGM",
    reason: "its weapon choice is a filter on martial weapons that excludes magic ones, which the mapping states no pool for (reported)",
  },
  {
    owner: "Race",
    name: "Hobgoblin",
    source: "ERLW",
    reason: "a copy of the VGM record, so it carries the same weapon choice (reported)",
  },
  {
    owner: "Race",
    name: "Githyanki",
    source: "MPMM",
    reason: "reviewed override: its tool and skill are gained after each long rest, not held as standing proficiencies",
  },
  {
    owner: "Subrace",
    name: "Human (Keldon)",
    source: "PSD",
    reason: "reviewed override: its language entry restates the race's language of choice, which the race grants",
  },
  {
    owner: "Subrace",
    name: "Merfolk (Ixalan; Blue)",
    source: "PSX",
    reason: "reviewed override: its language entries restate the race's language of choice, which the race grants",
  },
  {
    owner: "Subrace",
    name: "Merfolk (Ixalan; Green)",
    source: "PSX",
    reason: "reviewed override: its language entries restate the race's language of choice, which the race grants",
  },
];

const STRUCTURED_FIELDS: Array<[string, ProficiencyCategory]> = [
  ["skillProficiencies", "skills"],
  ["toolProficiencies", "tools"],
  ["languageProficiencies", "languages"],
  ["weaponProficiencies", "weapons"],
  ["armorProficiencies", "armor"],
];

interface RequiredChoice {
  category: ProficiencyCategory;
  count: number;
}

/**
 * The choices a raw record's structured fields call for. A `choose` entry picks its count (one when it names none).
 * An `other` language entry picks one language. A count under an `any`-prefixed key picks that many entries of the
 * field's category, as `any`, `anyStandard` and the counted tool pools do.
 */
function requiredChoices(raw: Record<string, unknown>): RequiredChoice[] {
  const required: RequiredChoice[] = [];
  for (const [field, category] of STRUCTURED_FIELDS) {
    const list = raw[field];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!entry || typeof entry !== "object") continue;
      for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
        if (key === "choose" && value && typeof value === "object") {
          const count = (value as { count?: unknown }).count;
          required.push({ category, count: typeof count === "number" ? count : 1 });
        } else if (key === "other" && category === "languages" && value === true) {
          required.push({ category, count: 1 });
        } else if (key.startsWith("any") && typeof value === "number") {
          required.push({ category, count: value });
        }
      }
    }
  }
  return required;
}

/** The required choices that no choice grant matches. Each choice grant matches one requirement, by category and count. */
function unmatchedChoices(required: RequiredChoice[], grants: ProficiencyGrant[] = []): RequiredChoice[] {
  const available = grants.flatMap((grant) => (grant.kind === "choice" ? [{ category: grant.category, count: grant.count }] : []));
  const missing: RequiredChoice[] = [];
  for (const need of required) {
    const index = available.findIndex((grant) => grant.category === need.category && grant.count === need.count);
    if (index < 0) missing.push(need);
    else available.splice(index, 1);
  }
  return missing;
}

/** The name a subrace is output under. 5e.tools prefixes variant subraces with "Variant", which the scraper strips. */
function subraceOutputName(rawName: string): string {
  const name = rawName.trim();
  return name.replace(/^Variant;?\s*/, "") || "Variant";
}

function fakeClient(payloads: Record<string, unknown>): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      if (!(endpoint in payloads)) throw new Error(`no fixture for ${endpoint}`);
      return payloads[endpoint];
    },
  } as unknown as ToolsClient;
}

function readJson(url: URL): any {
  return JSON.parse(fs.readFileSync(url, "utf8"));
}

test(
  "every raw race, subrace and background with a choose or any entry has a matching choice grant, from the cached raw payloads",
  { skip: SNAPSHOT_AVAILABLE ? false : "no raw payload cache in dnd5eToolsScrap/.cache" },
  async () => {
    const racePayload = readJson(CACHE_RACES);
    const backgroundPayload = readJson(CACHE_BACKGROUNDS);
    const client = fakeClient({ "data/races.json": racePayload, "data/backgrounds.json": backgroundPayload });
    const report: ProficiencyReport = newProficiencyReport();
    const outputRaces = await scrapeRaces(client, report);
    const outputBackgrounds = await scrapeBackgrounds(client, report);
    const outputSubraces = outputRaces.flatMap((race) => race.subraces);

    const failures: string[] = [];
    const usedAllowlist = new Set<string>();

    const check = (
      owner: "Race" | "Subrace" | "Background",
      name: string,
      source: string,
      raw: Record<string, unknown>,
      grants: ProficiencyGrant[] | undefined,
      feature: string,
    ) => {
      const missing = unmatchedChoices(requiredChoices(raw), grants);
      if (missing.length === 0) return;
      const entry = ALLOWLIST.find((a) => a.owner === owner && a.name === name && a.source === source);
      if (entry) {
        usedAllowlist.add(`${owner}|${name}|${source}`);
        const reviewed = [...PROFICIENCY_GRANT_OVERRIDES.races, ...PROFICIENCY_GRANT_OVERRIDES.subraces];
        assert.ok(
          report.unparsed.some((u) => u.owner === owner && u.feature === feature) || reviewed.some((o) => o.owner === owner && o.feature === feature),
          `${owner} ${name} (${source}) is allowlisted, so it must be reported as unparsed or covered by a reviewed override`,
        );
        return;
      }
      for (const need of missing) failures.push(`${owner} ${name} (${source}): no ${need.category} choice of ${need.count}`);
    };

    for (const raw of resolveAllCopies(racePayload.race ?? [])) {
      const output = outputRaces.filter((race) => race.name === raw.name && race.source === raw.source);
      if (output.length === 0) {
        failures.push(`Race ${raw.name} (${raw.source}): the record is missing from the output`);
        continue;
      }
      check("Race", raw.name, raw.source, raw, output[0].grants, raw.name);
    }

    for (const raw of resolveAllCopies(racePayload.subrace ?? [])) {
      const parentName = raw.raceName || raw._copy?.raceName;
      const name = subraceOutputName(raw.name ?? "");
      const feature = `${parentName} (${name})`;
      const output = outputSubraces.filter(
        (sub) => sub.source === raw.source && sub.raceName === parentName && sub.name === name,
      );
      if (output.length === 0) {
        if (requiredChoices(raw).length > 0) failures.push(`Subrace ${feature} (${raw.source}): the record is missing from the output`);
        continue;
      }
      check("Subrace", feature, raw.source, raw, output[0].grants, feature);
    }

    for (const raw of resolveAllCopies(backgroundPayload.background ?? [])) {
      const name = cleanTags(raw.name, "plain");
      const output = outputBackgrounds.filter((background) => background.name === name && background.source === raw.source);
      if (output.length === 0) {
        failures.push(`Background ${name} (${raw.source}): the record is missing from the output`);
        continue;
      }
      check("Background", name, raw.source, raw, output[0].grants, name);
    }

    const unused = ALLOWLIST.filter((a) => !usedAllowlist.has(`${a.owner}|${a.name}|${a.source}`)).map((a) => `${a.owner} ${a.name} (${a.source})`);
    assert.deepEqual(failures, [], "every choice in the raw records has a matching choice grant, or an allowlist entry");
    assert.deepEqual(unused, [], "every allowlist entry still has a missing choice");
  },
);

// The shipped data holds the skill choices a scrape once dropped. It is checked directly so the guard also runs
// where the raw cache is absent. The raw structured fields are not in the shipped files, so this asserts named
// records, each with the choice its raw entry names.
const SHIPPED_SKILL_CHOICES: Array<{ owner: "Race" | "Background"; name: string; source: string; count: number }> = [
  { owner: "Background", name: "Investigator", source: "VRGR", count: 2 },
  { owner: "Background", name: "Cloistered Scholar", source: "SCAG", count: 1 },
  { owner: "Race", name: "Half-Elf", source: "PHB", count: 2 },
  { owner: "Race", name: "Orc", source: "VGM", count: 2 },
  { owner: "Race", name: "Tortle", source: "MPMM", count: 1 },
];

test("the shipped race and background data keeps the skill choices a scrape once dropped", () => {
  const races = readJson(new URL("../data/races.json", import.meta.url)) as Array<{ name: string; source: string; grants?: ProficiencyGrant[] }>;
  const backgrounds = readJson(new URL("../data/backgrounds.json", import.meta.url)) as Array<{ name: string; source: string; grants?: ProficiencyGrant[] }>;
  for (const want of SHIPPED_SKILL_CHOICES) {
    const list = want.owner === "Race" ? races : backgrounds;
    const record = list.find((r) => r.name === want.name && r.source === want.source);
    assert.ok(record, `${want.owner} ${want.name} (${want.source}) is in the shipped data`);
    const kept = (record.grants ?? []).some((g) => g.kind === "choice" && g.category === "skills" && g.count === want.count);
    assert.ok(kept, `${want.owner} ${want.name} (${want.source}) keeps its skill choice of ${want.count}`);
  }
});
