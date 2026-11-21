import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeClasses } from "../src/scrapers/classes.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Every name and sentence in this file is invented. The progressions are invented numbers in the raw 5e.tools shape.

const CANTRIPS = Array.from({ length: 20 }, (_, i) => (i < 3 ? 2 : 3));
const SPELLS_KNOWN = Array.from({ length: 20 }, (_, i) => i + 2);
const SPELLBOOK = [6, ...Array.from({ length: 19 }, () => 2)];
const ONLY_CANTRIPS = Array.from({ length: 20 }, () => 4);
const SUBCLASS_CANTRIPS = Array.from({ length: 20 }, (_, i) => (i < 2 ? 0 : 2));
const SUBCLASS_SPELLS = Array.from({ length: 20 }, (_, i) => (i < 2 ? 0 : 3));

const SAMPLE_CLASSES = {
  class: [
    {
      name: "Sample Bard",
      source: "AAA",
      hd: { number: 1, faces: 8 },
      proficiency: ["dex", "cha"],
      spellcastingAbility: "cha",
      casterProgression: "full",
      cantripProgression: CANTRIPS,
      spellsKnownProgression: SPELLS_KNOWN,
    },
    {
      name: "Sample Wizard",
      source: "AAA",
      hd: { number: 1, faces: 6 },
      proficiency: ["int", "wis"],
      spellcastingAbility: "int",
      casterProgression: "full",
      cantripProgression: CANTRIPS,
      spellsKnownProgressionFixed: SPELLBOOK,
    },
    {
      name: "Sample Cleric",
      source: "AAA",
      hd: { number: 1, faces: 8 },
      proficiency: ["wis", "cha"],
      spellcastingAbility: "wis",
      casterProgression: "full",
      cantripProgression: ONLY_CANTRIPS,
    },
    {
      name: "Sample Fighter",
      source: "AAA",
      hd: { number: 1, faces: 10 },
      proficiency: ["str", "con"],
    },
  ],
  subclass: [
    {
      name: "Sample Knight of Arms",
      shortName: "Arms",
      source: "AAA",
      className: "Sample Fighter",
      classSource: "AAA",
      spellcastingAbility: "int",
      cantripProgression: SUBCLASS_CANTRIPS,
      spellsKnownProgression: SUBCLASS_SPELLS,
    },
  ],
};

const payloads: Record<string, unknown> = {
  "data/class/index.json": { sample: "class-sample.json" },
  "data/class/class-sample.json": SAMPLE_CLASSES,
  "data/class/fluff-index.json": {},
};

function clientWith(): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      if (!(endpoint in payloads)) throw new Error(`unexpected endpoint ${endpoint}`);
      return payloads[endpoint];
    },
  } as unknown as ToolsClient;
}

test("a class with cantrip and spells-known progressions carries both counts, and no spellbook count", async () => {
  const classes = await scrapeClasses(clientWith(), newProficiencyReport());
  const bard = classes.find((cls) => cls.name === "Sample Bard");
  assert.deepEqual(bard?.spellcasting, {
    ability: "Charisma",
    progression: "full",
    preparedSpells: undefined,
    cantripsKnown: CANTRIPS,
    spellsKnown: SPELLS_KNOWN,
  });
  assert.equal("spellbookSpellsGained" in (bard?.spellcasting ?? {}), false);
});

test("a wizard-like class carries its spellbook count, with the cantrip count", async () => {
  const classes = await scrapeClasses(clientWith(), newProficiencyReport());
  const wizard = classes.find((cls) => cls.name === "Sample Wizard");
  assert.deepEqual(wizard?.spellcasting?.spellbookSpellsGained, SPELLBOOK);
  assert.deepEqual(wizard?.spellcasting?.cantripsKnown, CANTRIPS);
  assert.equal("spellsKnown" in (wizard?.spellcasting ?? {}), false);
});

test("a cleric-like class with only a cantrip progression has no spells-known count", async () => {
  const classes = await scrapeClasses(clientWith(), newProficiencyReport());
  const cleric = classes.find((cls) => cls.name === "Sample Cleric");
  assert.deepEqual(cleric?.spellcasting?.cantripsKnown, ONLY_CANTRIPS);
  assert.equal("spellsKnown" in (cleric?.spellcasting ?? {}), false);
  assert.equal("spellbookSpellsGained" in (cleric?.spellcasting ?? {}), false);
});

test("a subclass with cantrip and spells-known progressions carries both counts", async () => {
  const classes = await scrapeClasses(clientWith(), newProficiencyReport());
  const fighter = classes.find((cls) => cls.name === "Sample Fighter");
  const [subclass] = fighter?.subclasses ?? [];
  assert.equal(subclass?.name, "Sample Knight of Arms");
  assert.deepEqual(subclass?.cantripsKnown, SUBCLASS_CANTRIPS);
  assert.deepEqual(subclass?.spellsKnown, SUBCLASS_SPELLS);
});

test("a class with no spellcasting ability has no spellcasting object to carry counts", async () => {
  const classes = await scrapeClasses(clientWith(), newProficiencyReport());
  const fighter = classes.find((cls) => cls.name === "Sample Fighter");
  assert.equal(fighter?.spellcasting, null);
});
