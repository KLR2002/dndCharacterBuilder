import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { featCounterId, featSpellRuleChoices, raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import { reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import type { Compendium } from "../src/services/compendium.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import type { AdditionalSpells, FeatData, RaceData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedSpellClasses, grantedSpellFeats, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// A race, lineage or feat pick whose owner comes from a sourcebook the player switches off (ADR 0017). Every name and
// sentence is invented. TST is on in every test; ALT is the book the owner comes from, and it is switched off in the
// tests that say so. The spells are TST spells, so the owner's book is the only one switched off.

const BOTH: string[] = ["TST", "ALT"];
const ALT_OFF: string[] = ["TST"];

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });

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

/** A race or lineage that lets the player pick a first-level Mage cantrip, with a fixed casting ability. */
const cantripGrant: AdditionalSpells[] = [{ ability: "int", known: { "1": { _: [{ choose: "level=0|class=Sample Mage" }] } } }];

/** Sample Initiate as the feat record of `source`: a Mage list and a Cleric list, the Mage list's cantrips and daily spell. */
const initiateIn = (source: string): FeatData => ({
  ...(grantedSpellFeats().find((feat) => feat.name === "Sample Initiate") as FeatData),
  source,
});

/** Picks `option` from the first offered choice that lists it. Asserts the option is offered. */
function pickOffered(
  character: Character,
  compendium: Compendium,
  books: string[],
  choices: AvailableRuleChoice[],
  option: string,
): Character {
  const choice = choices.find((candidate) => candidate.options.some((o) => o.name === option));
  assert.ok(choice, `${option} is offered`);
  return pickRuleChoice(character, choice, option, compendium, books);
}

/** One owner kind: its catalog, the character holding it, the title its notices and card carry, and how its picks are made. */
interface OwnerCase {
  kind: string;
  /** The catalog that holds the owner's record in ALT. */
  compendium: Compendium;
  /** The character holding the owner, with nothing picked. */
  saved: Character;
  /** The owner's title as its notices and its granted spell card name it. */
  title: string;
  /** The Rule Choices the owner's reader offers for the books given. */
  choices(character: Character, books: string[]): AvailableRuleChoice[];
  /** The character with Sample Ember picked for the owner, with the books given on. */
  pickEmber(character: Character, books: string[]): Character;
}

const raceCompendium = inMemoryCompendium(
  {
    races: [race("Sample Folk", "TST"), race("Sample Gifted", "ALT", { additionalSpells: cantripGrant })],
    classes: grantedSpellClasses(),
    spells: grantedSpellSpells(),
  },
  { integrated: true },
);

const lineageCompendium = inMemoryCompendium(
  {
    races: [race("Sample Folk", "TST"), race("Sample Lineage", "ALT", { additionalSpells: cantripGrant })],
    classes: grantedSpellClasses(),
    spells: grantedSpellSpells(),
  },
  { integrated: true },
);

const featCompendium = inMemoryCompendium(
  {
    races: [race("Sample Folk", "TST")],
    feats: [initiateIn("ALT")],
    classes: grantedSpellClasses(),
    spells: grantedSpellSpells(),
  },
  { integrated: true },
);

const OWNERS: OwnerCase[] = [
  {
    kind: "race",
    compendium: raceCompendium,
    saved: makeChar({ classes: [mage(4)], race: { name: "Sample Gifted", source: "ALT" } }),
    title: "Sample Gifted",
    choices: (character, books) => raceSpellRuleChoices(character, raceCompendium, books),
    pickEmber: (character, books) =>
      pickOffered(character, raceCompendium, books, raceSpellRuleChoices(character, raceCompendium, books), "Sample Ember"),
  },
  {
    kind: "lineage",
    compendium: lineageCompendium,
    saved: makeChar({
      classes: [mage(4)],
      race: { name: "Sample Folk", source: "TST" },
      lineageReplacement: "Sample Lineage",
    }),
    title: "Sample Lineage",
    choices: (character, books) => raceSpellRuleChoices(character, lineageCompendium, books),
    pickEmber: (character, books) =>
      pickOffered(character, lineageCompendium, books, raceSpellRuleChoices(character, lineageCompendium, books), "Sample Ember"),
  },
  {
    kind: "feat",
    compendium: featCompendium,
    saved: makeChar({
      classes: [mage(4)],
      originFeats: [{ level: 4, type: "feat", featName: "Sample Initiate", featSource: "ALT" }],
    }),
    title: "Sample Initiate",
    choices: (character, books) => featSpellRuleChoices(character, featCompendium, books),
    pickEmber: (character, books) => {
      const listed = pickOffered(
        character,
        featCompendium,
        books,
        featSpellRuleChoices(character, featCompendium, books),
        "Sample Mage Spells",
      );
      return pickOffered(listed, featCompendium, books, featSpellRuleChoices(listed, featCompendium, books), "Sample Ember");
    },
  },
];

