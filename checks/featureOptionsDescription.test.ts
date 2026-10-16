import { test } from "node:test";
import assert from "node:assert/strict";
import { describeClassFeature } from "../src/rules/featureOptions.ts";
import { loadSrdCatalog, loadTestCatalog } from "./testUtils.ts";
import type { ClassData, ClassFeatureData } from "../src/types/dnd5e.ts";

const FALLBACK = "A placeholder feature gained at level 3.";

const folded: ClassFeatureData = {
  name: "Placeholder Feature",
  level: 3,
  description: "Placeholder description.",
  choices: {
    pick: 1,
    options: [
      { name: "Placeholder Alpha", description: "Alpha text.", source: "PHB" },
      { name: "Placeholder Beta", description: "Beta text.", source: "SCAG" },
    ],
  },
};

test("a class feature lists its folded options under a Choose line", () => {
  assert.equal(
    describeClassFeature(folded, "PHB", ["PHB", "SCAG"], FALLBACK),
    [
      "Placeholder description.",
      "",
      "Choose 1:",
      "- **Placeholder Alpha**: Alpha text.",
      "- **Placeholder Beta**: Beta text.",
    ].join("\n")
  );
});

test("a subclass feature lists its folded options the same way, with the pick count", () => {
  const subclassFeature: ClassFeatureData = {
    name: "Placeholder Archetype Feature",
    level: 6,
    description: "Placeholder archetype text.",
    choices: {
      pick: 2,
      options: [
        { name: "Placeholder Gamma", description: "Gamma text.", source: "PHB" },
        { name: "Placeholder Delta", description: "Delta text.", source: "PHB" },
      ],
    },
  };
  assert.equal(
    describeClassFeature(subclassFeature, "PHB", ["PHB"], FALLBACK),
    [
      "Placeholder archetype text.",
      "",
      "Choose 2:",
      "- **Placeholder Gamma**: Gamma text.",
      "- **Placeholder Delta**: Delta text.",
    ].join("\n")
  );
});

test("an option from a book that is not active is not listed", () => {
  const text = describeClassFeature(folded, "PHB", ["PHB"], FALLBACK);
  assert.ok(text.includes("Placeholder Alpha"));
  assert.ok(!text.includes("Placeholder Beta"));
  assert.ok(!text.includes("Beta text."));
});

test("an option without a source is always listed", () => {
  const unsourced: ClassFeatureData = {
    ...folded,
    choices: { pick: 1, options: [{ name: "Placeholder Epsilon", description: "Epsilon text." }] },
  };
  assert.equal(
    describeClassFeature(unsourced, "PHB", [], FALLBACK),
    "Placeholder description.\n\nChoose 1:\n- **Placeholder Epsilon**: Epsilon text."
  );
});

test("a feature without choices renders exactly as before", () => {
  const plain: ClassFeatureData = { name: "Placeholder Plain", level: 1, description: "Plain text." };
  assert.equal(describeClassFeature(plain, "PHB", ["PHB"], FALLBACK), "Plain text.");

  const empty: ClassFeatureData = { name: "Placeholder Empty", level: 1, description: "" };
  assert.equal(describeClassFeature(empty, "PHB", ["PHB"], FALLBACK), FALLBACK);
});

test("a feature whose options are all from inactive books keeps its description", () => {
  const hidden: ClassFeatureData = {
    ...folded,
    choices: { pick: 1, options: [{ name: "Placeholder Beta", description: "Beta text.", source: "SCAG" }] },
  };
  assert.equal(describeClassFeature(hidden, "PHB", ["PHB"], FALLBACK), "Placeholder description.");
});

test("Dual-Mode: SRD features render unchanged, with no folded options", () => {
  const sources: [string, ClassData[]][] = [
    ["SRD Baseline", loadSrdCatalog<ClassData[]>("classes")],
    ["integrated catalog", loadTestCatalog<ClassData[]>("classes")],
  ];
  for (const [mode, classes] of sources) {
    for (const cls of classes) {
      const allFeatures = [...cls.features, ...cls.subclasses.flatMap((s) => s.features)];
      for (const feature of allFeatures) {
        if (feature.choices) continue;
        assert.equal(
          describeClassFeature(feature, cls.source, [cls.source], FALLBACK),
          feature.description || FALLBACK,
          `${mode}: ${cls.name} ${feature.name} changed`
        );
      }
    }
  }
  const srdClasses = loadSrdCatalog<ClassData[]>("classes");
  const srdFeatures = srdClasses.flatMap((c) => [...c.features, ...c.subclasses.flatMap((s) => s.features)]);
  assert.ok(srdFeatures.length > 0);
  assert.ok(srdFeatures.every((f) => !f.choices));
});
