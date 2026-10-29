import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { isSpellAvailableForClass, profileSpellContext, type ClassSpellProfile } from "../src/rules/spellcasting.ts";
import { changeLineage, changeRace, clearBackground, removeClassLevel } from "../src/rules/builderTransitions.ts";
import { applyAncestrySelection } from "../src/rules/ancestryEngine.ts";
import { applyAsiSelection, removeAsiSelection } from "../src/rules/leveling.ts";
import { applyOriginFeat, removeOriginFeat } from "../src/rules/feats.ts";
import { isKnown, learnSpell } from "../src/rules/characterSpells.ts";
import type { AsiSelection, Character, CharacterClass } from "../src/types/character.ts";
import type { ClassData, FeatData, SpellData } from "../src/types/dnd5e.ts";
import { BACKGROUND_FEAT_SOURCE } from "../src/constants/rules.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { backgroundSpellBackgrounds, backgroundSpellClasses, backgroundSpellSpells } from "./backgroundSpellsFixture.ts";
import { expandedSourcesOfBook, expandedSpellFeats, expandedSpellLineages, expandedSpellRaces } from "./expandedSpellSourcesFixture.ts";
import { reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";

// A held feat's or race's expanded lists join the spell list of every spellcasting class, as a background's do (ADR 0017).
// A spell learned only from such a list is released with a review notice when its source goes. Every name is invented
// (checks/backgroundSpellsFixture.ts and checks/expandedSpellSourcesFixture.ts).

const compendium = inMemoryCompendium({
  classes: backgroundSpellClasses(),
  spells: backgroundSpellSpells(),
  backgrounds: backgroundSpellBackgrounds(),
  feats: expandedSpellFeats(),
  races: [...expandedSpellRaces(), ...expandedSpellLineages()],
});
const catalogs = { compendium, activeBooks: ALL_BOOKS };

// The invented half caster loses Spellcasting when it drops from its second level to its first.
const halfCaster: ClassData = {
  ...backgroundSpellClasses()[0],
  name: "Sample Half",
  spellcasting: { ability: "wis", progression: "half" },
};
const halfCompendium = inMemoryCompendium({
  classes: [...backgroundSpellClasses(), halfCaster],
  spells: backgroundSpellSpells(),
  backgrounds: backgroundSpellBackgrounds(),
  feats: expandedSpellFeats(),
  races: expandedSpellRaces(),
});

const cls = (className: string, level: number, extra: Partial<CharacterClass> = {}): CharacterClass => ({
  className,
  source: "TST",
  level,
  ...extra,
});

const takenMark = (featName = "Sample Rune Mark"): AsiSelection => ({
  className: "Sample Mage",
  classLevel: 4,
  level: 4,
  type: "feat",
  featName,
  featSource: "TST",
});

const sampleRunekin = { name: "Sample Runekin", source: "TST", subraceName: "Sample Rune Line", subraceSource: "TST" };

const known = (name: string, className = "Sample Mage") => ({ name, source: "TST", ownerKey: `${className}__TST`, className });

const profileOf = (profiles: ClassSpellProfile[], className: string): ClassSpellProfile => {
  const profile = profiles.find((candidate) => candidate.className === className);
  assert.ok(profile, `expected a ${className} profile`);
  return profile;
};

const spellNamed = (name: string): SpellData => {
  const spell = backgroundSpellSpells().find((candidate) => candidate.name === name);
  if (!spell) throw new Error(`no invented spell named ${name}`);
  return spell;
};

/** Whether the class's spell list, as the picker reads it, offers the spell. */
const offers = (profile: ClassSpellProfile, spellName: string): boolean =>
  isSpellAvailableForClass(spellNamed(spellName), profile.className, undefined, profileSpellContext(profile));

test("a held feat's expanded spells join a spellcasting class's list, cantrips included", () => {
  const mage = profileOf(
    evaluateCharacter(makeChar({ classes: [cls("Sample Mage", 5)], asiSelections: [takenMark()] }), catalogs).spellProfiles,
    "Sample Mage",
  );
  assert.equal(offers(mage, "Sample Warding"), true, "a first-level spell the feat lists is on the list");
  assert.equal(offers(mage, "Sample Ember"), true, "its cantrip is on the list too");
  assert.equal(offers(mage, "Sample Spirit"), false, "a spell no held source lists stays off the list");
});

test("a held race's subrace expanded spells join a spellcasting class's list", () => {
  const mage = profileOf(
    evaluateCharacter(makeChar({ classes: [cls("Sample Mage", 5)], race: sampleRunekin }), catalogs).spellProfiles,
    "Sample Mage",
  );
  assert.equal(offers(mage, "Sample Spirit"), true, "the subrace's third-level spell is on the list");
});

test("a held feat's expanded spells join the list of each spellcasting class of a multiclass character", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [cls("Sample Mage", 3), cls("Sample Pact", 2)], asiSelections: [takenMark()] }),
    catalogs,
  );
  assert.equal(offers(profileOf(evaluated.spellProfiles, "Sample Mage"), "Sample Warding"), true);
  assert.equal(offers(profileOf(evaluated.spellProfiles, "Sample Pact"), "Sample Warding"), true, "the second caster's list gets it too");
});

