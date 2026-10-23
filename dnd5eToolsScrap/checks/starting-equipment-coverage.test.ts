import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { scrapeClasses } from "../src/scrapers/classes.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";
import { newStartingEquipmentReport } from "../src/parser/starting-equipment.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Every 2014-print class in the raw class payloads must come out of the scraper with starting equipment slots, and
// with no entry or slot of an unrecognised shape. The raw payloads are the scraper's own cache of the 5e.tools
// payloads (dnd5eToolsScrap/.cache, written by an earlier scrape and gitignored), read through the real scraper with
// no network. Skipped where that cache is absent, like structured-choice-coverage.test.ts.

const CACHE_DIR = new URL("../.cache/", import.meta.url);
const CACHE_INDEX = new URL("data_class_index.json.json", CACHE_DIR);
const SNAPSHOT_AVAILABLE = fs.existsSync(CACHE_INDEX);

interface RawClass {
  name: string;
  source: string;
  startingEquipment?: { defaultData?: unknown };
}

/** A 2014-print class: its defaultData has a fixed slot or a lettered choice, as the printed kit does. */
function isPrinted2014(raw: RawClass): boolean {
  const defaultData = raw.startingEquipment?.defaultData;
  if (!Array.isArray(defaultData)) return false;
  return defaultData.some((slot) => slot && typeof slot === "object" && ("_" in slot || "a" in slot || "b" in slot));
}

function readJson(url: URL): any {
  return JSON.parse(fs.readFileSync(url, "utf8"));
}

/** A client that answers every class endpoint from the cached payloads, named as the scraper's cache names them. */
function snapshotClient(): ToolsClient {
  const index = readJson(CACHE_INDEX) as Record<string, string>;
  const payloads: Record<string, unknown> = { "data/class/index.json": index };
  for (const fileName of Object.values(index)) {
    payloads[`data/class/${fileName}`] = readJson(new URL(`data_class_${fileName}.json`, CACHE_DIR));
  }
  return {
    fetchJson: async (endpoint: string) => {
      if (!(endpoint in payloads)) throw new Error(`no fixture for ${endpoint}`);
      return payloads[endpoint];
    },
  } as unknown as ToolsClient;
}

test(
  "every 2014-print class in the snapshot scrapes with starting equipment slots and no unrecognised entry",
  { skip: SNAPSHOT_AVAILABLE ? false : "no raw payload cache in dnd5eToolsScrap/.cache" },
  async () => {
    const index = readJson(CACHE_INDEX) as Record<string, string>;
    const printed: RawClass[] = [];
    for (const fileName of Object.values(index)) {
      const payload = readJson(new URL(`data_class_${fileName}.json`, CACHE_DIR)) as { class?: RawClass[] };
      printed.push(...(payload.class ?? []).filter(isPrinted2014));
    }
    assert.ok(printed.length > 0, "the snapshot has 2014-print classes to check, so the check below is not vacuous");

    const report = newStartingEquipmentReport();
    const classes = await scrapeClasses(snapshotClient(), newProficiencyReport(), report);

    const failures: string[] = [];
    for (const raw of printed) {
      const scraped = classes.find((cls) => cls.name === raw.name && cls.source === raw.source);
      const slots = scraped?.startingEquipment ?? [];
      if (!scraped) failures.push(`${raw.name} (${raw.source}): the class is missing from the output`);
      else if (slots.length === 0) failures.push(`${raw.name} (${raw.source}): no starting equipment slots`);
      for (const slot of slots) {
        if (slot.kind === "unrecognised") failures.push(`${raw.name} (${raw.source}): a slot of an unrecognised shape`);
      }
    }
    assert.deepEqual(failures, [], "every 2014-print class has starting equipment slots");
    assert.deepEqual(report.unrecognised, [], "no starting equipment entry is of an unrecognised shape");
  },
);
