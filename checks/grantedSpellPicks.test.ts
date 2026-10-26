import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { featSpellRuleChoices, pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { applyOriginFeat, removeOriginFeat } from "../src/rules/feats.ts";
import { reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import type { AbilityScores, AsiSelection, Character, CharacterClass } from "../src/types/character.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import type { InnateSpellProfile } from "../src/rules/innateMagic.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedSpellClasses, grantedSpellFeats, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// Picks for a granted spell list (ADR 0017, ticket 02). Every name is invented (checks/grantedSpellsFixture.ts).
// Sample Initiate offers a Mage list and a Cleric list; each takes two cantrips and one first-level spell. The
// Cleric list's cantrip Sample Spark is in the second invented book TST2, so it is offered only when TST2 is active.

const compendium = inMemoryCompendium({
  classes: grantedSpellClasses(),
  feats: grantedSpellFeats(),
  spells: grantedSpellSpells(),
});

const ACTIVE = ["TST"];
const ALL_BOOKS = ["TST", "TST2"];
const catalogsFor = (activeBooks: string[] | undefined) => ({ compendium, activeBooks });
const catalogs = catalogsFor(ACTIVE);

const scores = (overrides: Partial<AbilityScores>): AbilityScores => ({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  ...overrides,
});

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });

const takenFeat = (featName: string, featAbility?: "int" | "wis" | "cha"): AsiSelection => ({
  level: 4,
  type: "feat",
  featName,
  featSource: "TST",
  ...(featAbility ? { featAbility } : {}),
});

/** Every offered feat-spell choice of the character, with the feat's name read from the choice id. */
const offeredChoices = (character: Character, activeBooks: string[] | undefined = ACTIVE): AvailableRuleChoice[] =>
  featSpellRuleChoices(character, compendium, activeBooks);

/** The feat a feat-spell choice belongs to: the second segment after its source, in the id. */
const featOf = (choice: AvailableRuleChoice): string => choice.id.split("__")[2];

/**
 * Records the option a player would tick: the one offered choice of `featName` that lists it. Each call reconciles
 * the character, as the builder does.
 */
function pickOption(character: Character, option: string, featName: string, activeBooks: string[] | undefined = ACTIVE): Character {
  const choice = offeredChoices(character, activeBooks).find((c) => featOf(c) === featName && c.options.some((o) => o.name === option));
  assert.ok(choice, `${option} is offered for ${featName}`);
  return pickRuleChoice(character, choice, option, compendium);
}

const cardTitled = (sources: InnateSpellProfile[], title: string) => sources.find((source) => source.title === title);

test("choosing a spell list offers the lists of the feat and asks for the list before any spell", () => {
  const character = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Initiate")], baseAbilityScores: scores({ int: 14 }) });
  const list = offeredChoices(character).find((c) => featOf(c) === "Sample Initiate" && c.options.length === 2);
  assert.ok(list, "the list choice is offered for the feat");
  assert.equal(list.choose, 1, "one list is picked");
  assert.deepEqual(list.options.map((o) => o.name).sort(), ["Sample Cleric Spells", "Sample Mage Spells"]);
  assert.equal(list.origin, "feat");
});

test("a picked list gives a card titled by the feat and the list, at that list's ability, and waits for its spells", () => {
  const picked = pickOption(
    makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Initiate")], baseAbilityScores: scores({ int: 14 }) }),
    "Sample Mage Spells",
    "Sample Initiate",
  );
  const card = cardTitled(evaluateCharacter(picked, catalogs).grantedSpellSources, "Sample Initiate (Sample Mage)");
  assert.ok(card, "the card is titled by the feat and the picked list");
  assert.equal(card.ability, "int", "the ability is the list's own");
  assert.equal(card.spellSaveDc, 8 + 2 + 2, "8 + proficiency bonus + INT 14");
  assert.equal(card.spellAttackBonus, 2 + 2);
  assert.equal(card.spells.length, 0, "no spell is invented before it is picked");
  assert.ok(card.notices?.some((notice) => /2 more spells/.test(notice)), "the two cantrips are still owed");
  assert.ok(card.notices?.some((notice) => /1 more spell/.test(notice)), "the first-level spell is still owed");
});

