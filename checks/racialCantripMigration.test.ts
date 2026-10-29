import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { reconcile, reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import type { InnateSpellProfile } from "../src/rules/innateMagic.ts";
import type { AdditionalSpells, RaceData } from "../src/types/dnd5e.ts";
import { raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { inMemoryCompendium, loadTestCatalogs, makeChar } from "./testUtils.ts";
import { grantedSpellClasses, grantedSpellRaces, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// A character saved before race spell picks moved to the Rule Choice storage keeps its High Elf or
// Half-Elf cantrip on load. The catalogs are the ones the repo tracks; the names are the source's own, no prose is added.

const tracked = loadTestCatalogs();
const races = tracked.races as RaceData[];
const compendium = inMemoryCompendium(tracked);
const ACTIVE = ["PHB", "SCAG"];

const wizard: CharacterClass = { className: "Wizard", source: "PHB", level: 1 };
const LEGACY_HIGH_ELF_ID = "PHB__Elf__PHB__High Elf__Cantrip";
const highElf = (extra: Partial<Character> = {}) =>
  makeChar({
    classes: [wizard],
    race: { name: "Elf", source: "PHB", subraceName: "High", subraceSource: "PHB" },
    baseAbilityScores: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 8 },
    ...extra,
  });

const legacyPick = (picked: string) => ({
  id: LEGACY_HIGH_ELF_ID,
  trait: "Cantrip",
  origin: "race" as const,
  choose: 1,
  from: [picked],
  picked: [picked],
});

const cardTitled = (sources: InnateSpellProfile[], title: string) => sources.find((source) => source.title === title);

test("a saved High Elf cantrip pick gives the same cantrip on the race card after loading", () => {
  const saved = highElf({ ruleChoices: [legacyPick("Fire Bolt")] });
  const loaded = migrateCharacter(saved, races, tracked.classes, ALL_BOOKS);
  const card = cardTitled(evaluateCharacter(loaded, { compendium, activeBooks: ALL_BOOKS }).grantedSpellSources, "High Elf");
  assert.ok(card?.spells.some((spell) => spell.name === "Fire Bolt" && spell.isCantrip), "the migrated cantrip is listed at will");
  assert.equal(card?.ability, "int");
  assert.equal(loaded.ruleChoices?.some((entry) => entry.id === LEGACY_HIGH_ELF_ID), false, "the legacy entry is released");
});

test("a legacy racial cantrip stored as a known spell is moved to the race's pick and released from known spells", () => {
  const saved = highElf({ knownSpells: [{ name: "Fire Bolt", source: "PHB", ownerKey: "racial__innate" }] });
  const loaded = migrateCharacter(saved, races, tracked.classes, ALL_BOOKS);
  assert.equal(loaded.knownSpells?.some((spell) => spell.ownerKey === "racial__innate"), false, "the legacy known spell is gone");
  const card = cardTitled(evaluateCharacter(loaded, { compendium, activeBooks: ALL_BOOKS }).grantedSpellSources, "High Elf");
  assert.ok(card?.spells.some((spell) => spell.name === "Fire Bolt"), "the cantrip moved to the race's card");
});

test("a legacy Half-Elf descent cantrip moves to the subrace's pick, and its card lists it", () => {
  const saved = makeChar({
    classes: [wizard],
    race: { name: "Half-Elf", source: "PHB", subraceName: "Moon Elf or Sun Elf Descent", subraceSource: "SCAG" },
    baseAbilityScores: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 8 },
    ruleChoices: [
      {
        id: "SCAG__Half-Elf__Moon Elf or Sun Elf Descent__Variant Feature (Choose 1)",
        trait: "Variant Feature (Choose 1)",
        origin: "race",
        choose: 1,
        from: ["Skill Versatility", "Elf Weapon Training", "Cantrip"],
        picked: ["Cantrip"],
      },
      legacyPick("Shocking Grasp"),
    ],
  });
  const loaded = migrateCharacter(saved, races, tracked.classes, ALL_BOOKS);
  const card = cardTitled(evaluateCharacter(loaded, { compendium, activeBooks: ALL_BOOKS }).grantedSpellSources, "Moon Elf or Sun Elf Descent");
  assert.ok(card?.spells.some((spell) => spell.name === "Shocking Grasp" && spell.isCantrip));
});

test("a legacy cantrip moves to the race's cantrip pick whatever class that pick takes", () => {
  const sampleRaces = grantedSpellRaces();
  const sampleCompendium = inMemoryCompendium({ classes: grantedSpellClasses(), races: sampleRaces, spells: grantedSpellSpells() });
  const saved = makeChar({
    classes: [{ className: "Sample Mage", source: "TST", level: 1 }],
    race: { name: "Sample Gifted", source: "TST" },
    ruleChoices: [legacyPick("Sample Ember")],
  });
  const loaded = migrateCharacter(saved, sampleRaces, grantedSpellClasses(), ALL_BOOKS);
  const card = cardTitled(evaluateCharacter(loaded, { compendium: sampleCompendium, activeBooks: ALL_BOOKS }).grantedSpellSources, "Sample Gifted");
  assert.ok(card?.spells.some((spell) => spell.name === "Sample Ember" && spell.isCantrip), "the cantrip is listed at will on the race's card");
});

test("a legacy High Elf cantrip saved under another source's id moves to the race's pick too", () => {
  const saved = highElf({ ruleChoices: [{ ...legacyPick("Fire Bolt"), id: "XGE__Elf__XGE__High Elf__Cantrip" }] });
  const loaded = migrateCharacter(saved, races, tracked.classes, ALL_BOOKS);
  const card = cardTitled(evaluateCharacter(loaded, { compendium, activeBooks: ALL_BOOKS }).grantedSpellSources, "High Elf");
  assert.ok(card?.spells.some((spell) => spell.name === "Fire Bolt" && spell.isCantrip), "the cantrip is listed on the race's card");
  assert.equal(loaded.ruleChoices?.some((entry) => entry.id.includes("High Elf")), false, "the legacy entry is released");
});

test("a saved use of a race's spell under the counter id an older release gave it moves to the spell's current id", () => {
  const waterGenasi = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
    race: { name: "Genasi", source: "EEPC", subraceName: "Water", subraceSource: "EEPC" },
    resourceCounters: {
      innate_spell_create_water: { id: "innate_spell_create_water", name: "Innate: Create or Destroy Water", current: 0, max: 1, resetOn: "long" },
    },
  });
  const opened = reconcile(waterGenasi, compendium, { activeBooks: ALL_BOOKS });
  assert.equal(opened.resourceCounters?.innate_spell_create_water, undefined, "the counter under the old id is gone");
  assert.equal(opened.resourceCounters?.innate_spell_create_or_destroy_water?.current, 0, "the use is kept under the spell's own id");
});

