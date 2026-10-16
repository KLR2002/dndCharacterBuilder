import test from "node:test";
import assert from "node:assert/strict";
import { scrapeOptions } from "../src/scrapers/options.ts";
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

function clientWith(optionalfeature: unknown[]): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      if (endpoint === "data/optionalfeatures.json") return { optionalfeature };
      if (endpoint === "data/charcreationoptions.json") return { charoption: [] };
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
  } as unknown as ToolsClient;
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
  const find = (name: string) => options.find((o) => o.name === name)!;

  assert.match(find("Replicate Magic Item: Placeholder jug").description, /Placeholder jug/);
  assert.match(find("Replicate Magic Item: Placeholder lamp").description, /Requires attunement/);
  assert.match(find("Replicate Magic Item: Placeholder jug").description, /Does not require attunement/);
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
