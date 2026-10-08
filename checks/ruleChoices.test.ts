import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import {
  availableRuleChoices,
  availableSubclassRuleChoices,
  pickSubclassRuleChoice,
  ruleChoiceId,
  subclassRuleChoices,
  toggleSubclassRuleChoice,
  type Character,
} from "../src/rules/ruleChoices.ts";
import { makeChar } from "./testUtils.ts";

const races = JSON.parse(readFileSync(new URL("../src/data/races.json", import.meta.url), "utf8"));
const catalog = { races };

const raceChar = (name: string, source: string, subrace?: { name: string; source: string }): Character =>
  makeChar({ race: { name, source, subraceName: subrace?.name, subraceSource: subrace?.source } });

test("a character's rule choices are keyed by source first, so same-named ancestries stay distinct", () => {
  const id = ruleChoiceId({ source: "MTF", race: "Elf", subrace: { name: "Eladrin", source: "MTF" }, trait: "Fey Step" });
  assert.ok(id.startsWith("MTF__Elf__Eladrin__Fey Step"), `unexpected id shape: ${id}`);
});

test("an aasimar's revelation is available as one pick from three at third level", () => {
  const available = availableRuleChoices(raceChar("Aasimar", "MPMM"), races, 1);
  assert.equal(available.length, 0, "the revelation is not available at first level");

  const atThree = availableRuleChoices(raceChar("Aasimar", "MPMM"), races, 3);
  assert.equal(atThree.length, 1);
  assert.equal(atThree[0].id, ruleChoiceId({ source: "MPMM", race: "Aasimar", subrace: null, trait: "Celestial Revelation" }));
  assert.equal(atThree[0].choose, 1);
  assert.deepEqual(atThree[0].options.map((o) => o.name), ["Necrotic Shroud", "Radiant Consumption", "Radiant Soul"]);
  assert.equal(atThree[0].replaces, undefined);
});

test("an eladrin's season is available from first level but its effect waits for third", () => {
  const atOne = availableRuleChoices(raceChar("Eladrin", "MPMM"), races, 1);
  assert.equal(atOne.length, 1);
  assert.equal(atOne[0].level, 1);
  assert.equal(atOne[0].effectLevel, 3);
  assert.deepEqual(atOne[0].options.map((o) => o.name), ["Autumn", "Winter", "Spring", "Summer"]);
});

test("a variant half-elf's descent feature is available from first level and records what it replaces", () => {
  const available = availableRuleChoices(
    raceChar("Half-Elf", "PHB", { name: "Drow Descent", source: "SCAG" }),
    races,
    1
  );
  assert.equal(available.length, 1);
  assert.equal(available[0].replaces, "Skill Versatility");
  assert.deepEqual(available[0].options.map((o) => o.name), ["Skill Versatility", "Drow Magic"]);
});

test("ancestries with no rule choice offer none", () => {
  assert.deepEqual(availableRuleChoices(raceChar("Goliath", "VGM"), races, 20), []);
  assert.deepEqual(availableRuleChoices(makeChar(), races, 20), []);
});

test("choices are offered only when their source book is active", () => {
  const activeBooks = ["PHB", "MPMM"];
  assert.equal(availableRuleChoices(raceChar("Aasimar", "MPMM"), races, 3, activeBooks).length, 1);
  assert.equal(availableRuleChoices(raceChar("Aasimar", "MPMM"), races, 3, ["PHB"]).length, 0);
});

test("a character without recorded choices migrates without error and defaults to none", () => {
  const legacy = JSON.parse(JSON.stringify({ ...makeChar(), ruleChoices: undefined }));
  delete legacy.ruleChoices;
  const migrated = migrateCharacter(legacy, races);
  assert.deepEqual(migrated.ruleChoices, []);
});

