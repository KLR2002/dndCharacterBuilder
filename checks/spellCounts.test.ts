import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { spellCounts } from "../src/rules/spellCounts.ts";
import { spellPage } from "../src/rules/spellPage.ts";
import { isCreationStepValid } from "../src/rules/creationFlow.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { ownerKey as featSpellOwnerKey } from "../src/rules/spellGrants.ts";
import { createCompendium } from "../src/services/compendium.ts";
import type { CharacterCatalogs } from "../src/rules/catalogs.ts";
import type { ClassSpellProfile } from "../src/rules/spellcasting.ts";
import type { Character, KnownSpell } from "../src/types/character.ts";
import type { SpellData } from "../src/types/dnd5e.ts";
import {
  integratedTestCompendium,
  makeChar,
  srdBaselineBundle,
  srdBaselineCompendium,
} from "./testUtils.ts";

const srd = srdBaselineCompendium();
const srdCatalogs: CharacterCatalogs = { compendium: srd, activeBooks: ALL_BOOKS };

/** The first `count` SRD spells of a level, so the fixtures name real records without typing their names. */
function srdSpells(level: "cantrip" | "leveled", count: number): SpellData[] {
  const picked = srd
    .for()
    .spells()
    .filter((s) => (level === "cantrip" ? s.level === 0 : s.level > 0));
  assert.ok(picked.length >= count, `the SRD Baseline has ${count} ${level} spells`);
  return picked.slice(0, count);
}

function owned(spells: SpellData[], ownerKey: string): KnownSpell[] {
  return spells.map((s) => ({ name: s.name, source: s.source, ownerKey }));
}

function profileOf(character: Character, className: string, catalogs: CharacterCatalogs = srdCatalogs): ClassSpellProfile {
  const profile = evaluateCharacter(character, catalogs).spellProfiles.find((p) => p.className === className);
  assert.ok(profile, `${className} has a spell profile`);
  return profile;
}

test("a Wizard 1 with 3 cantrips and 6 spellbook spells meets both counts", () => {
  const wizard = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
    knownSpells: [...owned(srdSpells("cantrip", 3), "Wizard__PHB"), ...owned(srdSpells("leveled", 6), "Wizard__PHB")],
  });
  const counts = spellCounts(wizard, profileOf(wizard, "Wizard"), srdCatalogs);
  assert.deepEqual(counts.cantrips, { known: 3, due: 3 });
  assert.deepEqual(counts.spells, { known: 6, due: 6, kind: "spellbook" });
});

test("a Wizard 3 with 8 spellbook spells is due 10 and not met", () => {
  const wizard = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
    knownSpells: owned(srdSpells("leveled", 8), "Wizard__PHB"),
  });
  const counts = spellCounts(wizard, profileOf(wizard, "Wizard"), srdCatalogs);
  assert.deepEqual(counts.spells, { known: 8, due: 10, kind: "spellbook" });
});

test("a Sorcerer 1 with 4 cantrips and 2 spells is met, and a feat's spell does not count", () => {
  const sorcerer = makeChar({
    classes: [{ className: "Sorcerer", source: "PHB", level: 1 }],
    knownSpells: [...owned(srdSpells("cantrip", 4), "Sorcerer__PHB"), ...owned(srdSpells("leveled", 2), "Sorcerer__PHB")],
  });
  const before = spellCounts(sorcerer, profileOf(sorcerer, "Sorcerer"), srdCatalogs);
  assert.deepEqual(before.cantrips, { known: 4, due: 4 });
  assert.deepEqual(before.spells, { known: 2, due: 2, kind: "known" });

  const featSpell = srdSpells("leveled", 3)[2];
  const withFeat = makeChar({
    ...sorcerer,
    knownSpells: [
      ...(sorcerer.knownSpells ?? []),
      { name: featSpell.name, source: featSpell.source, ownerKey: featSpellOwnerKey({ kind: "feat", source: "PHB", name: "Sample Initiate" }) },
    ],
  });
  const after = spellCounts(withFeat, profileOf(withFeat, "Sorcerer"), srdCatalogs);
  assert.deepEqual(after.spells, { known: 2, due: 2, kind: "known" });
});

test("a Warlock 3's Pact of the Tome cantrips are not counted", () => {
  const warlock = makeChar({
    classes: [{ className: "Warlock", source: "PHB", level: 3 }],
    knownSpells: [
      ...owned(srdSpells("cantrip", 2), "Warlock__PHB"),
      ...owned(srdSpells("cantrip", 3).slice(2), "Warlock__Tome"),
    ],
  });
  const counts = spellCounts(warlock, profileOf(warlock, "Warlock"), srdCatalogs);
  assert.deepEqual(counts.cantrips, { known: 2, due: 2 });
});

