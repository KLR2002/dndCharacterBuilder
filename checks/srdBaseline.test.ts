import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { applySrdNames, pruneClasses } from "../scripts/srdBaseline.ts";
import type { ClassData, SubclassData } from "../src/types/dnd5e.ts";
import { DEFAULT_ACTIVE_BOOK_CODES } from "../src/constants/books.ts";
import { classChoicesStepView } from "../src/rules/classChoices.ts";
import { describeClassFeature } from "../src/rules/featureOptions.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { integratedTestCompendium, loadSrdCatalog, makeChar, srdBaselineCompendium } from "./testUtils.ts";

function rawClass(overrides: Partial<ClassData>): ClassData {
  return {
    name: "Barbarian",
    source: "PHB",
    hitDie: "d12",
    primaryAbility: ["str"],
    savingThrows: ["str", "con"],
    armorProficiencies: [],
    weaponProficiencies: [],
    toolProficiencies: [],
    skillProficiencies: { choose: 2, from: ["Placeholder Skill"] },
    spellcasting: null,
    features: [],
    subclasses: [],
    description: "Placeholder class prose.",
    ...overrides,
  };
}

function rawSubclass(overrides: Partial<SubclassData>): SubclassData {
  return {
    name: "Berserker",
    shortName: "Berserker",
    source: "PHB",
    className: "Barbarian",
    classSource: "PHB",
    features: [],
    description: "",
    ...overrides,
  };
}

test("a class description becomes empty, since the PHB intro prose is not SRD", () => {
  const [pruned] = pruneClasses([rawClass({ description: "Placeholder class prose." })]);
  assert.equal(pruned.description, "");
});

test("a non-SRD subclass is dropped and the kept subclass and class carry source SRD", () => {
  const [pruned] = pruneClasses([
    rawClass({
      subclasses: [
        rawSubclass({ name: "Berserker", shortName: "Berserker" }),
        rawSubclass({ name: "Placeholder Zealot", shortName: "Zealot" }),
      ],
    }),
  ]);
  assert.equal(pruned.source, "SRD");
  assert.deepEqual(
    pruned.subclasses.map((sc) => [sc.name, sc.source]),
    [["Berserker", "SRD"]],
  );
});

test("a class that is not in the SRD is dropped", () => {
  const pruned = pruneClasses([rawClass({ name: "Placeholder Class" })]);
  assert.deepEqual(pruned, []);
});

test("a folded feature option and a spellChoice option become source SRD", () => {
  const [pruned] = pruneClasses([
    rawClass({
      features: [
        {
          name: "Placeholder Pick",
          level: 3,
          description: "Placeholder pick text.",
          choices: {
            pick: 1,
            options: [
              { name: "Placeholder Alpha", description: "Alpha text.", source: "PHB" },
              { name: "Placeholder Beta", description: "Beta text.", source: "PHB" },
            ],
          },
        },
      ],
      subclasses: [
        rawSubclass({
          spellChoice: {
            pick: 1,
            options: [{ name: "Placeholder Gamma", description: "Gamma text.", source: "PHB" }],
          },
        }),
      ],
    }),
  ]);

  const folded = pruned.features[0].choices?.options ?? [];
  assert.deepEqual(
    folded.map((o) => o.source),
    ["SRD", "SRD"],
  );
  const spellOptions = pruned.subclasses[0].spellChoice?.options ?? [];
  assert.deepEqual(
    spellOptions.map((o) => o.source),
    ["SRD"],
  );
});

/** The SRD Baseline's Compendium, read with DEFAULT_ACTIVE_BOOK_CODES. */
const srd = srdBaselineCompendium();
const books = DEFAULT_ACTIVE_BOOK_CODES;

function srdRanger(level: number) {
  return makeChar({ classes: [{ className: "Ranger", source: "SRD", level, subclassName: "Hunter" }] });
}