test("a held feat's expanded spell is not offered to a character with no spellcasting class", () => {
  const evaluated = evaluateCharacter(
    makeChar({ classes: [cls("Sample Warrior", 5)], asiSelections: [takenMark()] }),
    catalogs,
  );
  assert.deepEqual(evaluated.spellProfiles, [], "with no casting class there is no profile to offer it on");
});

test("a spell a held feat lists can be learned by the class that lists it", () => {
  const character = makeChar({ classes: [cls("Sample Mage", 5)], asiSelections: [takenMark()] });
  const mage = profileOf(evaluateCharacter(character, catalogs).spellProfiles, "Sample Mage");
  const warding = { name: "Sample Warding", source: "TST" };
  const learned = learnSpell(character, mage, warding, compendium, ALL_BOOKS);
  assert.equal(isKnown(learned, mage, warding), true, "the spell is learned from the feat's list");
});

test("removing the feat releases the spell only its list gave, with a notice that names the spell and the feat", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    asiSelections: [takenMark()],
    knownSpells: [known("Sample Warding")],
  });
  const released = removeAsiSelection(character, "Sample Mage", 4, compendium, ALL_BOOKS);
  assert.deepEqual(released.knownSpells, [], "the spell only the feat listed leaves the known spells");
  assert.ok(
    released.needsReview?.some((notice) => /Sample Warding removed: only on the Sample Rune Mark feat's spell list/.test(notice)),
    `the release is noticed: ${JSON.stringify(released.needsReview)}`,
  );
});

test("replacing the feat with an ability increase releases the spell its list gave, while a class list keeps the cantrip it also gives", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    asiSelections: [takenMark()],
    knownSpells: [known("Sample Warding"), known("Sample Ember")],
  });
  const replaced = applyAsiSelection(
    character,
    { className: "Sample Mage", classLevel: 4, level: 4, type: "asi", asi: { int: 2 } },
    compendium, ALL_BOOKS,
  );
  assert.deepEqual(replaced.knownSpells?.map((k) => k.name), ["Sample Ember"], "the feat's own spell is released; the cantrip the mage's list gives stays");
  assert.ok(!replaced.needsReview?.some((notice) => /Sample Ember/.test(notice)), "and no notice is made for the cantrip");
});

test("removing a background feat releases the spell its list gave", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    originFeats: [{ level: 0, type: "feat", featName: "Sample Rune Mark", featSource: "TST" }],
    knownSpells: [known("Sample Warding")],
  });
  const released = removeOriginFeat(character, { featName: "Sample Rune Mark", featSource: "TST" }, compendium, ALL_BOOKS);
  assert.deepEqual(released.knownSpells, []);
  assert.ok(released.needsReview?.some((notice) => /Sample Warding removed/.test(notice)), "the release is noticed");
});

test("changing the race releases the spell only its subrace's list gave, with a notice that names the spell and the subrace", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    race: sampleRunekin,
    knownSpells: [known("Sample Spirit")],
  });
  const changed = changeRace(character, compendium, ALL_BOOKS);
  assert.deepEqual(changed.knownSpells, [], "the spell only the subrace listed leaves the known spells");
  assert.ok(
    changed.needsReview?.some((notice) => /Sample Spirit removed: only on the Sample Rune Line race's spell list/.test(notice)),
    `the release is noticed: ${JSON.stringify(changed.needsReview)}`,
  );
});

