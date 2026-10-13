import test from "node:test";
import assert from "node:assert/strict";
import { scrapeConditions } from "../src/scrapers/conditions.js";
import type { ToolsClient } from "../src/client.js";

test("scrapeConditions parses conditions and statuses cleanly with markdown descriptions", async () => {
  const mockClient = {
    fetchJson: async (endpoint: string) => {
      assert.equal(endpoint, "data/conditionsdiseases.json");
      return {
        condition: [
          {
            name: "Blinded",
            source: "PHB",
            entries: [
              "A blinded creature can't see and automatically fails any ability check that requires sight.",
              "Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage.",
            ],
          },
          {
            name: "Invisible",
            source: "PHB",
            entries: [
              "An invisible creature is impossible to see without the aid of magic or a special sense.",
            ],
          },
        ],
        status: [
          {
            name: "Concentration",
            source: "PHB",
            entries: ["Normal activity, such as moving and attacking, doesn't interfere with concentration."],
          },
        ],
      };
    },
  } as unknown as ToolsClient;

  const result = await scrapeConditions(mockClient);
  assert.equal(result.length, 3);
  assert.equal(result[0].name, "Blinded");
  assert.equal(result[0].source, "PHB");
  assert.ok(result[0].description.includes("A blinded creature"));
  assert.equal(result[1].name, "Concentration");
  assert.equal(result[2].name, "Invisible");
});