describe("The regenerated SRD Baseline offers the SRD Hunter's choices", () => {
  test("an SRD Ranger 3 Hunter is offered one Hunter's Prey pick of the three SRD options", () => {
    const view = classChoicesStepView(srdRanger(3), { compendium: srd, activeBooks: books });
    const prey = view.cards.other.filter((choice) => choice.traitName === "Hunter's Prey");
    assert.equal(prey.length, 1);
    assert.equal(prey[0].choose, 1);
    assert.deepEqual(
      prey[0].options.map((option) => option.name),
      ["Colossus Slayer", "Giant Killer", "Horde Breaker"],
    );
  });

  test("an SRD Ranger 7 Hunter also gets Defensive Tactics", () => {
    const view = classChoicesStepView(srdRanger(7), { compendium: srd, activeBooks: books });
    const traits = view.cards.other.map((choice) => choice.traitName);
    assert.ok(traits.includes("Hunter's Prey"));
    assert.ok(traits.includes("Defensive Tactics"));
  });

  test("an SRD Ranger 15 Hunter is offered one pick at each of the four Hunter tiers", () => {
    const view = classChoicesStepView(srdRanger(15), { compendium: srd, activeBooks: books });
    const traits = view.cards.other.map((choice) => choice.traitName);
    assert.deepEqual(
      ["Hunter's Prey", "Defensive Tactics", "Multiattack", "Superior Hunter's Defense"].map((trait) => traits.includes(trait)),
      [true, true, true, true],
    );
  });

  test("the Features tab text for Hunter's Prey lists the three SRD options", () => {
    const classes = loadSrdCatalog<ClassData[]>("classes");
    const ranger = classes.find((c) => c.name === "Ranger");
    const feature = ranger?.subclasses.find((s) => s.name === "Hunter")?.features.find((f) => f.name === "Hunter's Prey");
    assert.ok(feature, "the SRD Hunter has a Hunter's Prey feature");
    assert.equal(
      describeClassFeature(feature, "SRD", DEFAULT_ACTIVE_BOOK_CODES, "fallback"),
      [
        feature.description,
        "",
        "Choose 1:",
        "- **Colossus Slayer**: " + feature.choices?.options?.[0].description,
        "- **Giant Killer**: " + feature.choices?.options?.[1].description,
        "- **Horde Breaker**: " + feature.choices?.options?.[2].description,
      ].join("\n"),
    );
  });

  test("a saved SRD Ranger 5 Hunter loads, reconciles, and has its Hunter's Prey pick pending", () => {
    const classes = loadSrdCatalog<ClassData[]>("classes");
    const saved = JSON.parse(JSON.stringify(srdRanger(5)));
    const migrated = migrateCharacter(saved, undefined, classes, DEFAULT_ACTIVE_BOOK_CODES);
    const reconciled = reconcile(migrated, srd, { activeBooks: DEFAULT_ACTIVE_BOOK_CODES });

    const view = classChoicesStepView(reconciled, { compendium: srd, activeBooks: DEFAULT_ACTIVE_BOOK_CODES });
    const prey = view.cards.other.find((choice) => choice.traitName === "Hunter's Prey");
    assert.ok(prey, "Hunter's Prey is offered to the saved Ranger 5");
    const picked = (reconciled.ruleChoices ?? []).find((entry) => entry.id === prey.id)?.picked ?? [];
    assert.deepEqual(picked, []);
    assert.equal(view.complete, false);
  });

  test("an SRD Druid's Circle of the Land Biome lists its SRD options while only PHB is active", () => {
    const druid = makeChar({ classes: [{ className: "Druid", source: "SRD", level: 2, subclassName: "Circle of the Land" }] });
    const view = classChoicesStepView(druid, { compendium: srd, activeBooks: ["PHB"] });
    const biome = view.cards.other.find((choice) => choice.traitName === "Circle of the Land: Biome");
    assert.ok(biome, "the Biome pick is offered");
    assert.ok(biome.options.some((option) => option.name === "Arctic"));
  });

  test("an integrated PHB Ranger 3 Hunter is offered the same Hunter's Prey pick, with its PHB options", () => {
    const ranger = makeChar({ classes: [{ className: "Ranger", source: "PHB", level: 3, subclassName: "Hunter" }] });
    const view = classChoicesStepView(ranger, { compendium: integratedTestCompendium(), activeBooks: ["PHB"] });
    const prey = view.cards.other.filter((choice) => choice.traitName === "Hunter's Prey");
    assert.equal(prey.length, 1);
    assert.deepEqual(
      prey[0].options.map((option) => option.name),
      ["Colossus Slayer", "Giant Killer", "Horde Breaker"],
    );
  });
});