test("a spell a second held source still lists stays known when one source goes", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    asiSelections: [takenMark()],
    background: { name: "Sample Scholar", source: "TST" },
    knownSpells: [known("Sample Ward")],
  });
  const released = removeAsiSelection(character, "Sample Mage", 4, compendium, ALL_BOOKS);
  assert.deepEqual(released.knownSpells?.map((k) => k.name), ["Sample Ward"], "the background's list still gives it");
  assert.ok(!released.needsReview?.some((notice) => /Sample Ward/.test(notice)), "so no notice is made");
});

test("a spell is judged by the class that owns it: a Pact copy goes when only the feat gave it to Pact, though the Mage still lists it", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 3), cls("Sample Pact", 2)],
    asiSelections: [takenMark()],
    knownSpells: [known("Sample Ember", "Sample Pact"), known("Sample Ember", "Sample Mage")],
  });
  const released = removeAsiSelection(character, "Sample Mage", 4, compendium, ALL_BOOKS);
  assert.deepEqual(
    released.knownSpells?.map((k) => k.ownerKey),
    ["Sample Mage__TST"],
    "the Pact's copy is released; the Mage's own list keeps its copy",
  );
  assert.ok(
    released.needsReview?.some((notice) => /Sample Ember removed: only on the Sample Rune Mark feat's spell list/.test(notice)),
    `the release is noticed: ${JSON.stringify(released.needsReview)}`,
  );
});

test("picking a different race or subrace in the ancestry picker releases the spell only the old subrace's list gave", () => {
  const [runekin] = expandedSpellRaces();
  const [runeLine] = runekin.subraces ?? [];
  assert.ok(runeLine, "the invented race has its subrace");
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    race: sampleRunekin,
    knownSpells: [known("Sample Spirit")],
  });
  const picked = applyAncestrySelection(character, runekin, undefined, catalogs);
  assert.deepEqual(picked.knownSpells, [], "the spell only the old subrace listed leaves the known spells");
  assert.ok(
    picked.needsReview?.some((notice) => /Sample Spirit removed: only on the Sample Rune Line race's spell list/.test(notice)),
    `the release is noticed: ${JSON.stringify(picked.needsReview)}`,
  );
});

test("swapping an origin feat for another releases the spell only the replaced feat's list gave, with a notice", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    originFeats: [{ level: 0, type: "feat", featName: "Sample Rune Mark", featSource: "TST" }],
    knownSpells: [known("Sample Warding")],
  });
  const swapped = applyOriginFeat(
    character,
    { level: 0, type: "feat", featName: "Sample Rune Sign", featSource: "TST" },
    { featName: "Sample Rune Mark", featSource: "TST" },
    compendium, ALL_BOOKS,
  );
  assert.deepEqual(swapped.knownSpells, [], "the spell only the replaced feat listed leaves the known spells");
  assert.ok(
    swapped.needsReview?.some((notice) => /Sample Warding removed: only on the Sample Rune Mark feat's spell list/.test(notice)),
    `the release is noticed: ${JSON.stringify(swapped.needsReview)}`,
  );
});

test("clearing the background keeps a spell a held feat's list still gives", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    asiSelections: [takenMark()],
    background: { name: "Sample Scholar", source: "TST" },
    knownSpells: [known("Sample Ward")],
  });
  const cleared = clearBackground(character, catalogs);
  assert.deepEqual(cleared.knownSpells?.map((k) => k.name), ["Sample Ward"], "the feat's list still gives it");
});

test("clearing a background-claimed feat held in two active books releases the spell only the record the reader offers lists", () => {
  // The record in TST is the first of the catalog and lists Sample Warding; the background's book, TST2, lists Sample Ward.
  const twinIn = (source: string, spell: string): FeatData => ({
    name: "Sample Twin",
    source,
    prerequisite: null,
    abilityScoreIncrease: null,
    description: "Placeholder description for the feat.",
    additionalSpells: [{ expanded: { s1: [spell] } }],
  });
  const twins = inMemoryCompendium(
    {
      classes: backgroundSpellClasses(),
      spells: backgroundSpellSpells(),
      backgrounds: backgroundSpellBackgrounds(),
      feats: [twinIn("TST", "sample warding"), twinIn("TST2", "sample ward")],
    },
    { integrated: true },
  );
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    background: { name: "Sample Scholar", source: "TST2" },
    originFeats: [{ level: 1, type: "feat", featName: "Sample Twin", featSource: BACKGROUND_FEAT_SOURCE }],
    knownSpells: [known("Sample Warding")],
  });
  const cleared = clearBackground(character, { compendium: twins, activeBooks: ["TST", "TST2"] });
  assert.deepEqual(cleared.knownSpells, [], "the spell only the record the reader offers listed leaves the known spells");
  assert.ok(
    cleared.needsReview?.some((notice) => /Sample Warding removed: only on the Sample Twin feat's spell list/.test(notice)),
    `the release is noticed: ${JSON.stringify(cleared.needsReview)}`,
  );
});

