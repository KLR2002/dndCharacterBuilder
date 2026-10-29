import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { isSpellAvailableForClass, profileSpellContext, type ClassSpellProfile } from "../src/rules/spellcasting.ts";
import { clearBackground } from "../src/rules/builderTransitions.ts";
import { resolveCharacterBackground } from "../src/rules/backgroundSpells.ts";
import { isKnown, learnSpell } from "../src/rules/characterSpells.ts";
import { findSpell } from "../src/services/dataService.ts";
import type { CharacterClass } from "../src/types/character.ts";
import type { ClassData, SpellData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, loadSrdCatalog, makeChar } from "./testUtils.ts";
import { backgroundSpellBackgrounds, backgroundSpellClasses, backgroundSpellSpells } from "./backgroundSpellsFixture.ts";

// A background's expanded spell lists join the spell list of every spellcasting class the character has (ADR 0017).
// Every name here is invented (checks/backgroundSpellsFixture.ts), except the Warlock patron, whose list is the real one.

const warlock = loadSrdCatalog<ClassData[]>("classes").find((cls) => cls.name === "Warlock");
if (!warlock) throw new Error("the SRD Baseline has no Warlock class");

const compendium = inMemoryCompendium({
  classes: [...backgroundSpellClasses(), warlock],
  spells: backgroundSpellSpells(),
  backgrounds: backgroundSpellBackgrounds(),
});
const catalogs = { compendium, activeBooks: ALL_BOOKS };

const spellNamed = (name: string): SpellData => {
  const spell = backgroundSpellSpells().find((candidate) => candidate.name === name);
  if (!spell) throw new Error(`no invented spell named ${name}`);
  return spell;
};

const cls = (className: string, level: number, extra: Partial<CharacterClass> = {}): CharacterClass => ({
  className,
  source: "TST",
  level,
  ...extra,
});

const withBackground = (name: string | null, classes: CharacterClass[]) =>
  makeChar({
    classes,
    background: name === null ? null : { name, source: "TST" },
  });

const profileOf = (profiles: ClassSpellProfile[], className: string): ClassSpellProfile => {
  const profile = profiles.find((candidate) => candidate.className === className);
  assert.ok(profile, `expected a ${className} profile`);
  return profile;
};

/** Whether the class's spell list, as the picker reads it, offers the spell. */
const offers = (profile: ClassSpellProfile, spellName: string): boolean =>
  isSpellAvailableForClass(spellNamed(spellName), profile.className, undefined, profileSpellContext(profile));

test("a background's expanded spells join a spellcasting class's list, cantrips included, and no other spell is added", () => {
  const evaluated = evaluateCharacter(withBackground("Sample Scholar", [cls("Sample Mage", 5)]), catalogs);
  const mage = profileOf(evaluated.spellProfiles, "Sample Mage");
  assert.equal(offers(mage, "Sample Chime"), true, "a cantrip the background lists is on the list");
  assert.equal(offers(mage, "Sample Ward"), true, "a 1st level spell the background lists is on the list");
  assert.equal(offers(mage, "Sample Spirit"), true, "a 3rd level spell the background lists is on the list");
  assert.equal(offers(mage, "Sample Warding"), false, "a spell no list names stays off the list");
});

test("the expanded spells join the list of each spellcasting class of a multiclass character", () => {
  const evaluated = evaluateCharacter(
    withBackground("Sample Scholar", [cls("Sample Mage", 5), cls("Sample Pact", 3)]),
    catalogs,
  );
  const mage = profileOf(evaluated.spellProfiles, "Sample Mage");
  const pact = profileOf(evaluated.spellProfiles, "Sample Pact");
  assert.equal(offers(mage, "Sample Ward"), true);
  assert.equal(offers(pact, "Sample Ward"), true, "the second caster's list gets the spell too");
  assert.equal(offers(pact, "Sample Chime"), true, "and its cantrip");
});

test("a character with no spellcasting class gets no spell profile, so the background adds nothing", () => {
  const evaluated = evaluateCharacter(withBackground("Sample Scholar", [cls("Sample Warrior", 5)]), catalogs);
  assert.deepEqual(evaluated.spellProfiles, []);
  assert.equal(
    isSpellAvailableForClass(spellNamed("Sample Ward"), "Sample Warrior", undefined, undefined),
    false,
    "without a profile there is no context, so the background's list is not consulted",
  );
});

