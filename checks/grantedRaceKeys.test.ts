import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { migrateLegacyRacialCantrip, raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import type { CharacterClass } from "../src/types/character.ts";
import type { RaceData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedSpellBackgrounds, grantedSpellClasses, grantedSpellFeats, grantedSpellRaces, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// Race picks across catalogs (ADR 0017). Every name is invented (checks/grantedSpellsFixture.ts). "SRD" is the
// SRD-like catalog's source; "TST" is the integrated-like catalog's source of the same race.

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });

// A race whose subrace grants one cantrip from the Sample Mage class list, under the given book.
const sampleRace = (source: string): RaceData => ({
  name: "Sample Elf",
  source,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [
    {
      name: "Sample High",
      source,
      raceName: "Sample Elf",
      raceSource: source,
      isVariant: false,
      abilityScoreIncrease: [],
      darkvision: null,
      traits: [],
      description: "Placeholder description for the subrace.",
      additionalSpells: [{ ability: "int", known: { _: [{ choose: "level=0|class=Sample Mage", count: 1 }] } }],
    },
  ],
  description: "Placeholder description for the race.",
});

const srdLike = () =>
  inMemoryCompendium({ classes: grantedSpellClasses(), races: [sampleRace("SRD")], feats: grantedSpellFeats(), spells: grantedSpellSpells(), backgrounds: grantedSpellBackgrounds() });
const integratedLike = () =>
  inMemoryCompendium(
    { classes: grantedSpellClasses(), races: [sampleRace("TST")], feats: grantedSpellFeats(), spells: grantedSpellSpells(), backgrounds: grantedSpellBackgrounds() },
    { integrated: true },
  );

test("a cantrip picked for a race on the SRD-like catalog stands after the integrated catalog loads, with no release and no notice", () => {
  const first = srdLike();
  const saved = makeChar({
    classes: [mage(1)],
    race: { name: "Sample Elf", source: "SRD", subraceName: "Sample High", subraceSource: "SRD" },
  });
  const choice = raceSpellRuleChoices(saved, first, ALL_BOOKS).find((c) => c.options.some((o) => o.name === "Sample Shot"));
  assert.ok(choice, "the cantrip pick is offered on the SRD-like catalog");
  const picked = pickRuleChoice(saved, choice, "Sample Shot", first, ALL_BOOKS);
  assert.equal(picked.ruleChoices?.length, 1);

  const loaded = migrateCharacter(picked, [sampleRace("TST")], grantedSpellClasses(), ALL_BOOKS);
  const opened = reconcile(loaded, integratedLike(), { activeBooks: ALL_BOOKS });
  assert.deepEqual(opened.ruleChoices, picked.ruleChoices, "the pick is kept with its id");
  assert.deepEqual(opened.needsReview ?? [], [], "no notice is raised");
  const card = evaluateCharacter(opened, { compendium: integratedLike(), activeBooks: ALL_BOOKS }).grantedSpellSources.find((source) => source.title === "Sample High");
  assert.ok(card?.spells.some((spell) => spell.name === "Sample Shot" && spell.isCantrip), "the cantrip is still listed at will on the race's card");
});

test("a save that keys a race pick by its source loads with the pick under the race's key, and the card lists it", () => {
  const legacy = makeChar({
    classes: [mage(1)],
    race: { name: "Sample Elf", source: "SRD", subraceName: "Sample High", subraceSource: "SRD" },
    ruleChoices: [
      {
        id: "SRD__Race Spells__Sample High__-__0",
        trait: "Sample High Cantrip",
        origin: "race",
        choose: 1,
        from: ["Sample Shot"],
        picked: ["Sample Shot"],
      },
    ],
  });
  const loaded = migrateCharacter(legacy, [sampleRace("SRD")], grantedSpellClasses(), ALL_BOOKS);
  assert.deepEqual(
    loaded.ruleChoices?.map((entry) => [entry.id, entry.picked]),
    [["-__Race Spells__Sample High__-__0", ["Sample Shot"]]],
    "the pick is kept under the key the race now has",
  );
  const card = evaluateCharacter(loaded, { compendium: srdLike(), activeBooks: ALL_BOOKS }).grantedSpellSources.find((source) => source.title === "Sample High");
  assert.ok(card?.spells.some((spell) => spell.name === "Sample Shot" && spell.isCantrip), "the cantrip is listed on the race's card");
});