test("removing the only spellcasting class releases a spell only its background's list gave, with a notice", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 1)],
    background: { name: "Sample Scholar", source: "TST" },
    knownSpells: [known("Sample Ward")],
  });
  const removed = removeClassLevel(character, "Sample Mage", compendium, ALL_BOOKS);
  assert.deepEqual(removed.knownSpells, [], "the spell only the background listed leaves the known spells");
  assert.ok(
    removed.needsReview?.some((notice) => /Sample Ward removed: only on the Sample Scholar background's spell list/.test(notice)),
    `the release is noticed: ${JSON.stringify(removed.needsReview)}`,
  );
});

test("losing Spellcasting by dropping a level releases a spell only its background's list gave, with a notice", () => {
  const character = makeChar({
    classes: [cls("Sample Half", 2)],
    background: { name: "Sample Scholar", source: "TST" },
    knownSpells: [known("Sample Ward", "Sample Half")],
  });
  const dropped = removeClassLevel(character, "Sample Half", halfCompendium, ALL_BOOKS);
  assert.deepEqual(dropped.knownSpells, [], "the spell only the background listed leaves the known spells");
  assert.ok(
    dropped.needsReview?.some((notice) => /Sample Ward removed: only on the Sample Scholar background's spell list/.test(notice)),
    `the release is noticed: ${JSON.stringify(dropped.needsReview)}`,
  );
});

test("removing a class keeps a spell that class lists itself, though a background also gives it", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 1)],
    background: { name: "Sample Scribe", source: "TST" },
    knownSpells: [known("Sample Ember")],
  });
  const removed = removeClassLevel(character, "Sample Mage", compendium, ALL_BOOKS);
  assert.deepEqual(removed.knownSpells?.map((k) => k.name), ["Sample Ember"], "the cantrip the mage's own list gives stays");
  assert.ok(!removed.needsReview?.some((notice) => /Sample Ember/.test(notice)), "and no notice is made for it");
});

test("removing a pact class releases the copy only that class's list gave, and keeps the spellcaster's copy its list still gives", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 1), cls("Sample Pact", 1)],
    background: { name: "Sample Scholar", source: "TST" },
    knownSpells: [known("Sample Ward", "Sample Pact"), known("Sample Ward", "Sample Mage")],
  });
  const removed = removeClassLevel(character, "Sample Pact", compendium, ALL_BOOKS);
  assert.deepEqual(
    removed.knownSpells?.map((k) => k.ownerKey),
    ["Sample Mage__TST"],
    "the pact's copy is released; the mage's copy stays, since the background still lists it for the mage",
  );
  assert.ok(
    removed.needsReview?.some((notice) => /Sample Ward removed: only on the Sample Scholar background's spell list/.test(notice)),
    `the release is noticed: ${JSON.stringify(removed.needsReview)}`,
  );
});

test("swapping one lineage for another releases the spell only the old lineage's list gave, with a notice", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    race: { name: "Sample Runekin", source: "TST" },
    lineageReplacement: "Sample Lineage A",
    knownSpells: [known("Sample Warding"), known("Sample Ward")],
  });
  const swapped = changeLineage(character, { kind: "lineage", name: "Sample Lineage B" }, compendium, ALL_BOOKS);
  assert.equal(swapped.lineageReplacement, "Sample Lineage B");
  assert.deepEqual(swapped.knownSpells?.map((k) => k.name), ["Sample Ward"], "the new lineage's list still gives the other spell");
  assert.ok(
    swapped.needsReview?.some((notice) => /Sample Warding removed: only on the Sample Lineage A race's spell list/.test(notice)),
    `the release is noticed: ${JSON.stringify(swapped.needsReview)}`,
  );
});

