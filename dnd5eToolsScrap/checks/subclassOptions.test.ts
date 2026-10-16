import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeClasses } from "../src/scrapers/classes.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Placeholder records in the raw 5e.tools shape. The structure is real; the text is invented.

const OPTIONS: ReadonlyArray<readonly [name: string, source: string]> = [
  ["Bear", "PHB"],
  ["Eagle", "PHB"],
  ["Wolf", "PHB"],
  ["Elk", "SCAG"],
  ["Tiger", "SCAG"],
];

// A subclass ref: name|className|classSource|subclassShortName|subclassSource|level|featureSource.
// The option's own book is the last part, and only SCAG options carry it.
const subclassRef = (name: string, level: number, featureSource?: string) =>
  `${name}|Barbarian|PHB|Totem Warrior||${level}${featureSource ? `|${featureSource}` : ""}`;

const subclassRefs = (level: number) =>
  OPTIONS.map(([name, source]) => subclassRef(name, level, source === "PHB" ? undefined : source));

const subclassSibling = (name: string, level: number, source = "PHB") => ({
  name,
  source,
  className: "Barbarian",
  classSource: "PHB",
  subclassShortName: "Totem Warrior",
  subclassSource: "PHB",
  level,
  entries: [`Placeholder text for ${name} at level ${level}.`],
});

const subclassSiblings = (level: number) =>
  OPTIONS.map(([name, source]) => subclassSibling(name, level, source));

const subclassParent = (name: string, level: number, refs: string[]) => ({
  name,
  source: "PHB",
  className: "Barbarian",
  classSource: "PHB",
  subclassShortName: "Totem Warrior",
  subclassSource: "PHB",
  level,
  header: 2,
  entries: [
    `Placeholder prose for ${name}.`,
    { type: "options", count: 1, entries: refs.map((r) => ({ type: "refSubclassFeature", subclassFeature: r })) },
  ],
});

const subclassStub = (level: number, ref: string) => ({
  name: "Stub Feature",
  source: "PHB",
  className: "Barbarian",
  classSource: "PHB",
  subclassShortName: "Totem Warrior",
  subclassSource: "PHB",
  level,
  entries: [{ type: "refSubclassFeature", subclassFeature: ref }],
});

const classParent = {
  name: "Placeholder Pick",
  source: "PHB",
  className: "Barbarian",
  classSource: "PHB",
  level: 2,
  entries: [
    "Placeholder prose for Placeholder Pick.",
    {
      type: "options",
      count: 1,
      entries: [
        { type: "refClassFeature", classFeature: "Alpha|Barbarian||2" },
        { type: "refClassFeature", classFeature: "Beta|Barbarian|PHB|2|PHB" },
      ],
    },
  ],
};

const classSibling = (name: string) => ({
  name,
  source: "PHB",
  className: "Barbarian",
  classSource: "PHB",
  level: 2,
  entries: [`Placeholder text for ${name}.`],
});

const BARBARIAN_RAW = {
  class: [
    {
      name: "Barbarian",
      source: "PHB",
      hd: { number: 1, faces: 12 },
      proficiency: ["str", "con"],
      entries: [],
    },
  ],
  classFeature: [classParent, classSibling("Alpha"), classSibling("Beta")],
  subclass: [
    {
      name: "Path of the Totem Warrior",
      shortName: "Totem Warrior",
      source: "PHB",
      className: "Barbarian",
      classSource: "PHB",
    },
  ],
  subclassFeature: [
    subclassParent("Totem Spirit", 3, subclassRefs(3)),
    ...subclassSiblings(3),
    subclassParent("Aspect of the Beast", 6, subclassRefs(6)),
    ...subclassSiblings(6),
    subclassParent("Totemic Attunement", 14, subclassRefs(14)),
    ...subclassSiblings(14),
    // Hawk resolves, Ghost does not: the whole feature gets no choices and Hawk stays a loose feature.
    subclassParent("Unresolved Feature", 10, [subclassRef("Hawk", 10), subclassRef("Ghost", 10)]),
    subclassSibling("Hawk", 10),
    subclassStub(3, subclassRef("Totem Spirit", 3)),
  ],
};

