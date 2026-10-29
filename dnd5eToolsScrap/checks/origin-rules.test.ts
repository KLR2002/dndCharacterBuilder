import test from "node:test";
import assert from "node:assert/strict";
import { scrapeOriginRules } from "../src/scrapers/origin-rules.js";
import type { ToolsClient } from "../src/client.js";

// Invented fixture in the shape of data/variantrules.json. Names follow the source's structure; cell phrases are
// invented and use only the kind keywords.
const RECORD_NAME = "Customizing Your Origin";

function swapTable(rows: unknown[][]) {
  return {
    type: "table",
    caption: "Proficiency Swaps",
    colLabels: ["Proficiency", "Replacement Proficiency"],
    rows,
  };
}

function ruleRecord(table: unknown, overrides: { name?: string; source?: string } = {}) {
  return {
    name: overrides.name ?? RECORD_NAME,
    source: overrides.source ?? "TCE",
    page: 1,
    ruleType: "O",
    type: "section",
    entries: [
      { type: "entries", name: "Ability Score Increases", entries: ["An invented sentence about increases."] },
      {
        type: "entries",
        name: "Proficiencies",
        entries: ["An invented sentence about proficiencies.", table],
      },
    ],
  };
}

function clientReturning(variantrules: unknown): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      assert.equal(endpoint, "data/variantrules.json");
      return variantrules;
    },
  } as unknown as ToolsClient;
}

test("scrapeOriginRules turns the Proficiency Swaps table into structured rows with no prose", async () => {
  const data = {
    variantrule: [
      { name: "Some Other Rule", source: "TCE", type: "section", entries: [] },
      ruleRecord(
        swapTable([
          ["Skill", "Skill or tool"],
          ["Tool", "Simple/martial weapon"],
          ["Armor", "Armor or tool"],
          ["Simple weapon", "Martial weapon or skill"],
        ]),
      ),
    ],
  };

  const result = await scrapeOriginRules(clientReturning(data));

  assert.deepEqual(result, [
    {
      name: RECORD_NAME,
      source: "TCE",
      proficiencySwaps: [
        { from: "skill", to: ["skill", "tool"] },
        { from: "tool", to: ["simple weapon", "martial weapon"] },
        { from: "armor", to: ["armor", "tool"] },
        { from: "simple weapon", to: ["martial weapon", "skill"] },
      ],
    },
  ]);
});

test("scrapeOriginRules fails when the record is missing, including a same-name record from another source", async () => {
  const data = {
    variantrule: [ruleRecord(swapTable([["Skill", "Skill"]]), { source: "ZZZ" })],
  };

  await assert.rejects(scrapeOriginRules(clientReturning(data)), /Customizing Your Origin/);
});

test("scrapeOriginRules fails when the Proficiency Swaps table is missing", async () => {
  const data = {
    variantrule: [
      ruleRecord({ type: "table", caption: "Some Other Table", colLabels: [], rows: [["Skill", "Skill"]] }),
    ],
  };

  await assert.rejects(scrapeOriginRules(clientReturning(data)), /Proficiency Swaps/);
});

test("scrapeOriginRules fails when a cell is not a recognised proficiency kind", async () => {
  const data = {
    variantrule: [ruleRecord(swapTable([["Skill", "Skill"], ["Spellcasting focus", "Tool"]]))],
  };

  await assert.rejects(scrapeOriginRules(clientReturning(data)), /Unrecognised proficiency cell/);
});