test("a cantrip picked on the integrated catalog stands after the SRD-like catalog loads, with no release and no notice", () => {
  const integrated = integratedLike();
  const saved = makeChar({
    classes: [mage(1)],
    race: { name: "Sample Elf", source: "TST", subraceName: "Sample High", subraceSource: "TST" },
  });
  const choice = raceSpellRuleChoices(saved, integrated, ALL_BOOKS).find((c) => c.options.some((o) => o.name === "Sample Shot"));
  assert.ok(choice, "the cantrip pick is offered on the integrated catalog");
  const picked = pickRuleChoice(saved, choice, "Sample Shot", integrated, ALL_BOOKS);

  const opened = reconcile(migrateCharacter(picked, [sampleRace("SRD")], grantedSpellClasses(), ALL_BOOKS), srdLike(), { activeBooks: ALL_BOOKS });
  assert.deepEqual(opened.ruleChoices, picked.ruleChoices, "the pick is kept with its id");
  assert.deepEqual(opened.needsReview ?? [], [], "no notice is raised");
});

test("a race pick is kept while the catalog lacks the race's book, and released once that book holds the race without the subrace", () => {
  const saved = makeChar({
    classes: [mage(1)],
    race: { name: "Sample Elf", source: "SRD", subraceName: "Sample High", subraceSource: "SRD" },
    ruleChoices: [
      { id: "-__Race Spells__Sample High__-__0", trait: "Sample High Cantrip", origin: "race", choose: 1, from: ["Sample Shot"], picked: ["Sample Shot"] },
    ],
  });

  // The catalog holds only a race of another book, so the SRD book is not loaded and the pick stays with no notice.
  const bookAbsent = inMemoryCompendium({
    classes: grantedSpellClasses(),
    races: [{ ...sampleRace("TST"), name: "Sample Other" }],
    spells: grantedSpellSpells(),
  });
  const kept = reconcile(saved, bookAbsent, { activeBooks: ALL_BOOKS });
  assert.deepEqual(kept.ruleChoices, saved.ruleChoices, "the pick is kept while its book is absent");
  assert.deepEqual(kept.needsReview ?? [], [], "no notice is raised while its book is absent");

  // The SRD book is loaded and its race has no High subrace, so the pick is released with a notice.
  const bookWithoutSubrace = inMemoryCompendium({
    classes: grantedSpellClasses(),
    races: [{ ...sampleRace("SRD"), subraces: [] }],
    spells: grantedSpellSpells(),
  });
  const released = reconcile(saved, bookWithoutSubrace, { activeBooks: ALL_BOOKS });
  assert.deepEqual(released.ruleChoices ?? [], [], "the pick is released once the book is loaded without the subrace");
  assert.ok(
    released.needsReview?.includes("Sample Shot removed from Sample High: ancestry no longer grants it"),
    `got ${JSON.stringify(released.needsReview)}`,
  );
});

// A character of the invented race Sample Gifted, saved with its cantrip from the Sample Mage list as a legacy racial known spell.
// The race's pick under its key is the one the migration writes.
const legacyGiftedCantrip = () =>
  makeChar({
    classes: [mage(1)],
    race: { name: "Sample Gifted", source: "TST" },
    knownSpells: [{ name: "Sample Ember", source: "TST", ownerKey: "racial__innate" }],
  });

test("a legacy racial cantrip moves into the race's pick although an empty entry already holds that key", () => {
  const races = grantedSpellRaces();
  const racePick = migrateLegacyRacialCantrip(legacyGiftedCantrip(), races, ALL_BOOKS).ruleChoices?.find((entry) => entry.origin === "race");
  assert.ok(racePick, "the legacy cantrip has a race pick to move into");

  const withEmptyEntry = { ...legacyGiftedCantrip(), ruleChoices: [{ ...racePick, picked: [] }] };
  const loaded = migrateLegacyRacialCantrip(withEmptyEntry, races, ALL_BOOKS);
  assert.deepEqual(
    loaded.ruleChoices?.find((entry) => entry.id === racePick.id)?.picked,
    ["Sample Ember"],
    "the cantrip is picked under the race's key",
  );
  assert.equal(loaded.knownSpells?.some((spell) => spell.ownerKey === "racial__innate"), false, "the legacy known spell is released");
});

test("a race pick that already holds a spell stands, and the legacy cantrip adds no second entry under its key", () => {
  const races = grantedSpellRaces();
  const racePick = migrateLegacyRacialCantrip(legacyGiftedCantrip(), races, ALL_BOOKS).ruleChoices?.find((entry) => entry.origin === "race");
  assert.ok(racePick, "the legacy cantrip has a race pick to move into");

  const withPick = { ...legacyGiftedCantrip(), ruleChoices: [{ ...racePick, picked: ["Sample Glimmer"] }] };
  const loaded = migrateLegacyRacialCantrip(withPick, races, ALL_BOOKS);
  const underKey = loaded.ruleChoices?.filter((entry) => entry.id === racePick.id) ?? [];
  assert.equal(underKey.length, 1, "one entry is held under the race's key");
  assert.deepEqual(underKey[0]?.picked, ["Sample Glimmer"], "the pick already made stands");
});
