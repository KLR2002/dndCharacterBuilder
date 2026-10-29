import type { ToolsClient } from "../types/models.ts";
import type { OriginProficiencyKind, OriginRuleRecord, ProficiencySwapRow } from "../types/originRules.ts";

const RECORD_NAME = "Customizing Your Origin";
const RECORD_SOURCE = "TCE";
const SECTION_NAME = "Proficiencies";
const TABLE_CAPTION = "Proficiency Swaps";

const SINGLE_KINDS = new Map<string, OriginProficiencyKind>([
  ["skill", "skill"],
  ["tool", "tool"],
  ["armor", "armor"],
  ["simple weapon", "simple weapon"],
  ["martial weapon", "martial weapon"],
]);

/**
 * Reads one table cell into the kinds it names. A cell is one or more alternatives joined by "or"; an alternative
 * is a single kind, or "simple/martial weapon" for both weapon kinds. Anything else fails the scrape.
 */
function parseCell(cell: unknown): OriginProficiencyKind[] {
  if (typeof cell !== "string") throw new Error(`Unrecognised proficiency cell ${JSON.stringify(cell)} in ${TABLE_CAPTION}`);

  const kinds: OriginProficiencyKind[] = [];
  for (const alternative of cell.trim().toLowerCase().split(/\s+or\s+/)) {
    const weapons = /^(simple|martial)\/(simple|martial) weapon$/.exec(alternative);
    const names = weapons ? [`${weapons[1]} weapon`, `${weapons[2]} weapon`] : [alternative];
    for (const name of names) {
      const kind = SINGLE_KINDS.get(name);
      if (!kind) throw new Error(`Unrecognised proficiency cell ${JSON.stringify(cell)} in ${TABLE_CAPTION}`);
      if (!kinds.includes(kind)) kinds.push(kind);
    }
  }
  return kinds;
}

function parseRow(row: unknown): ProficiencySwapRow {
  if (!Array.isArray(row) || row.length !== 2) {
    throw new Error(`A ${TABLE_CAPTION} row is not two cells: ${JSON.stringify(row)}`);
  }
  const from = parseCell(row[0]);
  if (from.length !== 1) throw new Error(`A ${TABLE_CAPTION} row replaces more than one kind: ${JSON.stringify(row[0])}`);
  return { from: from[0], to: parseCell(row[1]) };
}

/** The Customizing Your Origin record's Proficiency Swaps table as structured rows. Fails when the record, table or any cell is missing or unrecognised. */
export async function scrapeOriginRules(client: ToolsClient): Promise<OriginRuleRecord[]> {
  console.log("  → Fetching origin rules from data/variantrules.json...");
  const rawData = await client.fetchJson<{ variantrule?: any[] }>("data/variantrules.json");

  const record = (rawData.variantrule || []).find((r) => r?.name === RECORD_NAME && r?.source === RECORD_SOURCE);
  if (!record) throw new Error(`Could not find the "${RECORD_NAME}" (${RECORD_SOURCE}) record in data/variantrules.json`);

  const section = (record.entries || []).find((e: any) => e?.type === "entries" && e?.name === SECTION_NAME);
  const table = (section?.entries || []).find((e: any) => e?.type === "table" && e?.caption === TABLE_CAPTION);
  if (!table) throw new Error(`Could not find the "${TABLE_CAPTION}" table in the "${SECTION_NAME}" section of "${RECORD_NAME}"`);
  if (!Array.isArray(table.rows) || table.rows.length === 0) throw new Error(`The "${TABLE_CAPTION}" table has no rows`);

  return [
    {
      name: RECORD_NAME,
      source: RECORD_SOURCE,
      proficiencySwaps: table.rows.map(parseRow),
    },
  ];
}
