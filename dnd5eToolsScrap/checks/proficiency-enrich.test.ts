import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { enrichGrantFiles, stripGrantFiles } from "../src/grants/enrich.ts";
import type { GrantOverride } from "../src/parser/proficiency-grants.ts";
import { PROFICIENCY_GRANT_OVERRIDES } from "../src/overrides/proficiency-grants.ts";

// Every sentence and name in this file is invented. The files use the tracked files' format:
// JSON.stringify with two-space indent and no trailing newline.

function canonical(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

const classes = [
  {
    name: "Sample Class",
    source: "TST",
    hitDie: "1d8",
    features: [
      { name: "Lantern Training", level: 1, description: "You gain proficiency with lantern-maker's kit.", isOptional: false },
      { name: "Quiet Step", level: 2, description: "You move without a sound. Nothing else changes.", isOptional: false },
    ],
    subclasses: [
      {
        name: "Sample Path",
        source: "TST",
        features: [
          { name: "Mind Guard", level: 3, description: "Your mind grows sharp. You gain proficiency in all saving throws." },
        ],
      },
    ],
  },
];

const feats = [
  {
    name: "Sample Feat",
    source: "TST",
    description: "You gain proficiency with your choice of calligrapher's supplies or painter's supplies.",
  },
  {
    name: "Sample Feat Two",
    source: "TST",
    description: "You gain proficiency with these weapons if you don't already have them.",
  },
];

const original = { classes: canonical(classes), feats: canonical(feats) };
const noOverrides = { classes: [] as GrantOverride[], feats: [] as GrantOverride[] };

test("grants are added to class, subclass and feat features with clear prose, and only to those", () => {
  const enriched = enrichGrantFiles(original, noOverrides);
  const outClasses = JSON.parse(enriched.classes);
  const outFeats = JSON.parse(enriched.feats);

  const [sample] = outClasses;
  assert.deepEqual(sample.features[0].grants, [
    { id: "TST/Sample Class/Lantern Training@1#0", kind: "fixed", category: "tools", names: ["lantern-maker's kit"] },
  ]);
  assert.equal("grants" in sample.features[1], false, "a feature with no proficiency sentence gets no grants field");
  assert.deepEqual(sample.subclasses[0].features[0].grants, [
    { id: "TST/Sample Class/Sample Path/Mind Guard@3#0", kind: "fixed", category: "savingThrows", names: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"] },
  ]);
  assert.deepEqual(outFeats[0].grants, [
    {
      id: "TST/Feat/Sample Feat@0#0",
      kind: "choice",
      category: "tools",
      count: 1,
      pool: { kind: "names", names: ["calligrapher's supplies", "painter's supplies"] },
    },
  ]);
  assert.equal("grants" in outFeats[1], false, "a feat whose sentence cannot be parsed gets no grants field");
});

test("stripping grants gives back the original bytes", () => {
  const enriched = enrichGrantFiles(original, noOverrides);
  assert.notEqual(enriched.classes, original.classes, "the enrichment must actually add grants for this to mean anything");
  assert.deepEqual(stripGrantFiles(enriched), original);
});

test("enriching twice changes nothing the second time", () => {
  const once = enrichGrantFiles(original, noOverrides);
  const twice = enrichGrantFiles(once, noOverrides);
  assert.deepEqual(twice, once);
});

test("a stale grants field is removed when the prose no longer yields grants", () => {
  const stale = withStaleGrant();
  const enriched = enrichGrantFiles(stale, noOverrides);
  const quietStep = JSON.parse(enriched.classes)[0].features[1];
  assert.equal("grants" in quietStep, false);
});

test("an override supplies grants for a feature the extractor could not parse, names only", () => {
  const override: GrantOverride = {
    owner: "Feat",
    feature: "Sample Feat Two",
    level: 0,
    grants: [{ kind: "fixed", category: "armor", names: ["light armor"] }],
  };
  const enriched = enrichGrantFiles(original, { classes: [], feats: [override] });
  const [, featTwo] = JSON.parse(enriched.feats);
  assert.deepEqual(featTwo.grants, [{ id: "TST/Feat/Sample Feat Two@0#0", kind: "fixed", category: "armor", names: ["light armor"] }]);
});

test("an override that names a feature the files do not contain is an error", () => {
  const override: GrantOverride = {
    owner: "Sample Class",
    feature: "No Such Feature",
    level: 1,
    grants: [{ kind: "fixed", category: "armor", names: ["light armor"] }],
  };
  assert.throws(() => enrichGrantFiles(original, { classes: [override], feats: [] }), /matches no feature/);
});

test("the tracked files already carry the current overrides: enriching them again changes nothing", () => {
  const tracked = {
    classes: fs.readFileSync(new URL("../data/classes.json", import.meta.url), "utf8"),
    feats: fs.readFileSync(new URL("../data/feats.json", import.meta.url), "utf8"),
  };
  assert.deepEqual(enrichGrantFiles(tracked, PROFICIENCY_GRANT_OVERRIDES), tracked);
});

test("an override for a class the tracked files do not contain is an error, since they hold every class", () => {
  const override: GrantOverride = {
    owner: "Missing Class",
    feature: "Lantern Training",
    level: 1,
    grants: [{ kind: "fixed", category: "armor", names: ["light armor"] }],
  };
  assert.throws(() => enrichGrantFiles(original, { classes: [override], feats: [] }), /matches no feature/);
});

test("a file that is not in the tracked format is refused rather than rewritten", () => {
  const spaced = { classes: JSON.stringify(classes, null, 4), feats: original.feats };
  assert.throws(() => enrichGrantFiles(spaced, noOverrides), /canonical/);
  const trailingNewline = { classes: original.classes + "\n", feats: original.feats };
  assert.throws(() => enrichGrantFiles(trailingNewline, noOverrides), /canonical/);
});

function withStaleGrant(): { classes: string; feats: string } {
  const data = JSON.parse(original.classes);
  data[0].features[1].grants = [{ id: "TST/Sample Class/Quiet Step@2#0", kind: "fixed", category: "tools", names: ["old tools"] }];
  return { classes: canonical(data), feats: original.feats };
}