for (const owner of OWNERS) {
  const card = owner.kind === "feat" ? `${owner.title} (Sample Mage)` : owner.title;

  test(`a ${owner.kind} whose book is switched off is not offered, and its granted spell card is gone`, () => {
    const picked = owner.pickEmber(owner.saved, BOTH);
    assert.deepEqual(owner.choices(picked, ALT_OFF), [], "no choice is offered while the book is off");
    const sources = evaluateCharacter(picked, { compendium: owner.compendium, activeBooks: ALT_OFF }).grantedSpellSources;
    assert.equal(
      sources.some((source) => source.title === card),
      false,
      `no card titled ${card} while the book is off`,
    );
  });

  test(`opening a ${owner.kind} saved before its book was switched off releases its pick, with a notice`, () => {
    const saved = owner.pickEmber(owner.saved, BOTH);
    const opened = reconcileForActiveBooks(saved, owner.compendium, ALT_OFF);
    assert.equal(
      (opened.ruleChoices ?? []).some((entry) => entry.picked.includes("Sample Ember")),
      false,
      "the pick is released",
    );
    assert.ok(
      opened.needsReview?.includes(`Sample Ember removed from ${owner.title}: book switched off`),
      `the release names the spell and the owner: ${JSON.stringify(opened.needsReview)}`,
    );
  });

  test(`switching the ${owner.kind}'s book back on offers the choice again, empty, and restores nothing`, () => {
    const released = reconcileForActiveBooks(owner.pickEmber(owner.saved, BOTH), owner.compendium, ALT_OFF);
    const reenabled = reconcileForActiveBooks(released, owner.compendium, BOTH);
    assert.ok(owner.choices(reenabled, BOTH).length > 0, "the choice is offered again");
    assert.deepEqual(
      owner.choices(reenabled, BOTH),
      owner.choices(owner.saved, BOTH),
      "the choices offered are the ones a character with nothing picked is offered",
    );
    assert.equal(
      (reenabled.ruleChoices ?? []).some((entry) => entry.picked.length > 0),
      false,
      "no pick is restored",
    );
    const spells = evaluateCharacter(reenabled, { compendium: owner.compendium, activeBooks: BOTH }).grantedSpellSources.flatMap(
      (source) => source.spells.map((spell) => spell.name),
    );
    assert.equal(spells.includes("Sample Ember"), false, "no granted spell card shows the released spell");
  });

  test(`a catalog that does not hold the ${owner.kind}'s record keeps its pick with no notice, whatever the books`, () => {
    const picked = owner.pickEmber(owner.saved, BOTH);
    const lacking = inMemoryCompendium({ classes: grantedSpellClasses(), spells: grantedSpellSpells() }, { integrated: true });
    const reconciled = reconcileForActiveBooks(picked, lacking, ALT_OFF);
    assert.deepEqual(reconciled.ruleChoices, picked.ruleChoices, "the pick is kept");
    assert.deepEqual(reconciled.needsReview ?? [], picked.needsReview ?? [], "no notice is raised");
  });
}

test("a lineage held without a base race releases its pick when its book is switched off, and keeps it while the book is on", () => {
  const lineage = OWNERS.find((owner) => owner.kind === "lineage");
  if (!lineage) throw new Error("no lineage case");
  const noBaseRace = makeChar({ classes: [mage(4)], race: null, lineageReplacement: "Sample Lineage" });
  const picked = lineage.pickEmber(noBaseRace, BOTH);
  const released = reconcileForActiveBooks(picked, lineageCompendium, ALT_OFF);
  assert.equal(
    (released.ruleChoices ?? []).some((entry) => entry.picked.includes("Sample Ember")),
    false,
    "the pick is released",
  );
  assert.deepEqual(released.needsReview, ["Sample Ember removed from Sample Lineage: book switched off"]);
  assert.deepEqual(reconcileForActiveBooks(picked, lineageCompendium, BOTH).ruleChoices, picked.ruleChoices, "the book on keeps it");
  const lacking = inMemoryCompendium({ classes: grantedSpellClasses(), spells: grantedSpellSpells() }, { integrated: true });
  assert.deepEqual(reconcileForActiveBooks(picked, lacking, ALT_OFF).ruleChoices, picked.ruleChoices, "a catalog without the lineage keeps it");
});