test("a Cleric 1 is due 3 cantrips and has no spell count", () => {
  const cleric = makeChar({ classes: [{ className: "Cleric", source: "PHB", level: 1 }] });
  const counts = spellCounts(cleric, profileOf(cleric, "Cleric"), srdCatalogs);
  assert.equal(counts.cantrips?.due, 3);
  assert.equal(counts.spells, null);
});

test("a Paladin has neither count", () => {
  const paladin = makeChar({ classes: [{ className: "Paladin", source: "PHB", level: 2 }] });
  const counts = spellCounts(paladin, profileOf(paladin, "Paladin"), srdCatalogs);
  assert.deepEqual(counts, { cantrips: null, spells: null });
});

test("a multiclass Wizard 3 and Sorcerer 1 each count by their own level", () => {
  const multi = makeChar({
    classes: [
      { className: "Wizard", source: "PHB", level: 3 },
      { className: "Sorcerer", source: "PHB", level: 1 },
    ],
    knownSpells: [
      ...owned(srdSpells("leveled", 8), "Wizard__PHB"),
      ...owned(srdSpells("cantrip", 4), "Sorcerer__PHB"),
    ],
  });
  const wizard = spellCounts(multi, profileOf(multi, "Wizard"), srdCatalogs);
  const sorcerer = spellCounts(multi, profileOf(multi, "Sorcerer"), srdCatalogs);
  assert.deepEqual(wizard.spells, { known: 8, due: 10, kind: "spellbook" });
  assert.deepEqual(sorcerer.cantrips, { known: 4, due: 4 });
  assert.deepEqual(sorcerer.spells, { known: 0, due: 2, kind: "known" });
});

test("a stale Catalog gives no counts", () => {
  const stale = createCompendium({ ...srdBaselineBundle(), hasIntegratedCatalog: true, catalogFormat: 16 });
  assert.equal(stale.stale, true);
  const staleCatalogs: CharacterCatalogs = { compendium: stale, activeBooks: ALL_BOOKS };
  const wizard = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
    knownSpells: owned(srdSpells("leveled", 6), "Wizard__PHB"),
  });
  assert.deepEqual(spellCounts(wizard, profileOf(wizard, "Wizard", staleCatalogs), staleCatalogs), { cantrips: null, spells: null });
});

test("an Eldritch Knight 3 is due the subclass's cantrips and spells", () => {
  const compendium = integratedTestCompendium();
  const catalogs: CharacterCatalogs = { compendium, activeBooks: ALL_BOOKS };
  const knight = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 3, subclassName: "Eldritch Knight", subclassSource: "PHB" }],
  });
  const counts = spellCounts(knight, profileOf(knight, "Fighter", catalogs), catalogs);
  assert.equal(counts.cantrips?.due, 2);
  assert.equal(counts.spells?.due, 3);
  assert.equal(counts.spells?.kind, "known");
});

test("the Spells page states the counts of the open owner, warning when they are not met", () => {
  const met = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
    knownSpells: [...owned(srdSpells("cantrip", 3), "Wizard__PHB"), ...owned(srdSpells("leveled", 6), "Wizard__PHB")],
  });
  assert.deepEqual(spellPage(met, srdCatalogs).counts, {
    cantrips: { text: "Cantrips 3/3", warn: false },
    spells: { text: "Spellbook 6/6", warn: false },
  });

  const short = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
    knownSpells: [...owned(srdSpells("cantrip", 4), "Wizard__PHB"), ...owned(srdSpells("leveled", 8), "Wizard__PHB")],
  });
  assert.deepEqual(spellPage(short, srdCatalogs).counts, {
    cantrips: { text: "Cantrips 4/3", warn: true },
    spells: { text: "Spellbook 8/10", warn: true },
  });

  const overSpellbook = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
    knownSpells: [...owned(srdSpells("cantrip", 3), "Wizard__PHB"), ...owned(srdSpells("leveled", 7), "Wizard__PHB")],
  });
  assert.equal(spellPage(overSpellbook, srdCatalogs).counts.spells?.warn, false, "a spellbook warns only when below");
});

test("the creation Spells step is incomplete until a Wizard 1's spellbook holds 6 spells", () => {
  const draft = (spellbook: number) =>
    makeChar({
      classes: [{ className: "Wizard", source: "PHB", level: 1 }],
      knownSpells: [...owned(srdSpells("cantrip", 3), "Wizard__PHB"), ...owned(srdSpells("leveled", spellbook), "Wizard__PHB")],
    });
  assert.equal(isCreationStepValid(draft(5), "spells", { compendium: srd, activeBooks: ALL_BOOKS }), false);
  assert.equal(isCreationStepValid(draft(6), "spells", { compendium: srd, activeBooks: ALL_BOOKS }), true);
});

test("the creation Spells step is complete for a class with no counts", () => {
  const paladin = makeChar({ classes: [{ className: "Paladin", source: "PHB", level: 2 }] });
  assert.equal(isCreationStepValid(paladin, "spells", { compendium: srd, activeBooks: ALL_BOOKS }), true);
});