test("a variant half-elf with no recorded choice is flagged for review", () => {
  // A real 1st-level character: the descent choice unlocks at first level, so it
  // is legitimately flaggable.
  const legacy = JSON.parse(
    JSON.stringify({
      ...raceChar("Half-Elf", "PHB", { name: "Drow Descent", source: "SCAG" }),
      classes: [{ className: "Wizard", source: "PHB", level: 1 }],
    })
  );
  delete legacy.ruleChoices;
  const migrated = migrateCharacter(legacy, races);
  assert.ok(
    (migrated.needsReview ?? []).some((m) => m.includes("ruleChoices")),
    `expected a ruleChoices review flag, got ${JSON.stringify(migrated.needsReview)}`
  );
});

test("a character whose only choice is not yet unlocked is not flagged", () => {
  // A first-level MPMM aasimar cannot make its Revelation yet, so flagging it
  // would leave a permanent review notice with nothing to do about it.
  const legacy = JSON.parse(
    JSON.stringify({
      ...raceChar("Aasimar", "MPMM"),
      classes: [{ className: "Cleric", source: "PHB", level: 1 }],
    })
  );
  delete legacy.ruleChoices;
  const migrated = migrateCharacter(legacy, races);
  assert.equal(
    (migrated.needsReview ?? []).some((m) => m.includes("ruleChoices")),
    false,
    "a locked choice is not a missing one"
  );
});

test("an unlocked aasimar revelation with no pick is flagged", () => {
  const legacy = JSON.parse(
    JSON.stringify({
      ...raceChar("Aasimar", "MPMM"),
      classes: [{ className: "Cleric", source: "PHB", level: 3 }],
    })
  );
  delete legacy.ruleChoices;
  const migrated = migrateCharacter(legacy, races);
  assert.ok((migrated.needsReview ?? []).some((m) => m.includes("ruleChoices")));
});

test("a character with no ancestry rule choice is not flagged", () => {
  const legacy = JSON.parse(JSON.stringify(raceChar("Goliath", "VGM")));
  delete legacy.ruleChoices;
  const migrated = migrateCharacter(legacy, races);
  assert.equal((migrated.needsReview ?? []).some((m) => m.includes("ruleChoices")), false);
});

test("an aasimar who already chose a revelation is not flagged", () => {
  const id = ruleChoiceId({ source: "MPMM", race: "Aasimar", subrace: null, trait: "Celestial Revelation" });
  const chosen = { race: { name: "Aasimar", source: "MPMM" }, ruleChoices: [{ id, origin: "race", choose: 1, from: ["Necrotic Shroud"], picked: ["Necrotic Shroud"] }] };
  const legacy = JSON.parse(JSON.stringify(makeChar(chosen as Partial<Character>)));
  delete legacy.ruleChoices;
  legacy.ruleChoices = chosen.ruleChoices;
  const migrated = migrateCharacter(legacy, races);
  assert.equal(migrated.ruleChoices?.length, 1);
  assert.equal((migrated.needsReview ?? []).some((m) => m.includes("ruleChoices")), false);
});

test("a malformed rule choice entry is rejected rather than silently dropped", () => {
  const legacy = JSON.parse(JSON.stringify(makeChar()));
  legacy.ruleChoices = [{ origin: "race" }];
  assert.throws(() => migrateCharacter(legacy, races), /ruleChoices/);
});

test("subclassRuleChoices: Circle of the Land offers 8 biomes at level >= 2", () => {
  const druid1 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 1, subclassName: "Circle of the Land" }],
  });
  assert.equal(subclassRuleChoices(druid1).length, 0);

  const druid2 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 2, subclassName: "Circle of the Land" }],
  });
  const choices = subclassRuleChoices(druid2);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].id, "PHB__Druid__Circle of the Land__Biome");
  assert.equal(choices[0].choose, 1);
  assert.equal(choices[0].options.length, 8);
  const biomeNames = choices[0].options.map((o) => o.name);
  assert.ok(biomeNames.includes("Arctic"));
  assert.ok(biomeNames.includes("Coast"));
  assert.ok(biomeNames.includes("Mountain"));
});

test("subclassRuleChoices: Divine Soul offers 5 affinities at level >= 1", () => {
  const sorc = makeChar({
    classes: [{ className: "Sorcerer", source: "XGE", level: 1, subclassName: "Divine Soul" }],
  });
  const choices = subclassRuleChoices(sorc);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].id, "XGE__Sorcerer__Divine Soul__Affinity");
  assert.equal(choices[0].choose, 1);
  assert.deepEqual(
    choices[0].options.map((o) => o.name),
    ["Good", "Evil", "Law", "Chaos", "Neutrality"]
  );
});

