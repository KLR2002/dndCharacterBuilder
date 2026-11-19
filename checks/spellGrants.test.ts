import { ALL_BOOKS } from "../src/constants/books.ts";
import { BACKGROUND_FEAT_SOURCE } from "../src/constants/rules.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { findFeat } from "../src/rules/featIncrease.ts";
import { heldSpellGrants } from "../src/rules/spellGrants.ts";
import type { FeatData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import {
  grantedSpellBackgrounds,
  grantedSpellClasses,
  grantedSpellFeats,
  grantedSpellRaces,
  grantedSpellSpells,
} from "./grantedSpellsFixture.ts";

// The one reader of the owners that grant spells (ADR 0017). Every name is invented (checks/grantedSpellsFixture.ts).

const compendium = inMemoryCompendium({
  classes: grantedSpellClasses(),
  races: grantedSpellRaces(),
  feats: grantedSpellFeats(),
  spells: grantedSpellSpells(),
  backgrounds: grantedSpellBackgrounds(),
});
const catalogs = { compendium, activeBooks: ALL_BOOKS };

const feat = (name: string) => grantedSpellFeats().find((entry) => entry.name === name) as FeatData;

test("the held grants are read in one order: the background, the feats in the order taken, then the race", () => {
  const drifter = {
    ...grantedSpellBackgrounds()[0],
    additionalSpells: [{ expanded: { s1: ["sample ward"] } }],
  };
  const withBackground = inMemoryCompendium({
    classes: grantedSpellClasses(),
    races: grantedSpellRaces(),
    feats: grantedSpellFeats(),
    spells: grantedSpellSpells(),
    backgrounds: [drifter],
  });
  const character = makeChar({
    classes: [{ className: "Sample Mage", source: "TST", level: 4 }],
    race: { name: "Sample Kin", source: "TST", subraceName: "Sample Line", subraceSource: "TST" },
    background: { name: "Sample Drifter", source: "TST" },
    asiSelections: [
      { level: 4, type: "feat", featName: "Sample Cinder", featSource: "TST", featAbility: "int" },
      { level: 4, type: "feat", featName: "Sample Warding", featSource: "TST" },
    ],
  });
  const held = heldSpellGrants(character, { compendium: withBackground, activeBooks: ALL_BOOKS });

  assert.deepEqual(
    held.map((entry) => [entry.kind, entry.record.name]),
    [
      ["background", "Sample Drifter"],
      ["feat", "Sample Cinder"],
      ["feat", "Sample Warding"],
      ["race", "Sample Line"],
    ],
  );
  const [, cinder, , race] = held;
  assert.equal(cinder.kind === "feat" && cinder.selection.featAbility, "int", "a feat entry carries its selection");
  assert.deepEqual(cinder.kind === "feat" ? cinder.owner : undefined, { kind: "feat", source: "TST", name: "Sample Cinder" });
  assert.deepEqual(race.kind === "race" ? race.owner : undefined, { kind: "race", source: "TST", name: "Sample Line" });
  assert.equal(held[0].kind === "background" ? undefined : "owned", undefined, "a background owns no picks");
});

test("a subrace's grants whose gate is shut are not held, and open with the choice they name", () => {
  const gated = {
    name: "Sample Gated",
    source: "TST",
    subraceName: "Sample Gated Line",
    subraceSource: "TST",
  };
  const shut = makeChar({ classes: [{ className: "Sample Mage", source: "TST", level: 1 }], race: gated });
  assert.deepEqual(heldSpellGrants(shut, catalogs), []);

  const open = makeChar({
    classes: [{ className: "Sample Mage", source: "TST", level: 1 }],
    race: gated,
    ruleChoices: [
      {
        id: "TST__Sample Gated__Sample Gated Line__Sample Option (Choose 1)",
        trait: "Sample Option (Choose 1)",
        origin: "race",
        choose: 1,
        from: ["Sample Cantrip"],
        picked: ["Sample Cantrip"],
      },
    ],
  });
  const held = heldSpellGrants(open, catalogs);
  assert.deepEqual(held.map((entry) => [entry.kind, entry.record.name]), [["race", "Sample Gated Line"]]);
});

test("a held feat with no spell grant is held, with no grants", () => {
  const plain = { ...feat("Sample Study"), name: "Sample Plain Feat", additionalSpells: undefined };
  const withPlain = inMemoryCompendium({ classes: grantedSpellClasses(), feats: [plain], spells: grantedSpellSpells() });
  const character = makeChar({
    asiSelections: [{ level: 4, type: "feat", featName: "Sample Plain Feat", featSource: "TST" }],
  });
  const held = heldSpellGrants(character, { compendium: withPlain, activeBooks: ALL_BOOKS });
  assert.deepEqual(held.map((entry) => [entry.kind, entry.record.name, entry.additionalSpells]), [["feat", "Sample Plain Feat", undefined]]);
});

test("every record of a background-claimed name is held by the reconciler's view, and one by the reader's", () => {
  const twin = (source: string): FeatData => ({ ...feat("Sample Study"), name: "Sample Twin", source });
  const twins = inMemoryCompendium({ classes: grantedSpellClasses(), feats: [twin("TST"), twin("TST2")], spells: grantedSpellSpells() });
  const character = makeChar({
    asiSelections: [{ level: 4, type: "feat", featName: "Sample Twin", featSource: BACKGROUND_FEAT_SOURCE }],
  });
  const reader = heldSpellGrants(character, { compendium: twins, activeBooks: ["TST"] });
  assert.deepEqual(reader.map((entry) => entry.record.source), ["TST"]);
  const everyRecord = heldSpellGrants(character, { compendium: twins, activeBooks: ["TST"] }, { everyFeatRecord: true });
  assert.deepEqual(everyRecord.map((entry) => entry.record.source), ["TST", "TST2"]);
});

// The comparison behind the decision: findFeat would replace the feat resolution of heldSpellGrants only where the two agree.
// They agree on a feat that names its book, and on a name held in one active book. They part where the name is held in two
// active books: findFeat finds nothing, and the reader takes the first record in catalog order (the background's own book
// ranks after the active books). The reader's resolution is kept.
test("findFeat and the reader's feat resolution", () => {
  const twin = (source: string): FeatData => ({
    ...feat("Sample Study"),
    name: "Sample Twin",
    source,
    additionalSpells: [{ ability: "int", known: { _: ["sample ember"] } }],
  });
  // Integrated, so the books scope the listings as they do in the app; an unscoped in-memory catalog ignores them.
  const twins = inMemoryCompendium(
    { classes: grantedSpellClasses(), feats: [twin("TST"), twin("TST2")], spells: grantedSpellSpells() },
    { integrated: true },
  );
  const select = (featSource: string | undefined) =>
    makeChar({ asiSelections: [{ level: 4, type: "feat", featName: "Sample Twin", ...(featSource ? { featSource } : {}) }] });
  const readerSource = (character: ReturnType<typeof makeChar>, books: string[]) => {
    const [entry] = heldSpellGrants(character, { compendium: twins, activeBooks: books });
    return entry?.record.source;
  };
  const found = (name: string, source: string | undefined, books: string[]) => findFeat(name, source, twins, books)?.source ?? null;

  // Agree: a book named by the selection.
  assert.equal(readerSource(select("TST2"), ["TST", "TST2"]), "TST2");
  assert.equal(found("Sample Twin", "TST2", ["TST", "TST2"]), "TST2");

  // Agree: no book named, and the name is held in one active book only.
  assert.equal(readerSource(select(undefined), ["TST2"]), "TST2");
  assert.equal(found("Sample Twin", undefined, ["TST2"]), "TST2");

  // Differ: no book named, the name is held in two active books. The reader takes the first; findFeat finds nothing.
  assert.equal(readerSource(select(undefined), ["TST", "TST2"]), "TST");
  assert.equal(found("Sample Twin", undefined, ["TST", "TST2"]), null);

  // Differ: the background marker, the name held in two active books, the background of the second book.
  const claimed = makeChar({
    background: { name: "Sample Drifter", source: "TST2" },
    asiSelections: [{ level: 4, type: "feat", featName: "Sample Twin", featSource: BACKGROUND_FEAT_SOURCE }],
  });
  assert.equal(readerSource(claimed, ["TST", "TST2"]), "TST");
  assert.equal(found("Sample Twin", BACKGROUND_FEAT_SOURCE, ["TST", "TST2"]), null);
});