test("the picked cantrips are at will and the picked spell is one use per Long Rest, with counters naming the list", () => {
  let character = pickOption(makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Initiate")] }), "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  character = pickOption(character, "Sample Glimmer", "Sample Initiate");
  character = pickOption(character, "Sample Pulse", "Sample Initiate");
  const evaluated = evaluateCharacter(character, catalogs);
  const card = cardTitled(evaluated.grantedSpellSources, "Sample Initiate (Sample Mage)");
  assert.ok(card);
  assert.deepEqual(card.notices ?? [], [], "nothing is owed once every pick is made");
  const ember = card.spells.find((spell) => spell.name === "Sample Ember");
  assert.equal(ember?.isCantrip, true);
  assert.equal(ember?.resourceCounterId, undefined, "a cantrip is at will");
  const pulse = card.spells.find((spell) => spell.name === "Sample Pulse");
  assert.ok(pulse?.resourceCounterId, "the first-level spell has a counter");
  assert.equal(pulse.maxUses, 1);
  assert.ok(pulse.resourceCounterId.includes("sample_mage_spells"), "the counter names the list, so a pick never shares one");
  assert.ok(pulse.resourceCounterId.includes("sample_pulse"), "and the spell");
  assert.ok(
    !evaluated.spellProfiles.some((profile) => profile.knownSpells.some((spell) => spell.name === "Sample Ember")),
    "a picked cantrip is not a known spell of the class",
  );
});

test("the offered cantrips and spell are limited to the filter's class, and to the active books", () => {
  const listed = pickOption(makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Initiate")] }), "Sample Cleric Spells", "Sample Initiate");
  const cantrips = offeredChoices(listed, ACTIVE).find((c) => featOf(c) === "Sample Initiate" && c.options.some((o) => o.name === "Sample Blessing"));
  assert.ok(cantrips, "the Cleric cantrips are offered");
  assert.deepEqual(cantrips.options.map((o) => o.name), ["Sample Blessing"], "Sample Spark is in a book that is off, and no Mage cantrip is a Cleric one");
  const cantripsAllBooks = offeredChoices(listed, ALL_BOOKS).find((c) => featOf(c) === "Sample Initiate" && c.options.some((o) => o.name === "Sample Blessing"));
  assert.deepEqual(cantripsAllBooks?.options.map((o) => o.name), ["Sample Blessing", "Sample Spark"], "with TST2 on, its cantrip is offered");
  const spell = offeredChoices(listed, ACTIVE).find((c) => featOf(c) === "Sample Initiate" && c.options.some((o) => o.name === "Sample Ward"));
  assert.deepEqual(spell?.options.map((o) => o.name), ["Sample Ward"], "the first-level choice is limited to the Cleric list too");
});

test("a pick of a spell from a switched-off book resolves to nothing, and that part is owed again", () => {
  let character = pickOption(makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Initiate")] }), "Sample Cleric Spells", "Sample Initiate", ALL_BOOKS);
  character = pickOption(character, "Sample Blessing", "Sample Initiate", ALL_BOOKS);
  character = pickOption(character, "Sample Spark", "Sample Initiate", ALL_BOOKS);
  character = pickOption(character, "Sample Ward", "Sample Initiate", ALL_BOOKS);
  const off = cardTitled(evaluateCharacter(character, catalogsFor(ACTIVE)).grantedSpellSources, "Sample Initiate (Sample Cleric)");
  assert.ok(off);
  assert.deepEqual(off.spells.map((s) => s.name).sort(), ["Sample Blessing", "Sample Ward"], "only the spells of books that are on");
  assert.ok(!off.spells.some((s) => s.name === "Sample Spark"));
  assert.ok(off.notices?.some((notice) => /1 more spell/.test(notice)), "the switched-off cantrip is owed again");
});

test("a filter key this ticket does not support matches nothing, so its pick is owed and never guessed", () => {
  const character = pickOption(makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Odd Initiate")] }), "Sample Odd Spells", "Sample Odd Initiate");
  const spell = offeredChoices(character).find((c) => c.traitName === "Sample Odd Initiate Spell");
  assert.ok(spell, "the spell pick is still shown");
  assert.deepEqual(spell.options, [], "an unknown key offers no spell");
  const card = cardTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Odd Initiate (Sample Odd)");
  assert.ok(card?.notices?.some((notice) => /1 more spell/.test(notice)));
});

test("removing the feat releases its picks, and raises a review notice", () => {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Initiate")] });
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  character = pickOption(character, "Sample Pulse", "Sample Initiate");
  assert.ok((character.ruleChoices ?? []).length > 0, "the picks are saved");

  const removed = removeOriginFeat(character, "Sample Initiate", compendium);
  assert.deepEqual(removed.ruleChoices ?? [], [], "every pick of the feat is released");
  assert.ok(removed.needsReview?.some((notice) => /Sample Initiate/.test(notice)), "the release is recorded for review");
  assert.equal(evaluateCharacter(removed, catalogs).grantedSpellSources.length, 0, "and its card is gone");
});

test("swapping the feat releases the old feat's picks, and the new feat starts with none", () => {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Initiate")] });
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  const swapped = applyOriginFeat(character, takenFeat("Sample Initiate Alt"), "Sample Initiate", compendium);
  assert.ok(!(swapped.ruleChoices ?? []).some((rc) => rc.id.includes("Sample Initiate__") && !rc.id.includes("Alt")), "the old feat's picks are gone");
  assert.ok(swapped.needsReview?.some((notice) => /Sample Initiate/.test(notice)));
  assert.ok(!evaluateCharacter(swapped, catalogs).grantedSpellSources.some((source) => source.title.startsWith("Sample Initiate (")));
});

test("two sources that both hold picks never collide: each keeps its own cards and counters, and releasing one keeps the other", () => {
  let character = makeChar({
    classes: [mage(4)],
    originFeats: [takenFeat("Sample Initiate")],
    asiSelections: [takenFeat("Sample Initiate Alt")],
  });
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  character = pickOption(character, "Sample Pulse", "Sample Initiate");
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate Alt");
  character = pickOption(character, "Sample Glimmer", "Sample Initiate Alt");
  character = pickOption(character, "Sample Pulse", "Sample Initiate Alt");

  const both = evaluateCharacter(character, catalogs).grantedSpellSources;
  const first = cardTitled(both, "Sample Initiate (Sample Mage)");
  const second = cardTitled(both, "Sample Initiate Alt (Sample Mage)");
  assert.ok(first && second, "each feat has its own card");
  const counters = [first, second].map((card) => card.spells.find((s) => s.name === "Sample Pulse")?.resourceCounterId);
  assert.notEqual(counters[0], counters[1], "the two counters are different");
  assert.ok(counters.every(Boolean));

  const releasedOne = removeOriginFeat(character, "Sample Initiate", compendium);
  const kept = cardTitled(evaluateCharacter(releasedOne, catalogs).grantedSpellSources, "Sample Initiate Alt (Sample Mage)");
  assert.ok(kept?.spells.some((s) => s.name === "Sample Glimmer"), "the other feat keeps its picks");
  assert.ok(!releasedOne.needsReview?.some((notice) => /Sample Initiate Alt/.test(notice)), "and gets no notice for it");
});

test("changing the spell list releases the picks made under the old list, with a notice", () => {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Initiate")] });
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  const changed = pickOption(character, "Sample Cleric Spells", "Sample Initiate");
  assert.ok(!(changed.ruleChoices ?? []).some((rc) => rc.id.includes("Mage") || rc.picked.includes("Sample Ember")), "the Mage picks are gone");
  assert.ok(changed.needsReview?.some((notice) => /Sample Initiate/.test(notice)));
});

test("a book switched off releases a pick that is no longer offered, with a notice", () => {
  let character = pickOption(makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Initiate")] }), "Sample Cleric Spells", "Sample Initiate", ALL_BOOKS);
  character = pickOption(character, "Sample Spark", "Sample Initiate", ALL_BOOKS);
  const reconciled = reconcileForActiveBooks(character, compendium, ACTIVE);
  assert.ok(!(reconciled.ruleChoices ?? []).some((rc) => rc.picked.includes("Sample Spark")), "the pick is released");
  assert.ok(reconciled.needsReview?.some((notice) => /Sample Initiate/.test(notice)));
});