test("dropping a lineage for no lineage releases the spell its list alone gave", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    race: { name: "Sample Runekin", source: "TST" },
    lineageReplacement: "Sample Lineage A",
    knownSpells: [known("Sample Warding")],
  });
  const dropped = changeLineage(character, { kind: "none" }, compendium, ALL_BOOKS);
  assert.equal(dropped.lineageReplacement, null);
  assert.deepEqual(dropped.knownSpells, [], "the spell only the dropped lineage listed leaves the known spells");
  assert.ok(dropped.needsReview?.some((notice) => /Sample Warding removed: only on the Sample Lineage A race's spell list/.test(notice)));
});

// A held source whose book is switched off leaves its expanded list's spells stranded (ADR 0017). Each source is held on ALT
// and TST stays on; ALT is switched off unless a test says otherwise.

const ALT_OFF = ["TST"];
const ALT_ON = ["TST", "ALT"];
const onAlt = (featName = "Sample Rune Mark"): AsiSelection => ({
  className: "Sample Mage",
  classLevel: 4,
  level: 4,
  type: "feat",
  featName,
  featSource: "ALT",
});
const offBookCompendium = inMemoryCompendium(
  { classes: backgroundSpellClasses(), spells: backgroundSpellSpells(), ...expandedSourcesOfBook("ALT") },
  { integrated: true },
);

/** One held source of each kind, its character, and the spell its expanded list gave with the title its notice names. */
const SOURCE_KINDS = [
  {
    kind: "feat",
    character: makeChar({ classes: [cls("Sample Mage", 5)], asiSelections: [onAlt()], knownSpells: [known("Sample Warding")] }),
    spell: "Sample Warding",
    title: "Sample Rune Mark feat",
  },
  {
    kind: "race",
    character: makeChar({
      classes: [cls("Sample Mage", 5)],
      race: { name: "Sample Runekin", source: "ALT", subraceName: "Sample Rune Line", subraceSource: "ALT" },
      knownSpells: [known("Sample Spirit")],
    }),
    spell: "Sample Spirit",
    title: "Sample Rune Line race",
  },
  {
    kind: "lineage",
    character: makeChar({
      classes: [cls("Sample Mage", 5)],
      lineageReplacement: "Sample Lineage A",
      knownSpells: [known("Sample Warding")],
    }),
    spell: "Sample Warding",
    title: "Sample Lineage A race",
  },
  {
    kind: "background",
    character: makeChar({
      classes: [cls("Sample Mage", 5)],
      background: { name: "Sample Scholar", source: "ALT" },
      knownSpells: [known("Sample Ward")],
    }),
    spell: "Sample Ward",
    title: "Sample Scholar background",
  },
];

for (const source of SOURCE_KINDS) {
  test(`a held ${source.kind}'s spell only its expanded list gave is released with a notice when its book is switched off or the character is opened with it off`, () => {
    assert.deepEqual(
      reconcileForActiveBooks(source.character, offBookCompendium, ALT_ON).knownSpells,
      source.character.knownSpells,
      "with the book on, the spell stays",
    );
    const released = reconcileForActiveBooks(source.character, offBookCompendium, ALT_OFF);
    assert.deepEqual(released.knownSpells, [], "the spell leaves the known spells");
    assert.deepEqual(released.needsReview, [`${source.spell} removed: only on the ${source.title}'s spell list`]);
  });

  test(`switching the ${source.kind}'s book back on after its release restores nothing`, () => {
    const released = reconcileForActiveBooks(source.character, offBookCompendium, ALT_OFF);
    const restored = reconcileForActiveBooks(released, offBookCompendium, ALT_ON);
    assert.deepEqual(restored.knownSpells, [], "the released spell is not restored");
  });
}

test("a spell the character's own class lists stays when the book of a feat that also lists it is switched off", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    asiSelections: [onAlt()],
    knownSpells: [known("Sample Ember")],
  });
  const kept = reconcileForActiveBooks(character, offBookCompendium, ALT_OFF);
  assert.deepEqual(kept.knownSpells, character.knownSpells, "the mage's own cantrip stays");
  assert.equal(kept.needsReview, undefined, "and no notice is made");
});

test("a spell an active source still offers stays when the book of a feat that also lists it is switched off", () => {
  const withActiveScholar = inMemoryCompendium(
    {
      classes: backgroundSpellClasses(),
      spells: backgroundSpellSpells(),
      feats: expandedSourcesOfBook("ALT").feats,
      backgrounds: backgroundSpellBackgrounds(),
    },
    { integrated: true },
  );
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    asiSelections: [onAlt()],
    background: { name: "Sample Scholar", source: "TST" },
    knownSpells: [known("Sample Ward")],
  });
  const kept = reconcileForActiveBooks(character, withActiveScholar, ALT_OFF);
  assert.deepEqual(kept.knownSpells?.map((k) => k.name), ["Sample Ward"], "the active background still lists it");
  assert.equal(kept.needsReview, undefined, "so no notice is made");
});

