import { test } from "node:test";
import assert from "node:assert/strict";
import { liftSpellChoice } from "../src/parser/spell-choice.ts";
import { scrapeClasses } from "../src/scrapers/classes.ts";
import type { SubclassAdditionalSpells } from "../src/types/models.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Placeholder shapes in the form parseAdditionalSpells emits. The structure is real; the spell
// names are invented.

// Land-style: one named entry per option, granting spells through `prepared` by spell level, with
// a `choose` filter alongside them that must not reach the description.
const LAND_STYLE: SubclassAdditionalSpells[] = [
  {
    name: "Arctic",
    known: { "1": { _: [{ choose: "level=0|class=Druid" }] } } as any,
    prepared: { "3": ["placeholder spell one", "placeholder spell two"], "5": ["placeholder spell three"] },
  },
  {
    name: "Coast",
    known: { "1": { _: [{ choose: "level=0|class=Druid" }] } } as any,
    prepared: { "3": ["placeholder spell four"], "5": ["placeholder spell five", "melf's acid arrow"] },
  },
];

// Affinity-style: named entries granting a `known` list, and an `expanded` list of `all` filters.
const AFFINITY_STYLE: SubclassAdditionalSpells[] = [
  {
    name: "Good",
    known: { "1": ["placeholder spell six"] },
    expanded: { "1": [{ all: "level=0|class=Cleric" }], "3": [{ all: "level=2|class=Cleric" }] } as any,
  },
  {
    name: "Evil",
    expanded: { "1": [{ all: "level=0|class=Cleric" }] } as any,
  },
];

// Genie-style: named entries granting `expanded` lists keyed by spell level, the top-level key
// being a plain number and the others `s`-prefixed.
const GENIE_STYLE: SubclassAdditionalSpells[] = [
  {
    name: "Dao",
    expanded: { "9": ["placeholder spell eight"], s1: ["placeholder spell nine", "placeholder spell ten"] } as any,
  },
  {
    name: "Djinni",
    expanded: { "9": ["placeholder spell eight"], s1: ["placeholder spell eleven"] } as any,
  },
];

// Giant-style: two unnamed entries, each granting exactly one cantrip through `innate`.
const GIANT_STYLE: SubclassAdditionalSpells[] = [
  { innate: { "3": ["placeholder cantrip alpha"] } as any },
  { innate: { "3": ["placeholder cantrip bravo"] } as any },
];

test("a land-style list of named entries lifts to one option per entry, with its spell names title-cased", () => {
  assert.deepEqual(liftSpellChoice(LAND_STYLE), {
    pick: 1,
    options: [
      {
        name: "Arctic",
        description: "Placeholder Spell One, Placeholder Spell Two, Placeholder Spell Three",
      },
      {
        name: "Coast",
        description: "Placeholder Spell Four, Placeholder Spell Five, Melf's Acid Arrow",
      },
    ],
  });
});

test("an affinity-style list lifts its `known` spells, and ignores `all` filter objects", () => {
  assert.deepEqual(liftSpellChoice(AFFINITY_STYLE), {
    pick: 1,
    options: [
      { name: "Good", description: "Placeholder Spell Six" },
      { name: "Evil", description: "" },
    ],
  });
});

test("a genie-style list lifts every `expanded` spell, whatever its level key", () => {
  assert.deepEqual(liftSpellChoice(GENIE_STYLE), {
    pick: 1,
    options: [
      { name: "Dao", description: "Placeholder Spell Eight, Placeholder Spell Nine, Placeholder Spell Ten" },
      { name: "Djinni", description: "Placeholder Spell Eight, Placeholder Spell Eleven" },
    ],
  });
});

test("a giant-style pair of unnamed innate entries lifts to one option per cantrip, with no description", () => {
  assert.deepEqual(liftSpellChoice(GIANT_STYLE), {
    pick: 1,
    options: [
      { name: "Placeholder Cantrip Alpha", description: "" },
      { name: "Placeholder Cantrip Bravo", description: "" },
    ],
  });
});

test("shapes that are not a choice lift to nothing", () => {
  assert.equal(liftSpellChoice(undefined), undefined);
  assert.equal(liftSpellChoice([]), undefined, "no entries");
  assert.equal(
    liftSpellChoice([LAND_STYLE[0]]),
    undefined,
    "a single named entry is not a choice",
  );
  assert.equal(
    liftSpellChoice([{ known: { "14": ["placeholder spell twelve"] } }]),
    undefined,
    "a lone unnamed entry is a flat grant, not a choice",
  );
  assert.equal(
    liftSpellChoice([
      { innate: { "3": { ritual: ["placeholder ritual"] } } as any },
      { innate: { "10": { ritual: ["placeholder ritual two"] } } as any },
    ]),
    undefined,
    "unnamed entries whose innate grants are not single cantrip names are not a choice",
  );
  assert.equal(
    liftSpellChoice([
      { innate: { "3": ["placeholder cantrip alpha", "placeholder cantrip bravo"] } as any },
      { innate: { "3": ["placeholder cantrip charlie"] } as any },
    ]),
    undefined,
    "an unnamed entry granting more than one cantrip is not a choice",
  );
});

test("the scraper sets spellChoice on a subclass whose additionalSpells lift to a choice", async () => {
  const raw = {
    class: [{ name: "Sorcerer", source: "PHB", hd: { number: 1, faces: 6 }, proficiency: ["con", "cha"], entries: [] }],
    subclass: [
      { name: "Placeholder Blood", shortName: "Placeholder Blood", source: "PHB", className: "Sorcerer", classSource: "PHB" },
      { name: "Placeholder Soul", shortName: "Placeholder Soul", source: "PHB", className: "Sorcerer", classSource: "PHB", additionalSpells: AFFINITY_STYLE },
    ],
  };
  const client = {
    fetchJson: async (endpoint: string) => {
      if (endpoint === "data/class/index.json") return { sorcerer: "class-sorcerer.json" };
      if (endpoint === "data/class/class-sorcerer.json") return raw;
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
  } as unknown as ToolsClient;

  const [sorcerer] = await scrapeClasses(client);
  const [blood, soul] = sorcerer.subclasses;
  assert.equal(blood.spellChoice, undefined, "a subclass without additionalSpells has no spellChoice");
  assert.deepEqual(soul.spellChoice, liftSpellChoice(AFFINITY_STYLE));
  assert.ok(soul.additionalSpells, "the raw additionalSpells are still emitted");
});
