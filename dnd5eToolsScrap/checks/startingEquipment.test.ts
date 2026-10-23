import { test } from "node:test";
import assert from "node:assert/strict";
import { newStartingEquipmentReport, parseStartingEquipment } from "../src/parser/starting-equipment.ts";
import { scrapeClasses } from "../src/scrapers/classes.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";
import type { ToolsClient } from "../src/types/models.ts";

// The raw `startingEquipment` shapes of a 5etools class record, with invented item names and sources.

test("a fixed slot keeps its item references: a name|source string, and an item with a quantity", () => {
  const result = parseStartingEquipment({
    defaultData: [{ _: ["Quill Knife|TST", { item: "Brass Tinderbox|TST", quantity: 2 }] }],
  });
  assert.deepEqual(result.unrecognised, []);
  assert.deepEqual(result.slots, [
    {
      kind: "fixed",
      entries: [
        { kind: "item", name: "Quill Knife", source: "TST", quantity: 1 },
        { kind: "item", name: "Brass Tinderbox", source: "TST", quantity: 2 },
      ],
    },
  ]);
});

test("a source is kept as the capitalised code the catalog uses", () => {
  const result = parseStartingEquipment({
    defaultData: [{ _: ["Quill Knife|tst", { item: "Brass Tinderbox|phb", quantity: 2 }] }],
  });
  assert.deepEqual(result.slots, [
    {
      kind: "fixed",
      entries: [
        { kind: "item", name: "Quill Knife", source: "TST", quantity: 1 },
        { kind: "item", name: "Brass Tinderbox", source: "PHB", quantity: 2 },
      ],
    },
  ]);
});

test("an item reference without a source names the PHB", () => {
  const result = parseStartingEquipment({ defaultData: [{ _: ["Quill Knife"] }] });
  assert.deepEqual(result.slots, [{ kind: "fixed", entries: [{ kind: "item", name: "Quill Knife", source: "PHB", quantity: 1 }] }]);
});

test("an a/b slot is a choice with one option per letter, in printed order", () => {
  const result = parseStartingEquipment({
    defaultData: [{ a: ["Gilded Spear|TST"], b: [{ item: "Tin Shield|TST", quantity: 2 }] }],
  });
  assert.deepEqual(result.unrecognised, []);
  assert.deepEqual(result.slots, [
    {
      kind: "choice",
      options: [
        { letter: "a", entries: [{ kind: "item", name: "Gilded Spear", source: "TST", quantity: 1 }] },
        { letter: "b", entries: [{ kind: "item", name: "Tin Shield", source: "TST", quantity: 2 }] },
      ],
    },
  ]);
});

test("an a/b/c slot with a multi-entry option keeps every entry of that option", () => {
  const result = parseStartingEquipment({
    defaultData: [
      {
        a: ["Gilded Spear|TST", "Field Pack|TST"],
        b: [{ equipmentType: "weaponMartial", quantity: 2 }],
        c: ["Reed Lamp|TST"],
      },
    ],
  });
  assert.deepEqual(result.unrecognised, []);
  assert.equal(result.slots[0].kind, "choice");
  const options = (result.slots[0] as { options: unknown[] }).options;
  assert.deepEqual(options, [
    {
      letter: "a",
      entries: [
        { kind: "item", name: "Gilded Spear", source: "TST", quantity: 1 },
        { kind: "item", name: "Field Pack", source: "TST", quantity: 1 },
      ],
    },
    { letter: "b", entries: [{ kind: "type", equipmentType: "weaponMartial", quantity: 2 }] },
    { letter: "c", entries: [{ kind: "item", name: "Reed Lamp", source: "TST", quantity: 1 }] },
  ]);
});

test("a generic entry names its type as printed and a missing quantity is one", () => {
  const result = parseStartingEquipment({
    defaultData: [{ a: [{ equipmentType: "focusSpellcastingArcane" }], b: [{ equipmentType: "instrumentMusical", quantity: 1 }] }],
  });
  assert.deepEqual(result.unrecognised, []);
  assert.deepEqual(result.slots, [
    {
      kind: "choice",
      options: [
        { letter: "a", entries: [{ kind: "type", equipmentType: "focusSpellcastingArcane", quantity: 1 }] },
        { letter: "b", entries: [{ kind: "type", equipmentType: "instrumentMusical", quantity: 1 }] },
      ],
    },
  ]);
});

