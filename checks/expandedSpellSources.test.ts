import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { isSpellAvailableForClass, profileSpellContext, type ClassSpellProfile } from "../src/rules/spellcasting.ts";
import { changeRace, clearBackground } from "../src/rules/builderTransitions.ts";
import { applyAncestrySelection } from "../src/rules/ancestryEngine.ts";
import { applyAsiSelection, removeAsiSelection } from "../src/rules/leveling.ts";
import { removeOriginFeat } from "../src/rules/feats.ts";
import { isKnown, learnSpell } from "../src/rules/characterSpells.ts";
import type { AsiSelection, Character, CharacterClass } from "../src/types/character.ts";
import type { ClassData, SpellData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { backgroundSpellBackgrounds, backgroundSpellClasses, backgroundSpellSpells } from "./backgroundSpellsFixture.ts";
import { expandedSpellFeats, expandedSpellRaces } from "./expandedSpellSourcesFixture.ts";

// A held feat's or race's expanded lists join the spell list of every spellcasting class, as a background's do (ADR 0017).
// A spell learned only from such a list is released with a review notice when its source goes. Every name is invented
// (checks/backgroundSpellsFixture.ts and checks/expandedSpellSourcesFixture.ts).

const compendium = inMemoryCompendium({
  classes: backgroundSpellClasses(),
  spells: backgroundSpellSpells(),
  backgrounds: backgroundSpellBackgrounds(),
  feats: expandedSpellFeats(),
  races: expandedSpellRaces(),
});
const catalogs = { compendium };

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
  const learned = learnSpell(character, mage, warding, compendium);
  assert.equal(isKnown(learned, mage, warding), true, "the spell is learned from the feat's list");
});

test("removing the feat releases the spell only its list gave, with a notice that names the spell and the feat", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    asiSelections: [takenMark()],
    knownSpells: [known("Sample Warding")],
  });
  const released = removeAsiSelection(character, "Sample Mage", 4, compendium);
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
    compendium,
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
  const released = removeOriginFeat(character, "Sample Rune Mark", compendium);
  assert.deepEqual(released.knownSpells, []);
  assert.ok(released.needsReview?.some((notice) => /Sample Warding removed/.test(notice)), "the release is noticed");
});

test("changing the race releases the spell only its subrace's list gave, with a notice that names the spell and the subrace", () => {
  const character = makeChar({
    classes: [cls("Sample Mage", 5)],
    race: sampleRunekin,
    knownSpells: [known("Sample Spirit")],
  });
  const changed = changeRace(character, compendium);
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
  const released = removeAsiSelection(character, "Sample Mage", 4, compendium);
  assert.deepEqual(released.knownSpells?.map((k) => k.name), ["Sample Ward"], "the background's list still gives it");
  assert.ok(!released.needsReview?.some((notice) => /Sample Ward/.test(notice)), "so no notice is made");
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