test("clearing the background, or taking one with no lists, removes its spells from the list and from the learn pool", () => {
  const spirit = { name: "Sample Spirit", source: "TST" };
  const withScholar = evaluateCharacter(withBackground("Sample Scholar", [cls("Sample Mage", 5)]), catalogs);
  const learned = learnSpell(
    withBackground("Sample Scholar", [cls("Sample Mage", 5)]),
    profileOf(withScholar.spellProfiles, "Sample Mage"),
    spirit,
    compendium, ALL_BOOKS,
  );
  assert.equal(isKnown(learned, profileOf(withScholar.spellProfiles, "Sample Mage"), spirit), true, "the spell is learnable while the background is held");

  for (const [label, name] of [["changed to a background with no lists", "Sample Idler"], ["cleared", null]] as const) {
    const character = withBackground(name, [cls("Sample Mage", 5)]);
    const evaluated = evaluateCharacter(character, catalogs);
    const mage = profileOf(evaluated.spellProfiles, "Sample Mage");
    assert.equal(offers(mage, "Sample Spirit"), false, `${label}: the spell leaves the list`);
    assert.strictEqual(
      learnSpell(character, mage, spirit, compendium, ALL_BOOKS),
      character,
      `${label}: the spell cannot be learned any more`,
    );
  }
});

test("a background's expanded list stacks with a Warlock patron's expanded list", () => {
  const fiend = evaluateCharacter(
    withBackground("Sample Scholar", [cls("Warlock", 5, { subclassName: "The Fiend" })]),
    catalogs,
  );
  const fiendWarlock = profileOf(fiend.spellProfiles, "Warlock");
  const fireball = findSpell("Fireball");
  assert.ok(fireball, "Fireball must exist in the catalog");
  const fireballOnPatron = isSpellAvailableForClass(fireball, "Warlock", undefined, profileSpellContext(fiendWarlock));
  assert.equal(fireballOnPatron, true, "the patron's list still applies");
  assert.equal(offers(fiendWarlock, "Sample Spirit"), true, "and the background's list applies too");

  const archfey = evaluateCharacter(
    withBackground("Sample Scholar", [cls("Warlock", 5, { subclassName: "The Archfey" })]),
    catalogs,
  );
  const archfeyWarlock = profileOf(archfey.spellProfiles, "Warlock");
  assert.equal(
    isSpellAvailableForClass(fireball, "Warlock", undefined, profileSpellContext(archfeyWarlock)),
    false,
    "a patron without the spell does not add it",
  );
  assert.equal(offers(archfeyWarlock, "Sample Spirit"), true, "the background adds its own spells to any patron");
});

test("clearing the background releases the known spells only its list gave, with a notice, and keeps a spell a class list also gives", () => {
  const known = (name: string) => ({ name, source: "TST", ownerKey: "Sample Mage__TST", className: "Sample Mage" });
  const scholar = {
    ...withBackground("Sample Scholar", [cls("Sample Mage", 5)]),
    knownSpells: [known("Sample Chime"), known("Sample Ward")],
  };
  const releasedScholar = clearBackground(scholar, catalogs);
  assert.deepEqual(releasedScholar.knownSpells, [], "both spells came from the background's list alone");
  assert.ok(releasedScholar.needsReview?.some((notice) => /Sample Chime removed/.test(notice)), "the cantrip's release is recorded");
  assert.ok(releasedScholar.needsReview?.some((notice) => /Sample Ward removed/.test(notice)), "and the spell's");

  const scribe = { ...withBackground("Sample Scribe", [cls("Sample Mage", 5)]), knownSpells: [known("Sample Ember")] };
  const releasedScribe = clearBackground(scribe, catalogs);
  assert.deepEqual(releasedScribe.knownSpells?.map((k) => k.name), ["Sample Ember"], "a mage cantrip the class list gives stays known");
  assert.ok(!releasedScribe.needsReview?.some((notice) => /Sample Ember/.test(notice)), "and no notice is made for it");
});

test("a background held in two books resolves to the record of the active book when the saved source is not listed", () => {
  const record = (source: string) => ({
    name: "Sample Scholar",
    source,
    skillProficiencies: [],
    toolProficiencies: [],
    languages: [],
    startingEquipment: [],
    feature: null,
    characteristics: {},
    description: "",
  });
  const character = makeChar({ background: { name: "Sample Scholar", source: "GONE" } });
  assert.equal(resolveCharacterBackground(character, [record("OLD"), record("ALT")], ["ALT"])?.source, "ALT");
  assert.equal(resolveCharacterBackground(character, [record("OLD"), record("ALT")], ALL_BOOKS)?.source, "OLD", "without active books, the first listed");
});

test("a custom background named like a catalog background never resolves to the catalog record", () => {
  const backgrounds = backgroundSpellBackgrounds();
  const builtIn = makeChar({ background: { name: "Sample Scholar", source: "TST" } });
  const builderCustom = makeChar({ background: { name: "Sample Scholar", source: "Custom" } });
  const flaggedCustom = makeChar({ background: { name: "Sample Scholar", source: "TST", isCustom: true } });
  assert.ok(resolveCharacterBackground(builtIn, backgrounds, ALL_BOOKS), "a catalog background still resolves for a built-in pick");
  assert.equal(resolveCharacterBackground(builderCustom, backgrounds, ALL_BOOKS), undefined, "a Builder custom background resolves to nothing");
  assert.equal(resolveCharacterBackground(flaggedCustom, backgrounds, ALL_BOOKS), undefined, "a flagged custom background resolves to nothing");
});