test("slots keep their order: the slot index is the position in defaultData", () => {
  const result = parseStartingEquipment({
    defaultData: [{ _: ["Reed Lamp|TST"] }, { a: ["Gilded Spear|TST"], b: ["Tin Shield|TST"] }],
  });
  assert.deepEqual(
    result.slots.map((slot) => slot.kind),
    ["fixed", "choice"],
  );
});

test("an entry of an unrecognised shape is reported and kept in place, not dropped", () => {
  const result = parseStartingEquipment({
    defaultData: [{ _: ["Reed Lamp|TST", { item: "Glass Lens|TST", displayName: "lens" }, 7] }],
  });
  assert.equal(result.unrecognised.length, 2);
  assert.equal(result.slots.length, 1);
  const entries = (result.slots[0] as { entries: Array<{ kind: string }> }).entries;
  assert.deepEqual(
    entries.map((entry) => entry.kind),
    ["item", "unrecognised", "unrecognised"],
  );
});

test("a slot of an unrecognised shape is reported and kept in place, not dropped", () => {
  const result = parseStartingEquipment({
    defaultData: [{ _: ["Reed Lamp|TST"] }, { a: ["Gilded Spear|TST"] }, { "_": ["Field Pack|TST"], a: ["Tin Shield|TST"] }],
  });
  assert.equal(result.unrecognised.length, 2);
  assert.deepEqual(
    result.slots.map((slot) => slot.kind),
    ["fixed", "unrecognised", "unrecognised"],
  );
});

test("a 2024 kit form, with options keyed A to C and value entries, gets no slots and no report", () => {
  const result = parseStartingEquipment({
    defaultData: [{ A: [{ value: "Invented Kit|TST" }], B: [{ value: "Other Kit|TST" }] }],
  });
  assert.deepEqual(result.slots, []);
  assert.deepEqual(result.unrecognised, []);
});

test("a startingEquipment record with no defaultData is reported", () => {
  const result = parseStartingEquipment({ default: ["Invented text"] });
  assert.deepEqual(result.slots, []);
  assert.equal(result.unrecognised.length, 1);
});

test("a class record without startingEquipment yields no slots and no report", () => {
  const result = parseStartingEquipment(undefined);
  assert.deepEqual(result.slots, []);
  assert.deepEqual(result.unrecognised, []);
});

function fakeClient(classRecord: Record<string, unknown>): ToolsClient {
  const payloads: Record<string, unknown> = {
    "data/class/index.json": { "class-invented": "class-invented.json" },
    "data/class/class-invented.json": { class: [classRecord] },
  };
  return {
    fetchJson: async (endpoint: string) => {
      if (!(endpoint in payloads)) throw new Error(`no fixture for ${endpoint}`);
      return payloads[endpoint];
    },
  } as unknown as ToolsClient;
}

test("scrapeClasses puts the parsed slots on the class record", async () => {
  const classes = await scrapeClasses(
    fakeClient({
      name: "Invented",
      source: "TST",
      entries: [],
      startingEquipment: { defaultData: [{ _: ["Reed Lamp|TST"] }, { a: ["Gilded Spear|TST"], b: ["Tin Shield|TST"] }] },
    }),
    newProficiencyReport(),
    newStartingEquipmentReport(),
  );
  assert.deepEqual(classes[0].startingEquipment, [
    { kind: "fixed", entries: [{ kind: "item", name: "Reed Lamp", source: "TST", quantity: 1 }] },
    {
      kind: "choice",
      options: [
        { letter: "a", entries: [{ kind: "item", name: "Gilded Spear", source: "TST", quantity: 1 }] },
        { letter: "b", entries: [{ kind: "item", name: "Tin Shield", source: "TST", quantity: 1 }] },
      ],
    },
  ]);
});

test("scrapeClasses leaves startingEquipment off a class record that has none", async () => {
  const classes = await scrapeClasses(
    fakeClient({ name: "Invented", source: "TST", entries: [] }),
    newProficiencyReport(),
    newStartingEquipmentReport(),
  );
  assert.equal("startingEquipment" in classes[0], false);
});

test("scrapeClasses reports an unrecognised entry in the starting equipment report", async () => {
  const report = newStartingEquipmentReport();
  await scrapeClasses(
    fakeClient({
      name: "Invented",
      source: "TST",
      entries: [],
      startingEquipment: { defaultData: [{ _: [{ item: "Glass Lens|TST", displayName: "lens" }] }] },
    }),
    newProficiencyReport(),
    report,
  );
  assert.equal(report.unrecognised.length, 1);
  assert.equal(report.unrecognised[0].owner, "Invented");
});