test("switching a feat's book off releases the Long Rest counter of its spell list, with a notice naming the feat", () => {
  const featCase = OWNERS.find((owner) => owner.kind === "feat");
  assert.ok(featCase);
  const counter = featCounterId("Sample Initiate", "Sample Mage Spells", "Sample Pulse");
  const used: Character = {
    ...featCase.pickEmber(featCase.saved, BOTH),
    resourceCounters: { [counter]: { id: counter, name: "Innate: Sample Pulse", current: 0, max: 1, resetOn: "long" } },
  };
  const released = reconcileForActiveBooks(used, featCase.compendium, ALT_OFF);
  assert.equal(released.resourceCounters?.[counter], undefined, "the counter is released");
  assert.ok(
    released.needsReview?.includes("Innate: Sample Pulse removed from Sample Initiate: book switched off"),
    `the counter's release is noticed: ${JSON.stringify(released.needsReview)}`,
  );
});

test("a race whose book stays on keeps its choice when a spell's own book is switched off, and releases only that spell", () => {
  const priest = race("Sample Priest", "TST", {
    additionalSpells: [{ ability: "wis", known: { "1": { _: [{ choose: "level=0|class=Sample Cleric" }] } } }],
  });
  const compendium = inMemoryCompendium({ races: [priest], classes: grantedSpellClasses(), spells: grantedSpellSpells() }, { integrated: true });
  const both = ["TST", "TST2"];
  const character = makeChar({ classes: [mage(4)], race: { name: "Sample Priest", source: "TST" } });
  const picked = pickOffered(character, compendium, both, raceSpellRuleChoices(character, compendium, both), "Sample Spark");

  const released = reconcileForActiveBooks(picked, compendium, ["TST"]);
  assert.equal(
    (released.ruleChoices ?? []).some((entry) => entry.picked.includes("Sample Spark")),
    false,
    "the spell of the switched-off book is released",
  );
  assert.ok(released.needsReview?.includes("Sample Spark removed from Sample Priest: no longer offered"));
  assert.ok(
    raceSpellRuleChoices(released, compendium, ["TST"]).some((choice) => choice.options.some((o) => o.name === "Sample Blessing")),
    "the race still offers its choice from the books on",
  );
});

test("an expanded list of a race or feat whose book is switched off is not read, and one whose book is on is", () => {
  const expander = race("Sample Expander", "ALT", { additionalSpells: [{ expanded: { s1: ["sample ward"] } }] });
  const expanding: FeatData = {
    name: "Sample Expanding",
    source: "ALT",
    prerequisite: null,
    abilityScoreIncrease: null,
    description: "Placeholder description for the feat.",
    additionalSpells: [{ expanded: { s1: ["sample ward"] } }],
  };
  const compendium = inMemoryCompendium(
    { races: [race("Sample Folk", "TST"), expander], feats: [expanding], classes: grantedSpellClasses(), spells: grantedSpellSpells() },
    { integrated: true },
  );
  const raceHolder = makeChar({ classes: [mage(4)], race: { name: "Sample Expander", source: "ALT" } });
  const featHolder = makeChar({
    classes: [mage(4)],
    originFeats: [{ level: 4, type: "feat", featName: "Sample Expanding", featSource: "ALT" }],
  });
  const mageExpanded = (holder: Character, books: string[]): string[] =>
    evaluateCharacter(holder, { compendium, activeBooks: books }).spellProfiles.find((profile) => profile.className === "Sample Mage")
      ?.expandedSpells ?? [];
  for (const holder of [raceHolder, featHolder]) {
    assert.deepEqual(mageExpanded(holder, BOTH), ["sample ward"], "the list joins the Mage's while its book is on");
    assert.deepEqual(mageExpanded(holder, ALT_OFF), [], "the list is not read while its book is off");
  }
});