describe("The SRD names of spells and items", () => {
  test("a renamed record takes its SRD name, and every reference to its old name is rewritten", () => {
    const input = {
      spells: [{ name: "Placeholder Bolt", source: "PHB", srdName: "Plain Bolt", description: "Placeholder bolt text." }],
      classes: [
        {
          name: "Placeholder Class",
          description: "Casts {@spell Placeholder Bolt} at will.",
          subclasses: [
            {
              name: "Placeholder Sub",
              additionalSpells: [{ known: { "1": ["Placeholder bolt"] } }],
              spellChoice: { pick: 1, options: [{ name: "Placeholder Bolt", description: "Bolt text.", source: "SRD" }] },
            },
          ],
        },
      ],
    };

    const renamed = applySrdNames(input);

    const [spell] = renamed.spells as { name: string; srdName?: string }[];
    assert.equal(spell.name, "Plain Bolt");
    assert.equal("srdName" in spell, false, "the SRD name is dropped from the baseline record");

    const [klass] = renamed.classes as {
      description: string;
      subclasses: { additionalSpells: { known: Record<string, string[]> }[]; spellChoice: { options: { name: string }[] } }[];
    }[];
    assert.equal(klass.description, "Casts {@spell Plain Bolt} at will.");
    assert.deepEqual(klass.subclasses[0].additionalSpells[0].known["1"], ["plain bolt"], "a sentence-case list reference is written in lower case");
    assert.equal(klass.subclasses[0].spellChoice.options[0].name, "Plain Bolt");
  });

  test("the input is not changed", () => {
    const input = { spells: [{ name: "Placeholder Bolt", srdName: "Plain Bolt" }] };
    applySrdNames(input);
    assert.deepEqual(input, { spells: [{ name: "Placeholder Bolt", srdName: "Plain Bolt" }] });
  });

  test("the tracked scraper records with an SRD name are renamed in the SRD Baseline, with no old name left in src/data", () => {
    const renamed = scraperRecordsWithSrdName();
    assert.ok(renamed.length > 0, "the scraper data names some SRD records");
    const dataFiles = readTextFiles(new URL("../src/data/", import.meta.url).pathname);
    for (const { file, oldName, srdName } of renamed) {
      assert.ok(
        loadBaseline(file).some((record) => record.name === srdName),
        `the SRD Baseline's ${file} has a record named ${srdName}`,
      );
      for (const [path, text] of dataFiles) {
        assert.equal(text.toLowerCase().includes(oldName.toLowerCase()), false, `${path} has no ${oldName}`);
      }
    }
  });

  test("no file under src/ contains an old SRD name", () => {
    const oldNames = scraperRecordsWithSrdName().map((record) => record.oldName.toLowerCase());
    for (const [path, text] of readTextFiles(new URL("../src/", import.meta.url).pathname)) {
      const lower = text.toLowerCase();
      for (const oldName of oldNames) {
        assert.equal(lower.includes(oldName), false, `${path} has no ${oldName}`);
      }
    }
  });
});

/** The scraper's spell and item records whose 5e.tools `srd` field names an SRD record, with the names each has. */
function scraperRecordsWithSrdName(): { file: string; oldName: string; srdName: string }[] {
  return ["spells", "items"].flatMap((file) =>
    (loadJson(new URL(`../dnd5eToolsScrap/data/${file}.json`, import.meta.url)) as { name: string; srdName?: string }[])
      .filter((record) => record.srdName)
      .map((record) => ({ file, oldName: record.name, srdName: record.srdName as string })),
  );
}

function loadBaseline(file: string): { name: string }[] {
  return loadJson(new URL(`../src/data/${file}.json`, import.meta.url)) as { name: string }[];
}

function loadJson(url: URL): unknown {
  return JSON.parse(readFileSync(url, "utf8"));
}

/** Every text file under a folder as [path, text], the files an SRD name could appear in. */
function readTextFiles(folder: string): [string, string][] {
  return readdirSync(folder).flatMap((entry): [string, string][] => {
    const path = `${folder}${entry}`;
    if (statSync(path).isDirectory()) return readTextFiles(`${path}/`);
    return /\.(json|ts|tsx|mjs|js)$/.test(entry) ? [[path, readFileSync(path, "utf8")]] : [];
  });
}
