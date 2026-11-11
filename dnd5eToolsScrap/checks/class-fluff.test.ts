import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeClasses } from "../src/scrapers/classes.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Invented classes and sentences in the raw 5e.tools shape. A class's description comes from its fluff file: the
// fluff item with the same name and source. Two prints of one class (2014 and 2024) each have their own item.

const SAMPLE_CLASS = {
  class: [
    { name: "Sample Knight", source: "AAA", hd: { number: 1, faces: 10 }, proficiency: ["str", "con"] },
    { name: "Sample Knight", source: "BBB", hd: { number: 1, faces: 10 }, proficiency: ["str", "con"] },
  ],
};

const SAMPLE_FLUFF = {
  classFluff: [
    { name: "Sample Knight", source: "AAA", entries: ["Placeholder text for the first print."] },
    {
      name: "Sample Knight",
      source: "BBB",
      entries: [
        {
          type: "section",
          name: "Sample Knight",
          entries: ["Placeholder text for the second print.", { type: "entries", name: "Sample Heading", entries: ["More placeholder text."] }],
        },
      ],
    },
  ],
  subclassFluff: [],
};

const LONE_CLASS = {
  class: [{ name: "Sample Lone", source: "AAA", hd: { number: 1, faces: 6 }, proficiency: ["int"] }],
};

const payloads: Record<string, unknown> = {
  "data/class/index.json": { knight: "class-knight.json", lone: "class-lone.json" },
  "data/class/class-knight.json": SAMPLE_CLASS,
  "data/class/class-lone.json": LONE_CLASS,
  "data/class/fluff-index.json": { knight: "fluff-class-knight.json" },
  "data/class/fluff-class-knight.json": SAMPLE_FLUFF,
};

function clientWith(overrides: Record<string, unknown> = {}): ToolsClient {
  const all = { ...payloads, ...overrides };
  return {
    fetchJson: async (endpoint: string) => {
      if (!(endpoint in all)) throw new Error(`unexpected endpoint ${endpoint}`);
      const value = all[endpoint];
      if (value instanceof Error) throw value;
      return value;
    },
  } as unknown as ToolsClient;
}

test("each print of a class takes the description of its own fluff item, and a class with no fluff item has none", async () => {
  const classes = await scrapeClasses(clientWith(), newProficiencyReport());
  const first = classes.find((cls) => cls.name === "Sample Knight" && cls.source === "AAA");
  const second = classes.find((cls) => cls.name === "Sample Knight" && cls.source === "BBB");
  const lone = classes.find((cls) => cls.name === "Sample Lone");

  assert.equal(first?.description, "Placeholder text for the first print.");
  assert.match(second?.description ?? "", /Placeholder text for the second print\./);
  assert.match(second?.description ?? "", /More placeholder text\./);
  assert.equal(lone?.description, "", "a class with no matching fluff item has an empty description");
});

test("a fluff index that fails to load leaves every class with an empty description, and the scrape still returns them", async () => {
  const classes = await scrapeClasses(
    clientWith({ "data/class/fluff-index.json": new Error("network down") }),
    newProficiencyReport()
  );
  assert.deepEqual(
    classes.map((cls) => [cls.name, cls.source, cls.description]),
    [
      ["Sample Knight", "AAA", ""],
      ["Sample Knight", "BBB", ""],
      ["Sample Lone", "AAA", ""],
    ]
  );
});

test("a fluff file that fails to load leaves its classes with an empty description", async () => {
  const classes = await scrapeClasses(
    clientWith({ "data/class/fluff-class-knight.json": new Error("not found") }),
    newProficiencyReport()
  );
  assert.equal(classes.length, 3);
  assert.ok(classes.every((cls) => cls.description === ""));
});
