import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { scrapeOptions } from "../src/scrapers/options.ts";
import { renderEntries } from "../src/parser/entry-renderer.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Placeholder records in the raw 5e.tools shape: a Replicate Magic Item style umbrella whose
// entries carry one table per Artificer level, and one plain infusion. The names and text are invented.
const UMBRELLA = {
  name: "Replicate Magic Item",
  source: "TCE",
  page: 1,
  featureType: ["AI"],
  entries: [
    "Placeholder prose that opens the infusion.",
    {
      type: "table",
      caption: "Replicable Items (2nd-Level Artificer)",
      colLabels: ["Magic Item", "Attunement"],
      colStyles: ["col-10", "col-2 text-center"],
      rows: [
        ["{@item Placeholder jug}", "No"],
        ["{@item Placeholder bag|PHB}", "No"],
        ["{@item Placeholder lamp}", "Yes"],
      ],
    },
    {
      type: "table",
      caption: "Replicable Items (6th-Level Artificer)",
      colLabels: ["Magic Item", "Attunement"],
      colStyles: ["col-10", "col-2 text-center"],
      rows: [
        ["{@item Placeholder boots}", "No"],
        ["{@item Placeholder ring}", "Yes"],
        ["{@item Placeholder staff|TCE} (detailed in {@book Placeholder chapter|TCE|1})", "No"],
      ],
    },
    "Placeholder prose that closes the infusion.",
  ],
};

const PLAIN_INFUSION = {
  name: "Placeholder Infusion",
  source: "TCE",
  featureType: ["AI"],
  prerequisite: [{ item: ["A placeholder item"] }],
  entries: ["Placeholder text for a plain infusion."],
};

// Placeholder records in the raw items.json shape. "Placeholder bag" is deliberately absent.
const JUG = { name: "Placeholder jug", source: "TCE", entries: ["Placeholder jug text."] };
const LAMP = { name: "Placeholder lamp", source: "TCE", entries: ["Placeholder lamp text."] };
const BOOTS = { name: "PLACEHOLDER BOOTS", source: "TCE", entries: ["Placeholder boots text."] };
const RING_FIRST = { name: "Placeholder ring", source: "ABC", entries: ["Placeholder ring text from the first source."] };
const RING_SECOND = { name: "Placeholder ring", source: "DEF", entries: ["Placeholder ring text from the second source."] };
const STAFF_OTHER = { name: "Placeholder staff", source: "ABC", entries: ["Placeholder staff text from another source."] };
const STAFF_SAME = { name: "Placeholder staff", source: "TCE", entries: ["Placeholder staff text from the infusion's source."] };
const ITEMS = [JUG, LAMP, BOOTS, RING_FIRST, RING_SECOND, STAFF_OTHER, STAFF_SAME];

/** items: the items.json payload to serve, or an Error to make that fetch fail. */
function clientWith(optionalfeature: unknown[], items: unknown = { item: ITEMS }): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      if (endpoint === "data/optionalfeatures.json") return { optionalfeature };
      if (endpoint === "data/charcreationoptions.json") return { charoption: [] };
      if (endpoint === "data/items.json") {
        if (items instanceof Error) throw items;
        return items;
      }
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
  } as unknown as ToolsClient;
}

function find<T extends { name: string }>(options: T[], name: string): T {
  const found = options.find((o) => o.name === name);
  assert.ok(found, `no option named ${name}`);
  return found;
}

test("each Replicate Magic Item table row becomes an AI option at the level its caption names", async () => {
  const options = await scrapeOptions(clientWith([UMBRELLA, PLAIN_INFUSION]));
  const rows = options.filter((o) => o.name.startsWith("Replicate Magic Item: "));

  assert.deepEqual(
    rows.map((o) => [o.name, o.prerequisite]),
    [
      ["Replicate Magic Item: Placeholder jug", "2nd-level Artificer"],
      ["Replicate Magic Item: Placeholder bag", "2nd-level Artificer"],
      ["Replicate Magic Item: Placeholder lamp", "2nd-level Artificer"],
      ["Replicate Magic Item: Placeholder boots", "6th-level Artificer"],
      ["Replicate Magic Item: Placeholder ring", "6th-level Artificer"],
      ["Replicate Magic Item: Placeholder staff", "6th-level Artificer"],
    ],
  );
  for (const row of rows) {
    assert.deepEqual(row.featureType, ["AI"]);
    assert.equal(row.source, "TCE", "a row carries the book of the umbrella record");
  }
});

test("a generated row description names the item and its attunement from the second column", async () => {
  const options = await scrapeOptions(clientWith([UMBRELLA]));

  assert.match(find(options, "Replicate Magic Item: Placeholder jug").description, /Placeholder jug/);
  assert.match(find(options, "Replicate Magic Item: Placeholder lamp").description, /Requires attunement/);
  assert.match(find(options, "Replicate Magic Item: Placeholder jug").description, /Does not require attunement/);
});

