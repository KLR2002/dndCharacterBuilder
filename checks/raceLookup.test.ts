import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { findHeldRace } from "../src/rules/raceLookup.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { resolveAncestryState } from "../src/rules/ancestryEngine.ts";
import { grantedFeatures } from "../src/rules/grantedFeatures.ts";
import { offeredRuleChoices, pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { heldSubraceOf } from "../src/rules/recordProficiencyGrants.ts";
import { pruneInvalidFeatSpellPicks, raceGrantsOf, raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { characterSpeeds } from "../src/rules/speed.ts";
import type { Character } from "../src/types/character.ts";
import type { BackgroundData, ClassData, FeatData, RaceData, SubraceData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedSpellClasses, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// Invented races, subraces and books throughout: every name and sentence here is a placeholder. The order a race is
// found in is the rule under test: the saved source, then an active book, then catalog order.

const race = (name: string, source: string, extra: Partial<RaceData> = {}): RaceData => ({
  name,
  source,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [],
  description: "Placeholder description for the race.",
  ...extra,
});

const subrace = (name: string, source: string, extra: Partial<SubraceData> = {}): SubraceData => ({
  name,
  source,
  raceName: "Sample Folk",
  raceSource: source,
  isVariant: false,
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  description: "Placeholder description for the subrace.",
  ...extra,
});

const BASE_SCORES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

/** The same invented race under one source, with a subrace, a size, a darkvision and a trait, so a copy per source compares equal. */
const folkUnder = (source: string): RaceData =>
  race("Sample Folk", source, {
    size: ["Small"],
    speed: { walk: 25 },
    darkvision: 60,
    subraces: [
      subrace("Brook", source, {
        speed: { walk: 25 },
        abilityScoreIncrease: [{ dex: 1 }],
        traits: [{ name: "Sample Trait", description: "Placeholder trait text." }],
      }),
    ],
  });

/** Names, numbers and offered choices a character evaluates to, read through the public seams. */
function summary(character: Character, compendium: ReturnType<typeof inMemoryCompendium>, activeBooks: string[]) {
  const listings = compendium.for(activeBooks);
  const evaluated = evaluateCharacter(character, { compendium, activeBooks });
  const state = resolveAncestryState(character, { compendium, activeBooks });
  const features = grantedFeatures(character, {
    races: listings.races(),
    classes: [],
    backgrounds: [],
    feats: [],
    activeBooks,
  });
  return {
    race: evaluated.resolvedAncestry.race?.name,
    subrace: evaluated.resolvedAncestry.subrace?.name,
    scores: evaluated.effectiveScores.scores,
    speed: evaluated.speed,
    size: state.size,
    darkvision: state.darkvision,
    features: features.map((feature) => feature.name).sort(),
  };
}

test("a saved source's record is used even when an active book's record is listed first", () => {
  const races = [folkUnder("TST"), race("Sample Folk", "ALT", { speed: { walk: 35 } })];
  const found = findHeldRace(races, { name: "Sample Folk", source: "ALT" }, ["TST", "ALT"]).race;
  assert.equal(found?.source, "ALT");
  assert.equal(found?.speed.walk, 35);
});

test("without a saved source match, an active book's record is used rather than the first one listed", () => {
  const races = [race("Sample Folk", "TST", { speed: { walk: 25 } }), race("Sample Folk", "ALT", { speed: { walk: 35 } })];
  const found = findHeldRace(races, { name: "Sample Folk", source: "OLD" }, ["ALT"]).race;
  assert.equal(found?.source, "ALT");
});

test("with no saved source held and no active book listed, catalog order decides", () => {
  const forward = [race("Sample Folk", "TST"), race("Sample Folk", "ALT")];
  const backward = [...forward].reverse();
  assert.equal(findHeldRace(forward, { name: "Sample Folk", source: "OLD" }, ["OTHER"]).race?.source, "TST");
  assert.equal(findHeldRace(backward, { name: "Sample Folk", source: "OLD" }, ["OTHER"]).race?.source, "ALT");
});

test("a name held without a source is scoped to the active books", () => {
  const races = [race("Sample Folk", "TST"), race("Sample Folk", "ALT")];
  assert.equal(findHeldRace(races, { name: "Sample Folk" }, ["ALT"]).race?.source, "ALT");
});

test("the same inputs always give the same record and leave the catalog untouched", () => {
  const races = [race("Sample Folk", "TST"), race("Sample Folk", "ALT"), race("Sample Folk", "LATE")];
  const before = structuredClone(races);
  const held = { name: "Sample Folk", source: "OLD" };
  const results = [1, 2, 3].map(() => findHeldRace(races, held, ["LATE", "ALT"]).race?.source);
  assert.deepEqual(results, ["ALT", "ALT", "ALT"]);
  assert.deepEqual(races, before);
});

test("the subrace follows the same order within the resolved race", () => {
  const races = [
    race("Sample Folk", "TST", { subraces: [subrace("Brook", "TST"), subrace("Brook", "ALT")] }),
  ];
  const saved = findHeldRace(races, { name: "Sample Folk", source: "TST", subraceName: "Brook", subraceSource: "ALT" }, ALL_BOOKS).subrace;
  assert.equal(saved?.source, "ALT", "the saved subrace source wins");
  const active = findHeldRace(races, { name: "Sample Folk", source: "TST", subraceName: "Brook", subraceSource: "OLD" }, ["ALT"]).subrace;
  assert.equal(active?.source, "ALT", "an active book's subrace is next");
  const listed = findHeldRace(races, { name: "Sample Folk", source: "TST", subraceName: "Brook", subraceSource: "OLD" }, ALL_BOOKS).subrace;
  assert.equal(listed?.source, "TST", "catalog order is the last resort");
});

test("a race name held by two active books resolves to the one that lists the held subrace", () => {
  const races = [race("Sample Folk", "TST"), race("Sample Folk", "ALT", { subraces: [subrace("Brook", "ALT")] })];
  const found = findHeldRace(races, { name: "Sample Folk", source: "OLD", subraceName: "Brook", subraceSource: "SRD" }, ["TST", "ALT"]);
  assert.equal(found.race?.source, "ALT");
  assert.equal(found.subrace?.name, "Brook");
});

test("without an active book listing the held subrace, any record that lists it is used", () => {
  const races = [race("Sample Folk", "TST"), race("Sample Folk", "ALT", { subraces: [subrace("Brook", "ALT")] })];
  const found = findHeldRace(races, { name: "Sample Folk", source: "OLD", subraceName: "Brook", subraceSource: "OLD" }, ["TST"]);
  assert.equal(found.race?.source, "ALT");
  assert.equal(found.subrace?.name, "Brook");
});

test("a race held with no subrace takes its unnamed subrace, the plain form, and a race with named subraces only takes none", () => {
  const plain = race("Sample Folk", "TST", {
    subraces: [subrace("", "TST", { abilityScoreIncrease: [{ str: 1 }] }), subrace("Brook", "TST")],
  });
  assert.equal(findHeldRace([plain], { name: "Sample Folk", source: "SRD" }, ALL_BOOKS).subrace?.name, "");
  const named = race("Sample Folk", "TST", { subraces: [subrace("Brook", "TST")] });
  assert.equal(findHeldRace([named], { name: "Sample Folk", source: "SRD" }, ALL_BOOKS).subrace, undefined);
});

test("a name no record holds resolves to nothing", () => {
  assert.deepEqual(findHeldRace([folkUnder("TST")], { name: "Sample Other", source: "SRD" }, ALL_BOOKS), { race: undefined, subrace: undefined });
  assert.deepEqual(findHeldRace([folkUnder("TST")], null, ALL_BOOKS), { race: undefined, subrace: undefined });
});

test("evaluation uses the saved source's record, and leaves the saved character unchanged", () => {
  const compendium = inMemoryCompendium({ races: [folkUnder("TST"), race("Sample Folk", "ALT", { speed: { walk: 35 } })] });
  const character = makeChar({ race: { name: "Sample Folk", source: "ALT" }, baseAbilityScores: BASE_SCORES });
  const before = structuredClone(character);
  const evaluated = evaluateCharacter(character, { compendium, activeBooks: ["TST", "ALT"] });
  assert.equal(resolveAncestryState(character, { compendium, activeBooks: ["TST", "ALT"] }).selectedRace?.source, "ALT");
  assert.equal(evaluated.speed, 35);
  assert.deepEqual(character, before, "the saved sources are never rewritten");
});

test("a character saved on the SRD Baseline evaluates from the integrated record of its race, scoped to active books", () => {
  const compendium = inMemoryCompendium({ races: [folkUnder("TST")] }, { integrated: true });
  const character = makeChar({
    race: { name: "Sample Folk", source: "SRD", subraceName: "Brook", subraceSource: "SRD" },
    baseAbilityScores: BASE_SCORES,
  });
  const evaluated = evaluateCharacter(character, { compendium, activeBooks: ["TST"] });
  const panel = resolveAncestryState(character, { compendium, activeBooks: ["TST"] });
  assert.equal(panel.selectedRace?.source, "TST");
  assert.equal(panel.selectedSubrace?.source, "TST");
  assert.equal(evaluated.effectiveScores.scores.dex, 11);
  assert.equal(evaluated.speed, 25);
  assert.deepEqual(
    summary(character, compendium, ["TST"]),
    {
      race: "Sample Folk",
      subrace: "Brook",
      scores: { ...BASE_SCORES, dex: 11 },
      speed: 25,
      size: "Small",
      darkvision: 60,
      features: ["Sample Trait"],
    },
  );
  assert.equal(character.race?.source, "SRD", "the saved source is untouched");
});

test("a character saved on the integrated catalog evaluates the same on an SRD-style catalog alone", () => {
  const integrated = inMemoryCompendium({ races: [folkUnder("TST")] }, { integrated: true });
  const srdOnly = inMemoryCompendium({ races: [folkUnder("SRD")] });
  const saved = makeChar({
    race: { name: "Sample Folk", source: "TST", subraceName: "Brook", subraceSource: "TST" },
    baseAbilityScores: BASE_SCORES,
  });
  assert.deepEqual(summary(saved, srdOnly, ["SRD"]), summary(saved, integrated, ["TST"]));
  assert.equal(saved.race?.source, "TST", "the saved source is untouched");
});

test("an offered rule choice keeps its id across catalogs, so a pick saved on one catalog still applies on the other", () => {
  const withChoice = (source: string): RaceData =>
    race("Sample Folk", source, {
      traits: [
        {
          name: "Sample Choice",
          description: "Choose one option.",
          choice: {
            pick: 1,
            level: 1,
            effectLevel: 1,
            options: [
              { name: "Option A", description: "Placeholder effect A." },
              { name: "Option B", description: "Placeholder effect B." },
            ],
          },
        },
      ],
    });
  const srdOnly = inMemoryCompendium({ races: [withChoice("SRD")] });
  const integrated = inMemoryCompendium({ races: [withChoice("TST")] }, { integrated: true });
  const character = makeChar({
    classes: [{ className: "Sample Mage", source: "TST", level: 1 }],
    race: { name: "Sample Folk", source: "SRD" },
    baseAbilityScores: BASE_SCORES,
  });

  const [onSrd] = offeredRuleChoices(character, {
    raceCatalog: srdOnly.for(["SRD"]).races(),
    activeBooks: ["SRD"],
    origins: ["race"],
  });
  assert.ok(onSrd, "the SRD-style catalog offers the choice");

  const picked = {
    ...character,
    ruleChoices: [{ id: onSrd.id, trait: "Sample Choice", origin: "race" as const, choose: 1, from: ["Option A", "Option B"], picked: ["Option B"] }],
  };
  const [onIntegrated] = offeredRuleChoices(picked, {
    raceCatalog: integrated.for(["TST"]).races(),
    activeBooks: ["TST"],
    origins: ["race"],
  });
  assert.equal(onIntegrated?.id, onSrd.id, "the choice keeps its id");

  const feature = grantedFeatures(picked, {
    races: integrated.for(["TST"]).races(),
    classes: [],
    backgrounds: [],
    feats: [],
    activeBooks: ["TST"],
  }).find((f) => f.name === "Sample Choice");
  assert.equal(feature?.chosenOption, "Option B");
});

test("the Compendium's race finder takes the held subrace, so the record that lists it wins among active books", () => {
  const compendium = inMemoryCompendium({
    races: [race("Sample Folk", "TST"), race("Sample Folk", "ALT", { subraces: [subrace("Brook", "ALT")] })],
  }, { integrated: true });
  const held = { name: "Sample Folk", subraceName: "Brook", subraceSource: "SRD" };
  assert.equal(compendium.findRace(held, ["TST", "ALT"])?.source, "ALT", "the record that lists the held subrace, not the first active book's");
});

test("the Compendium's race finder takes the saved source first, then an active book's record, then catalog order", () => {
  const compendium = inMemoryCompendium({ races: [folkUnder("TST"), folkUnder("ALT")] }, { integrated: true });
  assert.equal(compendium.findRace({ name: "Sample Folk", source: "ALT" }, ALL_BOOKS)?.source, "ALT");
  assert.equal(compendium.findRace({ name: "Sample Folk", source: "OLD" }, ["ALT"])?.source, "ALT");
  assert.equal(compendium.findRace({ name: "Sample Folk", source: "OLD" }, ALL_BOOKS)?.source, "TST");
  assert.equal(compendium.findRace({ name: "Sample Other", source: "SRD" }, ALL_BOOKS), undefined);
});

test("a subrace name held twice in one race resolves to the subrace of an active book", () => {
  const folk = race("Sample Folk", "ALT", { subraces: [subrace("Brook", "TST"), subrace("Brook", "ALT")] });
  const held = makeChar({ race: { name: "Sample Folk", source: "OLD", subraceName: "Brook", subraceSource: "OLD" } });
  assert.equal(heldSubraceOf(folk, held, ["ALT"])?.source, "ALT");
  assert.equal(heldSubraceOf(folk, held, ALL_BOOKS)?.source, "TST", "without active books, catalog order decides");
});

test("a lineage held in two books is read from the record of the active book, not the first listed", () => {
  const lineage = (source: string, spell: string) =>
    race("Sample Lineage", source, { additionalSpells: [{ ability: "int", known: { "1": [spell] } }] });
  const records = [lineage("OLD", "sample ember"), lineage("ALT", "sample pulse")];
  const grants = raceGrantsOf(makeChar({ lineageReplacement: "Sample Lineage" }), records, ["ALT"]);
  assert.deepEqual(grants?.grants[0].known, { "1": ["sample pulse"] });
});

test("a lineage's spell pick is judged against the active book's record when another book also lists the lineage", () => {
  const compendium = inMemoryCompendium(
    {
      races: [
        race("Sample Folk", "TST"),
        race("Sample Lineage", "OLD", {
          additionalSpells: [{ ability: "int", known: { "1": { _: [{ choose: "level=0|class=Sample Mage" }] } } }],
        }),
        race("Sample Lineage", "ALT", {
          additionalSpells: [{ ability: "int", known: { "1": { _: [{ choose: "level=1|class=Sample Mage" }] } } }],
        }),
      ],
      classes: grantedSpellClasses(),
      spells: grantedSpellSpells(),
    },
    { integrated: true },
  );
  const books = ["TST", "ALT"];
  const character = makeChar({
    classes: [{ className: "Sample Mage", source: "TST", level: 1 }],
    race: { name: "Sample Folk", source: "TST" },
    lineageReplacement: "Sample Lineage",
  });
  const slot = raceSpellRuleChoices(character, compendium, books).find((choice) =>
    choice.options.some((option) => option.name === "Sample Lure"),
  );
  assert.ok(slot, "the active book's lineage offers a first-level pick");
  const held = {
    ...character,
    ruleChoices: [{ id: slot.id, trait: slot.traitName, origin: "race" as const, choose: slot.choose, from: slot.options.map((o) => o.name), picked: ["Sample Lure"] }],
  };
  assert.equal(pruneInvalidFeatSpellPicks(held, compendium, books), held, "the pick still applies, so nothing is released");
});

// A held lineage that grants a first-level cantrip pick from a class list, with the lineage in the book `source`.
const lineageUnder = (source: string): RaceData =>
  race("Sample Lineage", source, {
    additionalSpells: [{ ability: "int", known: { "1": { _: [{ choose: "level=0|class=Sample Mage" }] } } }],
  });

const lineageCharacter = (): Character =>
  makeChar({
    classes: [{ className: "Sample Mage", source: "TST", level: 1 }],
    race: { name: "Sample Folk", source: "TST" },
    lineageReplacement: "Sample Lineage",
  });

test("a held lineage whose book is switched off releases its recorded pick, with a notice", () => {
  const compendium = inMemoryCompendium(
    { races: [race("Sample Folk", "TST"), lineageUnder("ALT")], classes: grantedSpellClasses(), spells: grantedSpellSpells() },
    { integrated: true },
  );
  const both = ["TST", "ALT"];
  const character = lineageCharacter();
  const choice = raceSpellRuleChoices(character, compendium, both).find((c) => c.options.some((o) => o.name === "Sample Ember"));
  assert.ok(choice, "the lineage offers Sample Ember while its book is on");
  const picked = pickRuleChoice(character, choice, "Sample Ember", compendium, both);
  const released = pruneInvalidFeatSpellPicks(picked, compendium, ["TST"]);
  assert.equal(released.ruleChoices?.some((entry) => entry.picked.includes("Sample Ember")), false, "the pick is released");
  assert.ok(
    released.needsReview?.includes("Sample Ember removed from Sample Lineage: book switched off"),
    `the release is noticed: ${JSON.stringify(released.needsReview)}`,
  );
});

test("a catalog that holds the lineage's book but not the lineage keeps the lineage's pick, as the lineage is not loaded", () => {
  const spellsAndClasses = { classes: grantedSpellClasses(), spells: grantedSpellSpells() };
  const full = inMemoryCompendium(
    { ...spellsAndClasses, races: [race("Sample Folk", "TST"), lineageUnder("ALT")] },
    { integrated: true },
  );
  const withoutLineage = inMemoryCompendium(
    { ...spellsAndClasses, races: [race("Sample Folk", "TST"), race("Sample Other", "ALT")] },
    { integrated: true },
  );
  const both = ["TST", "ALT"];
  const character = lineageCharacter();
  const choice = raceSpellRuleChoices(character, full, both).find((c) => c.options.some((o) => o.name === "Sample Ember"));
  assert.ok(choice, "the lineage offers Sample Ember");
  const picked = pickRuleChoice(character, choice, "Sample Ember", full, both);
  const kept = pruneInvalidFeatSpellPicks(picked, withoutLineage, both);
  assert.deepEqual(kept.ruleChoices, picked.ruleChoices, "the pick is kept");
  assert.equal(kept.needsReview, undefined, "no notice is made");
});

// Invented subclass, background and feat under one source, for the saved-source oracles below.
const recordsUnder = (source: string): { classes: ClassData[]; backgrounds: BackgroundData[]; feats: FeatData[] } => ({
  classes: [
    {
      name: "Sample Warrior",
      source,
      hitDie: "1d6",
      primaryAbility: [],
      savingThrows: [],
      armorProficiencies: [],
      weaponProficiencies: [],
      toolProficiencies: [],
      skillProficiencies: { choose: 0, from: [] },
      features: [],
      subclasses: [
        {
          name: "Sample Path",
          shortName: "Sample Path",
          source,
          className: "Sample Warrior",
          classSource: source,
          features: [{ name: "Sample Path Edge", level: 3, description: "Placeholder description for the feature." }],
          description: "Placeholder description for the subclass.",
        },
      ],
      description: "Placeholder description for the class.",
    },
  ],
  backgrounds: [
    {
      name: "Sample Scholar",
      source,
      skillProficiencies: [],
      toolProficiencies: [],
      languages: [],
      startingEquipment: [],
      feature: { name: "Sample Lore", description: "Placeholder description for the feature." },
      characteristics: {},
      description: "Placeholder description for the background.",
    },
  ],
  feats: [
    {
      name: "Sample Feat",
      source,
      prerequisite: null,
      abilityScoreIncrease: null,
      description: "Placeholder description for the feat.",
    },
  ],
});

/** The names and origins of the features a character with the Sample Warrior, Sample Scholar and Sample Feat reads. */
function savedFeatures(source: string, compendium: ReturnType<typeof inMemoryCompendium>, activeBooks: string[]): string[] {
  const character = makeChar({
    classes: [{ className: "Sample Warrior", source, level: 3, subclassName: "Sample Path", subclassSource: source }],
    background: { name: "Sample Scholar", source },
    asiSelections: [{ level: 4, type: "feat", featName: "Sample Feat", featSource: source }],
  });
  const listings = compendium.for(activeBooks);
  return grantedFeatures(character, {
    races: listings.races(),
    classes: listings.classes(),
    backgrounds: listings.backgrounds(),
    feats: listings.feats(),
    activeBooks,
  })
    .map((feature) => `${feature.origin}: ${feature.name}`)
    .sort();
}

test("a subclass, background and feat saved as SRD read the same features on a catalog that holds them under another source", () => {
  const onIntegrated = savedFeatures("SRD", inMemoryCompendium(recordsUnder("TST"), { integrated: true }), ["TST"]);
  const onSrd = savedFeatures("SRD", inMemoryCompendium(recordsUnder("SRD")), ["SRD"]);
  assert.deepEqual(onIntegrated, onSrd);
  assert.deepEqual(onIntegrated, ["Background: Sample Lore", "Feat: Sample Feat", "Subclass: Sample Path Edge"]);
});

test("a subclass, background and feat saved from another book read the same features on an SRD-style catalog", () => {
  const onSrd = savedFeatures("TST", inMemoryCompendium(recordsUnder("SRD")), ["SRD"]);
  const onIntegrated = savedFeatures("TST", inMemoryCompendium(recordsUnder("TST"), { integrated: true }), ["TST"]);
  assert.deepEqual(onSrd, onIntegrated);
  assert.deepEqual(onSrd, ["Background: Sample Lore", "Feat: Sample Feat", "Subclass: Sample Path Edge"]);
});

test("a race's plain subrace holds its fixed ability bonus when the character is saved with no subrace", () => {
  const plain = race("Sample Kin", "TST", {
    subraces: [subrace("", "TST", { abilityScoreIncrease: [{ cha: 1 }] })],
  });
  const compendium = inMemoryCompendium({ races: [plain] }, { integrated: true });
  const character = makeChar({ race: { name: "Sample Kin", source: "TST" }, baseAbilityScores: BASE_SCORES });
  assert.equal(evaluateCharacter(character, { compendium, activeBooks: ["TST"] }).effectiveScores.scores.cha, 11);
});

test("a race saved on the SRD Baseline reads the speed of the record its name finds, not only a record of its own source", () => {
  const compendium = inMemoryCompendium({ races: [folkUnder("TST")] }, { integrated: true });
  const character = makeChar({ race: { name: "Sample Folk", source: "SRD" }, baseAbilityScores: BASE_SCORES });
  assert.equal(characterSpeeds(character, { compendium, activeBooks: ["TST"] }).walk, 25);
});