test("a legacy cantrip the character's race no longer grants raises a review notice and is released", () => {
  const dwarf = makeChar({
    classes: [wizard],
    race: { name: "Dwarf", source: "PHB", subraceName: "Mountain", subraceSource: "PHB" },
    ruleChoices: [legacyPick("Fire Bolt")],
  });
  const loaded = migrateCharacter(dwarf, races, tracked.classes, ALL_BOOKS);
  assert.equal(loaded.ruleChoices?.some((entry) => entry.id === LEGACY_HIGH_ELF_ID), false);
  assert.ok(loaded.needsReview?.some((message) => message.includes("Fire Bolt") && message.includes("removed from Mountain Dwarf")));
});

test("a legacy pick the offered spells no longer include raises a review notice when the character is opened", () => {
  const saved = highElf({ ruleChoices: [legacyPick("Eldritch Blast")] });
  const loaded = migrateCharacter(saved, races, tracked.classes, ALL_BOOKS);
  const opened = reconcileForActiveBooks(loaded, compendium, ACTIVE);
  assert.ok(
    opened.needsReview?.some((message) => message.includes("Eldritch Blast") && message.includes("no longer offered")),
    `a notice names the pick: ${JSON.stringify(opened.needsReview)}`
  );
  const card = cardTitled(evaluateCharacter(opened, { compendium, activeBooks: ALL_BOOKS }).grantedSpellSources, "High Elf");
  assert.equal(card?.spells.some((spell) => spell.name === "Eldritch Blast"), false, "the unmatched cantrip is not listed");
});

test("a saved SRD High Elf cantrip pick migrates against an integrated catalog that holds the race only under its own book", () => {
  const integrated = inMemoryCompendium(tracked, { integrated: true });
  const srdHighElf = highElf({
    race: { name: "Elf", source: "SRD", subraceName: "High", subraceSource: "SRD" },
    ruleChoices: [{ ...legacyPick("Fire Bolt"), id: "SRD__Elf__SRD__High Elf__Cantrip" }],
  });
  const loaded = migrateCharacter(srdHighElf, races, tracked.classes, ALL_BOOKS);
  assert.equal(loaded.ruleChoices?.some((entry) => entry.id === "SRD__Elf__SRD__High Elf__Cantrip"), false, "the legacy entry is released");
  const card = cardTitled(evaluateCharacter(loaded, { compendium: integrated, activeBooks: ALL_BOOKS }).grantedSpellSources, "High Elf");
  assert.ok(card?.spells.some((spell) => spell.name === "Fire Bolt" && spell.isCantrip), "the cantrip is listed at will on the race's card");
});

test("a saved race the catalog has no record of keeps its legacy cantrip as saved, with no notice", () => {
  const srdHighElf = highElf({
    race: { name: "Elf", source: "SRD", subraceName: "High", subraceSource: "SRD" },
    ruleChoices: [{ ...legacyPick("Fire Bolt"), id: "SRD__Elf__SRD__High Elf__Cantrip" }],
  });
  const withoutElf = races.filter((race) => race.name !== "Elf");
  assert.ok(withoutElf.length > 0, "the catalog is not empty");
  const loaded = migrateCharacter(srdHighElf, withoutElf, tracked.classes, ALL_BOOKS);
  assert.deepEqual(loaded.ruleChoices, srdHighElf.ruleChoices, "the legacy entry is kept as saved");
  assert.deepEqual(loaded.needsReview ?? [], [], "no notice is raised");
});