test("a row description leads with the generic line, then a blank line and the item's rendered text", async () => {
  const options = await scrapeOptions(clientWith([UMBRELLA]));

  assert.equal(
    find(options, "Replicate Magic Item: Placeholder jug").description,
    `Replicates the Placeholder jug. Does not require attunement.\n\n${renderEntries(JUG.entries, "markdown")}`,
  );
  assert.equal(
    find(options, "Replicate Magic Item: Placeholder lamp").description,
    `Replicates the Placeholder lamp. Requires attunement.\n\n${renderEntries(LAMP.entries, "markdown")}`,
  );
});

test("a row whose item is missing, has no entry text, or cannot be fetched keeps the exact generic line", async () => {
  const warn = mock.method(console, "warn", () => {});
  try {
    const generic = (name: string, attunement: string) => `Replicates the ${name}. ${attunement}`;

    // The item is not in items.json at all.
    const missing = await scrapeOptions(clientWith([UMBRELLA], { item: ITEMS.filter((i) => i !== BOOTS) }));
    assert.equal(
      find(missing, "Replicate Magic Item: Placeholder boots").description,
      generic("Placeholder boots", "Does not require attunement."),
    );
    assert.equal(
      find(missing, "Replicate Magic Item: Placeholder bag").description,
      generic("Placeholder bag", "Does not require attunement."),
    );

    // The item is there but has no entry text.
    const bare = await scrapeOptions(clientWith([UMBRELLA], { item: [{ name: "Placeholder boots", source: "TCE" }] }));
    assert.equal(
      find(bare, "Replicate Magic Item: Placeholder boots").description,
      generic("Placeholder boots", "Does not require attunement."),
    );

    // items.json cannot be fetched: the scrape still succeeds, every row keeps the generic line, and a warning is logged.
    const warningsBefore = warn.mock.callCount();
    const failed = await scrapeOptions(clientWith([UMBRELLA, PLAIN_INFUSION], new Error("offline")));
    const rows = failed.filter((o) => o.name.startsWith("Replicate Magic Item: "));
    assert.equal(rows.length, 6);
    assert.deepEqual(
      rows.map((o) => o.description),
      [
        generic("Placeholder jug", "Does not require attunement."),
        generic("Placeholder bag", "Does not require attunement."),
        generic("Placeholder lamp", "Requires attunement."),
        generic("Placeholder boots", "Does not require attunement."),
        generic("Placeholder ring", "Requires attunement."),
        generic("Placeholder staff", "Does not require attunement."),
      ],
    );
    assert.ok(warn.mock.callCount() > warningsBefore, "a failed items.json fetch logs a warning");
  } finally {
    warn.mock.restore();
  }
});

test("items with one name across sources: the infusion's own source wins, else the first match; names ignore case", async () => {
  const options = await scrapeOptions(clientWith([UMBRELLA]));

  // Two sources for the ring, neither the infusion's: the first in items.json wins.
  assert.equal(
    find(options, "Replicate Magic Item: Placeholder ring").description,
    `Replicates the Placeholder ring. Requires attunement.\n\n${renderEntries(RING_FIRST.entries, "markdown")}`,
  );
  // The staff's other-source copy comes first, but the copy from the infusion's source (TCE) wins.
  assert.equal(
    find(options, "Replicate Magic Item: Placeholder staff").description,
    `Replicates the Placeholder staff. Does not require attunement.\n\n${renderEntries(STAFF_SAME.entries, "markdown")}`,
  );
  // The item is stored as "PLACEHOLDER BOOTS"; the row says "Placeholder boots".
  assert.equal(
    find(options, "Replicate Magic Item: Placeholder boots").description,
    `Replicates the Placeholder boots. Does not require attunement.\n\n${renderEntries(BOOTS.entries, "markdown")}`,
  );
});

test("items.json is fetched at most once, and not at all when no row is replicable", async () => {
  const fetched: string[] = [];
  const client = (optionalfeature: unknown[]) =>
    ({
      fetchJson: async (endpoint: string) => {
        fetched.push(endpoint);
        if (endpoint === "data/optionalfeatures.json") return { optionalfeature };
        if (endpoint === "data/charcreationoptions.json") return { charoption: [] };
        if (endpoint === "data/items.json") return { item: ITEMS };
        throw new Error(`unexpected endpoint ${endpoint}`);
      },
    }) as unknown as ToolsClient;

  await scrapeOptions(client([UMBRELLA]));
  assert.equal(fetched.filter((e) => e === "data/items.json").length, 1);

  fetched.length = 0;
  await scrapeOptions(client([PLAIN_INFUSION]));
  assert.equal(fetched.includes("data/items.json"), false);
});

test("the umbrella record stays in the output, flagged as not selectable; other options are unchanged", async () => {
  const options = await scrapeOptions(clientWith([UMBRELLA, PLAIN_INFUSION]));
  const umbrella = options.find((o) => o.name === "Replicate Magic Item")!;
  const plain = options.find((o) => o.name === "Placeholder Infusion")!;

  assert.equal(umbrella.isUmbrella, true);
  assert.equal(plain.isUmbrella, undefined, "options other than the umbrella carry no flag");
  assert.equal(plain.prerequisite, "A placeholder item");
  assert.equal(plain.category, "Artificer Infusion");
  assert.equal(options.filter((o) => o.isUmbrella).length, 1);
});