test("a catalog that does not hold the feat's record at all keeps the spell, as not loaded", () => {
  const withoutFeat = inMemoryCompendium({ classes: backgroundSpellClasses(), spells: backgroundSpellSpells() }, { integrated: true });
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    asiSelections: [onAlt()],
    knownSpells: [known("Sample Warding")],
  });
  const kept = reconcileForActiveBooks(character, withoutFeat, ALT_OFF);
  assert.deepEqual(kept.knownSpells?.map((k) => k.name), ["Sample Warding"], "the record is not loaded, so nothing is judged");
  assert.equal(kept.needsReview, undefined);
});

// A known copy under a Spell Owner key other than the plain class key (Pact of the Tome, the Blessed Warrior cantrips, the Giant
// Power cantrips) is drawn from its own list, not the class list, so no expanded list can have stranded it.
const tomeCopy = (name: string) => ({ name, source: "TST", ownerKey: "Sample Pact__Tome", className: "Sample Pact" });

test("a Pact of the Tome cantrip that a switched-off feat's list also gives stays, with no notice, whichever way the book is set", () => {
  const character = makeChar({
    classes: [cls("Sample Pact", 5)],
    asiSelections: [{ ...onAlt(), className: "Sample Pact" }],
    knownSpells: [tomeCopy("Sample Ember")],
  });
  const kept = reconcileForActiveBooks(character, offBookCompendium, ALT_OFF);
  assert.deepEqual(kept.knownSpells, character.knownSpells, "the tome copy is not judged against the class list");
  assert.equal(kept.needsReview, undefined, "so no notice is made");
  assert.deepEqual(reconcileForActiveBooks(kept, offBookCompendium, ALT_ON).knownSpells, character.knownSpells, "switching the book back on changes nothing");
});

test("a Blessed Warrior style cantrip copy stays when a switched-off feat's list gives the spell", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5), cls("Sample Warrior", 2)],
    asiSelections: [onAlt()],
    knownSpells: [{ name: "Sample Ember", source: "TST", ownerKey: "Sample Warrior__TCE", className: "Sample Warrior" }],
  });
  const kept = reconcileForActiveBooks(character, offBookCompendium, ALT_OFF);
  assert.deepEqual(kept.knownSpells, character.knownSpells, "the copy is drawn from its own owner, not the class list");
  assert.equal(kept.needsReview, undefined);
});

test("a switched-off feat releases its plain class copy and keeps the Pact of the Tome copy of the same spell", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5), cls("Sample Pact", 5)],
    asiSelections: [onAlt()],
    knownSpells: [tomeCopy("Sample Ember"), known("Sample Warding")],
  });
  const released = reconcileForActiveBooks(character, offBookCompendium, ALT_OFF);
  assert.deepEqual(released.knownSpells?.map((k) => k.name), ["Sample Ember"], "only the plain copy that the feat alone listed leaves");
  assert.deepEqual(released.needsReview, ["Sample Warding removed: only on the Sample Rune Mark feat's spell list"]);
});

test("removing the feat keeps a Pact of the Tome copy that no class list gives", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 3), cls("Sample Pact", 2)],
    asiSelections: [takenMark()],
    knownSpells: [tomeCopy("Sample Ember")],
  });
  const released = removeAsiSelection(character, "Sample Mage", 4, compendium, ALL_BOOKS);
  assert.deepEqual(released.knownSpells, character.knownSpells, "the tome copy is not released with the feat");
  assert.equal(released.needsReview, undefined, "so no notice is made");
});

test("removing the feat keeps a Blessed Warrior style cantrip copy", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 3), cls("Sample Warrior", 2)],
    asiSelections: [takenMark()],
    knownSpells: [{ name: "Sample Ember", source: "TST", ownerKey: "Sample Warrior__TCE", className: "Sample Warrior" }],
  });
  const released = removeAsiSelection(character, "Sample Mage", 4, compendium, ALL_BOOKS);
  assert.deepEqual(released.knownSpells, character.knownSpells, "the copy is not released with the feat");
  assert.equal(released.needsReview, undefined, "so no notice is made");
});