test("a legacy High Elf cantrip never adds a second entry under the race key a pick already holds", () => {
  const migrated = migrateCharacter(highElf({ ruleChoices: [legacyPick("Fire Bolt")] }), races, tracked.classes, ALL_BOOKS);
  assert.equal(migrated.ruleChoices?.length, 1, "the legacy cantrip moved to one entry");

  const again = migrateCharacter(highElf({ ruleChoices: [...(migrated.ruleChoices ?? []), legacyPick("Mage Hand")] }), races, tracked.classes, ALL_BOOKS);
  assert.equal(again.ruleChoices?.length, 1, "no second entry is added");
  assert.deepEqual(again.ruleChoices?.[0].picked, ["Fire Bolt"], "the pick already under the key stands");
});

test("a legacy race pick whose new key a pick already holds is dropped, and the pick under the new key stands", () => {
  const newId = "-__Race Spells__High__-__0";
  const saved = makeChar({
    classes: [wizard],
    race: { name: "Elf", source: "SRD", subraceName: "High", subraceSource: "SRD" },
    ruleChoices: [
      { id: "SRD__Race Spells__High__-__0", trait: "Cantrip", origin: "race", choose: 1, from: ["Fire Bolt"], picked: ["Fire Bolt"] },
      { id: newId, trait: "Cantrip", origin: "race", choose: 1, from: ["Mage Hand"], picked: ["Mage Hand"] },
    ],
  });
  const loaded = migrateCharacter(saved, undefined, undefined, ALL_BOOKS);
  assert.deepEqual(loaded.ruleChoices?.map((entry) => [entry.id, entry.picked]), [[newId, ["Mage Hand"]]]);
});

test("a legacy race pick moves into an entry under its new key that holds no pick, and that entry takes the pick", () => {
  const newId = "-__Race Spells__High__-__0";
  const saved = makeChar({
    classes: [wizard],
    race: { name: "Elf", source: "SRD", subraceName: "High", subraceSource: "SRD" },
    ruleChoices: [
      { id: "SRD__Race Spells__High__-__0", trait: "Cantrip", origin: "race", choose: 1, from: ["Fire Bolt"], picked: ["Fire Bolt"] },
      { id: newId, trait: "Cantrip", origin: "race", choose: 1, from: [], picked: [] },
    ],
  });
  const loaded = migrateCharacter(saved, undefined, undefined, ALL_BOOKS);
  assert.deepEqual(loaded.ruleChoices?.map((entry) => [entry.id, entry.picked]), [[newId, ["Fire Bolt"]]], "one entry, holding the pick");
});

test("a legacy High Elf cantrip takes the empty entry under the race's key, and that entry takes the pick", () => {
  const offered = raceSpellRuleChoices(highElf(), compendium, ACTIVE).find((choice) =>
    choice.options.some((option) => option.name === "Fire Bolt"),
  );
  assert.ok(offered, "the High Elf offers a cantrip");
  const emptyEntry = { id: offered.id, trait: offered.traitName, origin: "race" as const, choose: 1, from: [], picked: [] };
  const loaded = migrateCharacter(highElf({ ruleChoices: [legacyPick("Fire Bolt"), emptyEntry] }), races, tracked.classes, ALL_BOOKS);
  assert.deepEqual(loaded.ruleChoices?.map((entry) => [entry.id, entry.picked]), [[offered.id, ["Fire Bolt"]]], "one entry, holding the pick");
});

// Two books list the same invented race. Only the first grants a cantrip, so which record the migration reads decides the outcome.
const giftedUnder = (source: string, additionalSpells: AdditionalSpells[] = []): RaceData => ({
  name: "Sample Gifted",
  source,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [],
  description: "Placeholder description for the race.",
  additionalSpells,
});
const cantripPick: AdditionalSpells[] = [{ ability: "int", known: { "1": { _: [{ choose: "level=0|class=Sample Mage" }] } } }];

test("a legacy cantrip is checked against the active book's record of its race, and against the first listed when no books are given", () => {
  const races = [giftedUnder("TST", cantripPick), giftedUnder("ALT")];
  const saved = makeChar({
    classes: [wizard],
    race: { name: "Sample Gifted", source: "OLD" },
    ruleChoices: [legacyPick("Sample Shot")],
  });
  const scoped = migrateCharacter(saved, races, tracked.classes, ["ALT"]);
  assert.equal(scoped.ruleChoices?.some((entry) => entry.picked.includes("Sample Shot")), false, "the active book's record grants no cantrip, so none moves");
  assert.ok(scoped.needsReview?.some((notice) => notice.startsWith("Sample Shot removed")), "the cantrip is released with a notice");

  const unscoped = migrateCharacter(saved, races, tracked.classes, ALL_BOOKS);
  assert.ok(unscoped.ruleChoices?.some((entry) => entry.picked.includes("Sample Shot")), "without books, the first record listed decides, as before");
});
