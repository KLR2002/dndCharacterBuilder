import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { enrichGrantFiles, stripGrantFiles } from "../src/grants/enrich.ts";
import type { InitiativeBonusOverride } from "../src/parser/initiative-bonuses.ts";
import { PROFICIENCY_GRANT_OVERRIDES } from "../src/overrides/proficiency-grants.ts";
import { INITIATIVE_BONUS_OVERRIDES } from "../src/overrides/initiative-bonuses.ts";

// Every name and sentence in this file is invented. The files use the tracked files' format:
// JSON.stringify with two-space indent and no trailing newline.

function canonical(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

const classes = [
  {
    name: "Sample Vanguard",
    source: "TST",
    hitDie: "1d8",
    features: [
      { name: "Quick Sense", level: 1, description: "Your senses are quick. You gain nothing else.", isOptional: false },
      { name: "Plain Step", level: 2, description: "You move without a sound. Nothing else changes.", isOptional: false },
    ],
    subclasses: [
      {
        name: "Sample Blade",
        source: "TST",
        features: [
          {
            name: "Sample Gambit",
            level: 3,
            description: "Once per turn you can give yourself a bonus to your initiative rolls equal to your Charisma modifier.",
          },
        ],
      },
    ],
  },
];

const original = { classes: canonical(classes), feats: canonical([]) };
const noOverrides = { classes: [], feats: [], initiativeBonuses: [] };

test("an ability Initiative Bonus is written on a class feature or subclass feature with clear prose, and only there", () => {
  const enriched = enrichGrantFiles(original, noOverrides);
  const [sample] = JSON.parse(enriched.classes);
  assert.deepEqual(sample.subclasses[0].features[0].initiativeBonus, { kind: "ability", ability: "cha" });
  assert.equal("initiativeBonus" in sample.features[0], false, "a feature with no initiative sentence gets no bonus");
  assert.equal("initiativeBonus" in sample.features[1], false, "a feature with no initiative sentence gets no bonus");
});

test("stripping enrichment removes the Initiative Bonus and gives back the original bytes", () => {
  const enriched = enrichGrantFiles(original, noOverrides);
  assert.notEqual(enriched.classes, original.classes, "the enrichment must add the bonus for this to mean anything");
  assert.deepEqual(stripGrantFiles(enriched), original);
});

test("enriching twice changes nothing the second time, for Initiative Bonuses too", () => {
  const once = enrichGrantFiles(original, noOverrides);
  assert.deepEqual(enrichGrantFiles(once, noOverrides), once);
});

test("a stale Initiative Bonus is removed when the prose no longer gives one", () => {
  const data = JSON.parse(original.classes);
  data[0].features[1].initiativeBonus = { kind: "ability", ability: "dex" };
  const enriched = enrichGrantFiles({ classes: canonical(data), feats: original.feats }, noOverrides);
  assert.equal("initiativeBonus" in JSON.parse(enriched.classes)[0].features[1], false);
});

test("an override supplies the Initiative Bonus for a feature the extractor cannot read, and names no grant", () => {
  const override: InitiativeBonusOverride = {
    owner: "Sample Vanguard",
    feature: "Quick Sense",
    level: 1,
    bonus: { kind: "ability", ability: "wis" },
  };
  const enriched = enrichGrantFiles(original, { classes: [], feats: [], initiativeBonuses: [override] });
  assert.deepEqual(JSON.parse(enriched.classes)[0].features[0].initiativeBonus, { kind: "ability", ability: "wis" });
});

test("an Initiative Bonus override that names a feature the files do not contain is an error", () => {
  const override: InitiativeBonusOverride = {
    owner: "Sample Vanguard",
    feature: "No Such Feature",
    level: 1,
    bonus: { kind: "ability", ability: "dex" },
  };
  assert.throws(
    () => enrichGrantFiles(original, { classes: [], feats: [], initiativeBonuses: [override] }),
    /initiative bonus override matches no feature/,
  );
});

test("the tracked class features carry the Initiative Bonuses their prose gives, and enriching them again changes nothing", () => {
  const tracked = {
    classes: fs.readFileSync(new URL("../data/classes.json", import.meta.url), "utf8"),
    feats: fs.readFileSync(new URL("../data/feats.json", import.meta.url), "utf8"),
  };
  const enriched = enrichGrantFiles(tracked, { ...PROFICIENCY_GRANT_OVERRIDES, initiativeBonuses: INITIATIVE_BONUS_OVERRIDES });
  assert.deepEqual(enriched, tracked);

  const byName = new Map<string, unknown>();
  for (const cls of JSON.parse(tracked.classes) as Array<{ name: string; subclasses: Array<{ name: string; features: Array<{ name: string; initiativeBonus?: unknown }> }>; features: Array<{ name: string; initiativeBonus?: unknown }> }>) {
    for (const feature of cls.features) byName.set(`${cls.name}/${feature.name}`, feature.initiativeBonus);
    for (const sub of cls.subclasses) for (const feature of sub.features) byName.set(`${cls.name}/${sub.name}/${feature.name}`, feature.initiativeBonus);
  }
  assert.deepEqual(byName.get("Rogue/Swashbuckler/Rakish Audacity"), { kind: "ability", ability: "cha" });
  assert.deepEqual(byName.get("Wizard/War Magic/Tactical Wit"), { kind: "ability", ability: "int" });
  assert.deepEqual(byName.get("Wizard/Chronurgy Magic/Temporal Awareness"), { kind: "ability", ability: "int" });
  assert.deepEqual(byName.get("Ranger/Gloom Stalker/Dread Ambusher"), { kind: "ability", ability: "wis" });
  assert.deepEqual(byName.get("Paladin/Oath of the Watchers/Aura of the Sentinel"), { kind: "proficiency" });

  const feats = JSON.parse(tracked.feats) as Array<{ name: string; initiativeBonus?: unknown }>;
  assert.deepEqual(feats.find((feat) => feat.name === "Alert")?.initiativeBonus, { kind: "flat", value: 5 });
});

test("a feat's Initiative Bonus is written on the feat, and stripping enrichment removes it", () => {
  const feats = canonical([
    { name: "Sample Sentry", source: "TST", description: "Always on the lookout. You gain a +3 bonus to initiative.", prerequisite: null },
  ]);
  const enriched = enrichGrantFiles({ classes: original.classes, feats }, noOverrides);
  assert.deepEqual(JSON.parse(enriched.feats)[0].initiativeBonus, { kind: "flat", value: 3 });
  assert.deepEqual(stripGrantFiles(enriched), { classes: original.classes, feats });
});

test("an override supplies the Initiative Bonus for a feat the extractor cannot read", () => {
  const feats = canonical([{ name: "Sample Chant", source: "TST", description: "Your voice carries. Nothing else changes.", prerequisite: null }]);
  const override: InitiativeBonusOverride = { owner: "Feat", feature: "Sample Chant", level: 0, bonus: { kind: "proficiency" } };
  const enriched = enrichGrantFiles({ classes: original.classes, feats }, { classes: [], feats: [], initiativeBonuses: [override] });
  assert.deepEqual(JSON.parse(enriched.feats)[0].initiativeBonus, { kind: "proficiency" });
});

// A race's traits, and a subrace's traits, in the tracked races file's shape. Names and sentences are invented.
const hopperRaces = [
  {
    name: "Sample Hopper",
    source: "TST",
    traits: [
      { name: "Quick Hop", description: "You can add your proficiency bonus to your initiative rolls." },
      { name: "Plain Trait", description: "Placeholder text." },
    ],
    subraces: [
      {
        name: "Hillward",
        source: "TST",
        raceName: "Sample Hopper",
        raceSource: "TST",
        traits: [{ name: "Sample Gift", description: "You add your Wisdom modifier to your initiative rolls." }],
      },
    ],
  },
];
const withRaces = { ...original, races: canonical(hopperRaces) };

test("a race trait and a subrace trait carry the Initiative Bonus their prose gives, and stripping enrichment removes it", () => {
  const enriched = enrichGrantFiles(withRaces, noOverrides);
  const [hopper] = JSON.parse(enriched.races ?? "[]");
  assert.deepEqual(hopper.traits[0].initiativeBonus, { kind: "proficiency" });
  assert.equal("initiativeBonus" in hopper.traits[1], false, "a trait with no initiative sentence gets no bonus");
  assert.deepEqual(hopper.subraces[0].traits[0].initiativeBonus, { kind: "ability", ability: "wis" });
  assert.deepEqual(stripGrantFiles(enriched), withRaces);
});

test("an override names a subrace trait by its race and subrace, and supplies its Initiative Bonus", () => {
  const override: InitiativeBonusOverride = {
    owner: "Sample Hopper/Hillward",
    feature: "Sample Gift",
    level: 0,
    bonus: { kind: "flat", value: 2 },
  };
  const enriched = enrichGrantFiles(withRaces, { classes: [], feats: [], initiativeBonuses: [override] });
  const [hopper] = JSON.parse(enriched.races ?? "[]");
  assert.deepEqual(hopper.subraces[0].traits[0].initiativeBonus, { kind: "flat", value: 2 });
});

test("an Initiative Bonus override that names a race trait the files do not contain is an error", () => {
  const override: InitiativeBonusOverride = { owner: "Sample Hopper", feature: "No Such Trait", level: 0, bonus: { kind: "proficiency" } };
  assert.throws(
    () => enrichGrantFiles(withRaces, { classes: [], feats: [], initiativeBonuses: [override] }),
    /initiative bonus override matches no feature/,
  );
});

test("the tracked race traits carry the Initiative Bonuses their prose gives, and enriching them again changes nothing", () => {
  const tracked = {
    classes: fs.readFileSync(new URL("../data/classes.json", import.meta.url), "utf8"),
    feats: fs.readFileSync(new URL("../data/feats.json", import.meta.url), "utf8"),
    races: fs.readFileSync(new URL("../data/races.json", import.meta.url), "utf8"),
  };
  const enriched = enrichGrantFiles(tracked, { ...PROFICIENCY_GRANT_OVERRIDES, initiativeBonuses: INITIATIVE_BONUS_OVERRIDES });
  assert.deepEqual(enriched, tracked);

  const races = JSON.parse(tracked.races) as Array<{ name: string; traits: Array<{ name: string; initiativeBonus?: unknown }> }>;
  const harengon = races.find((race) => race.name === "Harengon");
  assert.deepEqual(harengon?.traits.find((trait) => trait.name === "Hare-Trigger")?.initiativeBonus, { kind: "proficiency" });
});