function fakeClient(): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      if (endpoint === "data/class/index.json") return { barbarian: "class-barbarian.json" };
      if (endpoint === "data/class/class-barbarian.json") return BARBARIAN_RAW;
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
  } as unknown as ToolsClient;
}

async function scrapedBarbarian() {
  const [barbarian] = await scrapeClasses(fakeClient());
  const totem = barbarian.subclasses.find((sc) => sc.shortName === "Totem Warrior");
  assert.ok(totem, "Totem Warrior subclass is scraped");
  return { barbarian, totem };
}

const named = (features: { name: string }[], name: string) => {
  const found = features.find((f) => f.name === name);
  assert.ok(found, `${name} is scraped`);
  return found;
};

test("a subclass options entry becomes choices on its parent, with pick, option names and sources", async () => {
  const { totem } = await scrapedBarbarian();
  for (const parent of ["Totem Spirit", "Aspect of the Beast", "Totemic Attunement"]) {
    assert.ok(named(totem.features, parent).choices, `${parent} has choices`);
  }
  assert.deepEqual(named(totem.features, "Totem Spirit").choices, {
    pick: 1,
    options: [
      { name: "Bear", description: "Placeholder text for Bear at level 3.", source: "PHB" },
      { name: "Eagle", description: "Placeholder text for Eagle at level 3.", source: "PHB" },
      { name: "Wolf", description: "Placeholder text for Wolf at level 3.", source: "PHB" },
      { name: "Elk", description: "Placeholder text for Elk at level 3.", source: "SCAG" },
      { name: "Tiger", description: "Placeholder text for Tiger at level 3.", source: "SCAG" },
    ],
  });
  const attunement = named(totem.features, "Totemic Attunement").choices;
  assert.equal(attunement?.pick, 1);
  assert.deepEqual(
    attunement?.options?.map((o) => [o.name, o.source]),
    [["Bear", "PHB"], ["Eagle", "PHB"], ["Wolf", "PHB"], ["Elk", "SCAG"], ["Tiger", "SCAG"]]
  );
});

test("resolved option siblings are folded into their parent, and ref-only stubs are still skipped", async () => {
  const { totem } = await scrapedBarbarian();
  const names = totem.features.map((f) => f.name);
  assert.deepEqual(names.sort(), [
    "Aspect of the Beast",
    "Hawk",
    "Totem Spirit",
    "Totemic Attunement",
    "Unresolved Feature",
  ]);
});

test("the parent keeps its prose description unchanged", async () => {
  const { totem } = await scrapedBarbarian();
  assert.equal(
    named(totem.features, "Totem Spirit").description,
    "Placeholder prose for Totem Spirit.\n\n- **Bear**\n- **Eagle**\n- **Wolf**\n- **Elk**\n- **Tiger**"
  );
});

test("a feature whose refs do not all resolve gets no choices and keeps its siblings", async () => {
  const { totem } = await scrapedBarbarian();
  assert.equal(named(totem.features, "Unresolved Feature").choices, undefined);
  assert.equal(named(totem.features, "Hawk").description, "Placeholder text for Hawk at level 10.");
});

test("a class feature with refClassFeature options gets choices and folds its siblings", async () => {
  const { barbarian } = await scrapedBarbarian();
  const pick = named(barbarian.features, "Placeholder Pick");
  assert.deepEqual(pick.choices, {
    pick: 1,
    options: [
      { name: "Alpha", description: "Placeholder text for Alpha.", source: "PHB" },
      { name: "Beta", description: "Placeholder text for Beta.", source: "PHB" },
    ],
  });
  assert.deepEqual(barbarian.features.map((f) => f.name), ["Placeholder Pick"]);
});
