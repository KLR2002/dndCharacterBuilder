import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { enrichGrantFiles, stripGrantFiles } from "../src/grants/enrich.ts";
import { startingToolGrants, type GrantOverride } from "../src/parser/proficiency-grants.ts";
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
  assert.deepEqual(shapes(sample.features[0].grants), [
    { id: "TST/Sample Class/Lantern Training@1#tools:fixed:lantern-maker's kit", kind: "fixed", category: "tools", names: ["lantern-maker's kit"] },
  ]);
  assert.equal("grants" in sample.features[1], false, "a feature with no proficiency sentence gets no grants field");
  assert.deepEqual(shapes(sample.subclasses[0].features[0].grants), [
    { id: "TST/Sample Class/Sample Path/Mind Guard@3#savingThrows:fixed:Charisma,Constitution,Dexterity,Intelligence,Strength,Wisdom", kind: "fixed", category: "savingThrows", names: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"] },
  ]);
  assert.deepEqual(shapes(outFeats[0].grants), [
    {
      id: "TST/Feat/Sample Feat@0#tools:choice:from",
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
  assert.deepEqual(shapes(featTwo.grants), [{ id: "TST/Feat/Sample Feat Two@0#armor:fixed:light armor", kind: "fixed", category: "armor", names: ["light armor"] }]);
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

test("every tracked class's starting tool texts state their grants, so none is silently dropped", () => {
  const tracked = JSON.parse(fs.readFileSync(new URL("../data/classes.json", import.meta.url), "utf8")) as Array<{
    name: string;
    source: string;
    toolProficiencies: string[];
  }>;
  for (const cls of tracked) {
    const result = startingToolGrants(
      { source: cls.source, owner: cls.name, feature: "Starting Proficiencies", level: 1 },
      cls.toolProficiencies
    );
    assert.deepEqual(result.unparsed, [], `${cls.name} (${cls.source})`);
  }
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

test("two classes with one name from different sources enrich without error, and a subclass listed under both keeps its ids", () => {
  const subclass = {
    name: "Sample Path",
    source: "AAA",
    features: [{ name: "Mind Guard", level: 3, description: "Your mind grows sharp. You gain proficiency in all saving throws." }],
  };
  const twins = [
    {
      name: "Sample Twin",
      source: "AAA",
      hitDie: "1d8",
      features: [{ name: "Lantern Training", level: 1, description: "You gain proficiency with lantern-maker's kit.", isOptional: false }],
      subclasses: [subclass],
    },
    {
      name: "Sample Twin",
      source: "BBB",
      hitDie: "1d8",
      features: [{ name: "Lantern Training", level: 1, description: "You gain proficiency with lantern-maker's kit.", isOptional: false }],
      subclasses: [subclass],
    },
  ];
  const twinFiles = { classes: canonical(twins), feats: canonical([]) };
  const enriched = enrichGrantFiles(twinFiles, noOverrides);
  const [aaa, bbb] = JSON.parse(enriched.classes);
  assert.deepEqual(aaa.features[0].grants.map((g: { id: string }) => g.id), ["AAA/Sample Twin/Lantern Training@1#tools:fixed:lantern-maker's kit"]);
  assert.deepEqual(bbb.features[0].grants.map((g: { id: string }) => g.id), ["BBB/Sample Twin/Lantern Training@1#tools:fixed:lantern-maker's kit"]);
  for (const cls of [aaa, bbb]) {
    assert.deepEqual(cls.subclasses[0].features[0].grants.map((g: { id: string }) => g.id), ["AAA/Sample Twin/Sample Path/Mind Guard@3#savingThrows:fixed:Charisma,Constitution,Dexterity,Intelligence,Strength,Wisdom"]);
  }
  assert.deepEqual(stripGrantFiles(enriched), twinFiles);
});

test("a class's starting tool texts become its Starting Proficiencies grants, and stripping removes them", () => {
  const withTools = [
    {
      name: "Sample Tinker",
      source: "TST",
      hitDie: "1d8",
      toolProficiencies: ["lantern-maker's kit", "one type of artisan's tools of your choice"],
      features: [{ name: "Quiet Step", level: 2, description: "You move without a sound. Nothing else changes.", isOptional: false }],
      subclasses: [],
    },
    {
      name: "Sample Singer",
      source: "TST",
      hitDie: "1d8",
      toolProficiencies: ["two musical instruments of your choice"],
      features: [],
      subclasses: [],
    },
    { name: "Sample Fighter", source: "TST", hitDie: "1d10", toolProficiencies: [], features: [], subclasses: [] },
  ];
  const files = { classes: canonical(withTools), feats: canonical([]) };
  const enriched = enrichGrantFiles(files, noOverrides);
  const [tinker, singer, fighter] = JSON.parse(enriched.classes);
  assert.deepEqual(tinker.grants.map((g: { id: string }) => g.id), [
    "TST/Sample Tinker/Starting Proficiencies@1#tools:fixed:lantern-maker's kit",
    "TST/Sample Tinker/Starting Proficiencies@1#tools:choice:from",
  ]);
  assert.deepEqual(withoutAliases(tinker.grants[0]), {
    id: "TST/Sample Tinker/Starting Proficiencies@1#tools:fixed:lantern-maker's kit",
    kind: "fixed",
    category: "tools",
    names: ["lantern-maker's kit"],
  });
  assert.equal(tinker.grants[1].kind, "choice");
  assert.equal(tinker.grants[1].count, 1);
  assert.equal(singer.grants[0].count, 2);
  assert.equal("grants" in fighter, false, "a class with no starting tools gets no grants field");
  assert.deepEqual(stripGrantFiles(enriched), files);
});

/** The grants without their aliases: these tests compare what a rule grants; the alias tests check the aliases. */
function withoutAliases<T extends { aliases?: string[] }>(grant: T): Omit<T, "aliases"> {
  const { aliases: _aliases, ...rest } = grant;
  return rest;
}

function shapes<T extends { aliases?: string[] }>(grants: T[] | undefined): Omit<T, "aliases">[] {
  return (grants ?? []).map(withoutAliases);
}

function withStaleGrant(): { classes: string; feats: string } {
  const data = JSON.parse(original.classes);
  data[0].features[1].grants = [{ id: "TST/Sample Class/Quiet Step@2#0", kind: "fixed", category: "tools", names: ["old tools"] }];
  return { classes: canonical(data), feats: original.feats };
}

// A folded option is a feature of its own for grant purposes: its grants live on the option, and the
// enrichment owns them as it owns a feature's.
test("a folded option's grants are held on the option, enriched from its own text, and stripped with the rest", () => {
  const withOption = [
    {
      name: "Sample Class",
      source: "TST",
      hitDie: "1d8",
      features: [],
      subclasses: [
        {
          name: "Sample Path",
          source: "TST",
          features: [
            {
              name: "Sample Pick",
              level: 6,
              description: "Choose one option.",
              choices: {
                pick: 1,
                options: [
                  { name: "Plain Option", description: "Placeholder text.", source: "TST", level: 6 },
                  {
                    name: "Skilled Option",
                    description: "Placeholder text. You gain proficiency in two skills from the following list: Athletics, Stealth.",
                    source: "TST",
                    level: 6,
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ];
  const files = { classes: canonical(withOption), feats: canonical([]) };
  const enriched = enrichGrantFiles(files, noOverrides);
  const [cls] = JSON.parse(enriched.classes);
  const [plain, skilled] = cls.subclasses[0].features[0].choices.options;
  assert.equal("grants" in plain, false, "an option whose text grants nothing gets no grants field");
  assert.deepEqual(shapes(skilled.grants), [
    {
      id: "TST/Sample Class/Sample Path/Skilled Option@6#skills:choice:from",
      kind: "choice",
      category: "skills",
      count: 2,
      pool: { kind: "names", names: ["Athletics", "Stealth"] },
    },
  ]);
  assert.equal("grants" in cls.subclasses[0].features[0], false, "the parent's own text grants nothing");
  assert.deepEqual(stripGrantFiles(enriched), files);
});