test("subclassRuleChoices: Nature, Death, and Arcana Cleric cantrip choices", () => {
  // Nature: 1 Druid cantrip
  const natureCleric = makeChar({
    classes: [{ className: "Cleric", source: "PHB", level: 1, subclassName: "Nature Domain" }],
  });
  const natureChoices = subclassRuleChoices(natureCleric);
  assert.equal(natureChoices.length, 1);
  assert.equal(natureChoices[0].id, "PHB__Cleric__Nature Domain__Acolyte of Nature");
  assert.equal(natureChoices[0].choose, 1);
  assert.ok(natureChoices[0].options.some((o) => o.name === "Druidcraft"));
  assert.ok(natureChoices[0].options.some((o) => o.name === "Shillelagh"));

  // Death: 1 Necromancy cantrip
  const deathCleric = makeChar({
    classes: [{ className: "Cleric", source: "DMG", level: 1, subclassName: "Death Domain" }],
  });
  const deathChoices = subclassRuleChoices(deathCleric);
  assert.equal(deathChoices.length, 1);
  assert.equal(deathChoices[0].id, "DMG__Cleric__Death Domain__Reaper");
  assert.equal(deathChoices[0].choose, 1);
  assert.ok(deathChoices[0].options.some((o) => o.name === "Chill Touch"));

  // Arcana: 2 Wizard cantrips
  const arcanaCleric = makeChar({
    classes: [{ className: "Cleric", source: "SCAG", level: 1, subclassName: "Arcana Domain" }],
  });
  const arcanaChoices = subclassRuleChoices(arcanaCleric);
  assert.equal(arcanaChoices.length, 1);
  assert.equal(arcanaChoices[0].id, "SCAG__Cleric__Arcana Domain__Arcane Initiate");
  assert.equal(arcanaChoices[0].choose, 2);
  assert.ok(arcanaChoices[0].options.some((o) => o.name === "Fire Bolt"));
  assert.ok(arcanaChoices[0].options.some((o) => o.name === "Mage Hand"));
});

test("availableSubclassRuleChoices filters by activeBooks", () => {
  const sorc = makeChar({
    classes: [{ className: "Sorcerer", source: "XGE", level: 1, subclassName: "Divine Soul" }],
  });
  assert.equal(availableSubclassRuleChoices(sorc, ["PHB"]).length, 0);
  assert.equal(availableSubclassRuleChoices(sorc, ["PHB", "XGE"]).length, 1);
});

test("pickSubclassRuleChoice updates character ruleChoices with origin subclass", () => {
  const druid = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 2, subclassName: "Circle of the Land" }],
  });
  const choices = subclassRuleChoices(druid);
  const updated = pickSubclassRuleChoice(druid, choices[0], "Coast");
  assert.equal(updated.ruleChoices?.length, 1);
  assert.equal(updated.ruleChoices[0].id, "PHB__Druid__Circle of the Land__Biome");
  assert.equal(updated.ruleChoices[0].origin, "subclass");
  assert.deepEqual(updated.ruleChoices[0].picked, ["Coast"]);

  // Deprecated alias works identically
  const aliased = toggleSubclassRuleChoice(druid, choices[0], "Coast");
  assert.deepEqual(aliased.ruleChoices, updated.ruleChoices);
});

test("Warlock with The Genie subclass offers Genie Kind rule choice", () => {
  const genieWarlock = makeChar({
    classes: [{ className: "Warlock", level: 1, subclassName: "The Genie" }],
  });
  const choices = subclassRuleChoices(genieWarlock, ["PHB", "TCE"]);
  const kindChoice = choices.find((c) => c.id === "TCE__Warlock__The Genie__Kind");
  assert.ok(kindChoice);
  assert.equal(kindChoice.choose, 1);
  assert.deepEqual(kindChoice.options.map((o) => o.name), ["Dao", "Djinni", "Efreeti", "Marid"]);
});