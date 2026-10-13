import type { ToolsClient } from "../types/models.ts";
import { resolveAllCopies } from "../parser/copy-resolver.ts";
import { renderEntries } from "../parser/entry-renderer.ts";
import { cleanTags } from "../parser/tag-cleaner.ts";

export interface ConditionModel {
  name: string;
  source: string;
  description: string;
  rawEntries?: any[];
}

export async function scrapeConditions(client: ToolsClient): Promise<ConditionModel[]> {
  console.log("  → Fetching conditions from data/conditionsdiseases.json...");
  const rawData = await client.fetchJson<{ condition?: any[]; status?: any[] }>("data/conditionsdiseases.json");

  const combined = [...(rawData.condition || []), ...(rawData.status || [])];
  const resolved = resolveAllCopies(combined);

  const conditions: ConditionModel[] = [];
  const seen = new Set<string>();

  for (const raw of resolved) {
    const key = `${raw.name.toLowerCase()}__${(raw.source || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    conditions.push({
      name: cleanTags(raw.name, "plain"),
      source: raw.source,
      description: renderEntries(raw.entries, "markdown"),
      rawEntries: raw.entries,
    });
  }

  conditions.sort((a, b) => a.name.localeCompare(b.name));
  return conditions;
}
