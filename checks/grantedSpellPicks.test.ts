import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { featSpellRuleChoices, pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { applyOriginFeat, getBackgroundFeatGrant, grantBackgroundFeat, removeOriginFeat } from "../src/rules/feats.ts";
import { reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { clearBackground } from "../src/rules/builderTransitions.ts";
import { resolveAncestryState } from "../src/rules/ancestryEngine.ts";
import { toggleInnateSpellUse } from "../src/rules/characterSpells.ts";
import type { AbilityScores, AsiSelection, Character, CharacterClass } from "../src/types/character.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import type { InnateSpellProfile } from "../src/rules/innateMagic.ts";
import { BACKGROUND_FEAT_SOURCE } from "../src/constants/rules.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedSpellBackgrounds, grantedSpellClasses, grantedSpellFeats, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// Picks for a granted spell list (ADR 0017). Every name is invented (checks/grantedSpellsFixture.ts).
// Sample Initiate offers a Mage list and a Cleric list; each takes two cantrips and one first-level spell. The
// Cleric list's cantrip Sample Spark is in the second invented book TST2, so it is offered only when TST2 is active.

const compendium = inMemoryCompendium({
  classes: grantedSpellClasses(),
  feats: grantedSpellFeats(),
  spells: grantedSpellSpells(),
  backgrounds: grantedSpellBackgrounds(),
});

const ACTIVE = ["TST"];
const TEST_BOOKS = ["TST", "TST2"];
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
  return pickRuleChoice(character, choice, option, compendium, ALL_BOOKS);
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
  const cantripsAllBooks = offeredChoices(listed, TEST_BOOKS).find((c) => featOf(c) === "Sample Initiate" && c.options.some((o) => o.name === "Sample Blessing"));
  assert.deepEqual(cantripsAllBooks?.options.map((o) => o.name), ["Sample Blessing", "Sample Spark"], "with TST2 on, its cantrip is offered");
  const spell = offeredChoices(listed, ACTIVE).find((c) => featOf(c) === "Sample Initiate" && c.options.some((o) => o.name === "Sample Ward"));
  assert.deepEqual(spell?.options.map((o) => o.name), ["Sample Ward"], "the first-level choice is limited to the Cleric list too");
});

test("a pick of a spell from a switched-off book resolves to nothing, and that part is owed again", () => {
  let character = pickOption(makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Initiate")] }), "Sample Cleric Spells", "Sample Initiate", TEST_BOOKS);
  character = pickOption(character, "Sample Blessing", "Sample Initiate", TEST_BOOKS);
  character = pickOption(character, "Sample Spark", "Sample Initiate", TEST_BOOKS);
  character = pickOption(character, "Sample Ward", "Sample Initiate", TEST_BOOKS);
  const off = cardTitled(evaluateCharacter(character, catalogsFor(ACTIVE)).grantedSpellSources, "Sample Initiate (Sample Cleric)");
  assert.ok(off);
  assert.deepEqual(off.spells.map((s) => s.name).sort(), ["Sample Blessing", "Sample Ward"], "only the spells of books that are on");
  assert.ok(!off.spells.some((s) => s.name === "Sample Spark"));
  assert.ok(off.notices?.some((notice) => /1 more spell/.test(notice)), "the switched-off cantrip is owed again");
});

test("a pick whose filter uses a key the reader does not model is not offered, and its feat gives no card", () => {
  const character = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Odd Initiate")] });
  assert.equal(offeredChoices(character).some((c) => featOf(c) === "Sample Odd Initiate"), false, "no list and no spell pick is offered");
  assert.equal(
    evaluateCharacter(character, catalogs).grantedSpellSources.some((source) => source.title.startsWith("Sample Odd Initiate")),
    false,
    "no card, since nothing on it can be filled",
  );
});

test("a leveled spell picked from a feat's known group is cast once per Long Rest", () => {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Lesson")] });
  character = pickOption(character, "Sample Pulse", "Sample Lesson");
  const pulse = cardTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Lesson")?.spells.find((s) => s.name === "Sample Pulse");
  assert.ok(pulse?.resourceCounterId, "the picked spell has a Long Rest counter");
  assert.equal(pulse.maxUses, 1);
});

test("a prepared group with a chosen ability is Innate Magic: the ability is offered, and its card holds the spell until it is picked", () => {
  const character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Boon")] });
  assert.equal(offeredChoices(character).some((c) => featOf(c) === "Sample Boon"), true, "the ability is offered");
  const evaluated = evaluateCharacter(character, catalogs);
  const card = cardTitled(evaluated.grantedSpellSources, "Sample Boon");
  assert.ok(card, "the feat has its card");
  assert.deepEqual(card.notices, ["Needs review: choose a casting ability"]);
  assert.ok(card.spells.some((spell) => spell.name === "Sample Veil"), "the spell is on the card");
  assert.ok(
    !evaluated.spellProfiles.some((profile) => profile.alwaysPreparedSpells?.some((spell) => spell.name === "Sample Veil")),
    "and it is in no class list",
  );
});

test("named lists of ritual spells offer no list and no spell pick, and give no card", () => {
  const character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Ritual Lists")] });
  assert.equal(offeredChoices(character).some((c) => featOf(c) === "Sample Ritual Lists"), false, "no list is offered");
  assert.equal(
    evaluateCharacter(character, catalogs).grantedSpellSources.some((source) => source.title.startsWith("Sample Ritual Lists")),
    false,
    "and no card is shown",
  );
});

test("removing the feat releases its picks, and raises a review notice", () => {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Initiate")] });
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  character = pickOption(character, "Sample Pulse", "Sample Initiate");
  assert.ok((character.ruleChoices ?? []).length > 0, "the picks are saved");

  const removed = removeOriginFeat(character, { featName: "Sample Initiate", featSource: "TST" }, compendium, ALL_BOOKS);
  assert.deepEqual(removed.ruleChoices ?? [], [], "every pick of the feat is released");
  assert.ok(removed.needsReview?.some((notice) => /Sample Initiate/.test(notice)), "the release is recorded for review");
  assert.equal(evaluateCharacter(removed, catalogs).grantedSpellSources.length, 0, "and its card is gone");
});

test("swapping the feat releases the old feat's picks, and the new feat starts with none", () => {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Initiate")] });
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  const swapped = applyOriginFeat(character, takenFeat("Sample Initiate Alt"), { featName: "Sample Initiate", featSource: "TST" }, compendium, ALL_BOOKS);
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

  const releasedOne = removeOriginFeat(character, { featName: "Sample Initiate", featSource: "TST" }, compendium, ALL_BOOKS);
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
  let character = pickOption(makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Initiate")] }), "Sample Cleric Spells", "Sample Initiate", TEST_BOOKS);
  character = pickOption(character, "Sample Spark", "Sample Initiate", TEST_BOOKS);
  const reconciled = reconcileForActiveBooks(character, compendium, ACTIVE);
  assert.ok(!(reconciled.ruleChoices ?? []).some((rc) => rc.picked.includes("Sample Spark")), "the pick is released");
  assert.ok(reconciled.needsReview?.some((notice) => /Sample Initiate/.test(notice)));
});

// The rest of the filter vocabulary, the named alternatives and the casting ability the player chooses (ADR 0017).

test("a named alternative is offered by the label of its fixed cantrips, and its spells come from a lower-case class list", () => {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Lorekeeper")] });
  const lists = offeredChoices(character).find((c) => featOf(c) === "Sample Lorekeeper" && c.options.length === 2);
  assert.ok(lists, "the college list is offered");
  assert.deepEqual(
    lists.options.map((o) => o.label),
    ["Sample Hall: Sample Ember, Sample Glimmer", "Sample Hall: Sample Ember, Sample Jab"],
    "each college is labelled by the cantrips it gives",
  );
  character = pickOption(character, "Sample Hall 1", "Sample Lorekeeper");
  const daily = offeredChoices(character).find((c) => featOf(c) === "Sample Lorekeeper" && c.options.some((o) => o.name === "Sample Pulse"));
  assert.deepEqual(
    daily?.options.map((o) => o.name).sort(),
    ["Sample Augur", "Sample Lure", "Sample Pulse", "Sample Ward"],
    "a lower-case class list offers the first-level spells of each class it names",
  );
});

test("the casting ability is chosen once for the feat: the card has none until it is chosen, then uses the one picked", () => {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Lorekeeper")], baseAbilityScores: scores({ wis: 16 }) });
  character = pickOption(character, "Sample Hall 1", "Sample Lorekeeper");
  const abilityChoice = offeredChoices(character).find((c) => featOf(c) === "Sample Lorekeeper" && c.options.some((o) => o.name === "wis"));
  assert.ok(abilityChoice, "the ability is offered for the feat, once");
  assert.equal(abilityChoice.choose, 1);
  assert.deepEqual(abilityChoice.options.map((o) => o.label), ["Intelligence", "Wisdom", "Charisma"]);

  let card = cardTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Lorekeeper (Sample Hall)");
  assert.ok(card, "the card is titled by the feat and the college");
  assert.equal(card.ability, undefined, "no ability is invented before it is chosen");
  assert.ok(card.notices?.some((notice) => /casting ability/i.test(notice)), "the missing ability is a needs-review notice");
  assert.deepEqual(card.spells.map((s) => s.name).sort(), ["Sample Ember", "Sample Glimmer"], "the fixed cantrips are at will already");

  character = pickOption(character, "wis", "Sample Lorekeeper");
  card = cardTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Lorekeeper (Sample Hall)");
  assert.equal(card?.ability, "wis");
  assert.equal(card?.spellSaveDc, 8 + 2 + 3, "8 + proficiency bonus + WIS 16");
  assert.equal(card?.spellAttackBonus, 2 + 3);
  assert.ok(!card?.notices?.some((notice) => /casting ability/i.test(notice)), "the notice clears once it is chosen");

  const removed = removeOriginFeat(character, { featName: "Sample Lorekeeper", featSource: "TST" }, compendium, ALL_BOOKS);
  assert.deepEqual(removed.ruleChoices ?? [], [], "removing the feat releases the ability and the college with it");
});

test("a pick from a filter's school list offers only the spells of those schools, and a fixed daily spell sits beside it", () => {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Charmer", "cha")] });
  const offered = offeredChoices(character).find((c) => featOf(c) === "Sample Charmer");
  assert.deepEqual(offered?.options.map((o) => o.name).sort(), ["Sample Augur", "Sample Lure"], "Enchantment and Divination only");
  character = pickOption(character, "Sample Lure", "Sample Charmer");
  const card = cardTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Charmer");
  assert.equal(card?.ability, "cha", "the ability is the one the feat's increase raised");
  assert.ok(card?.spells.find((s) => s.name === "Sample Pulse")?.resourceCounterId, "the fixed daily spell has its counter");
  assert.ok(card?.spells.find((s) => s.name === "Sample Lure")?.resourceCounterId, "and so does the picked one");
  assert.deepEqual(card?.notices ?? [], []);
});

test("a filter naming several classes offers the spells of each of them at that level", () => {
  const offered = offeredChoices(makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Multi")] })).find((c) => featOf(c) === "Sample Multi");
  assert.deepEqual(
    offered?.options.map((o) => o.name).sort(),
    ["Sample Augur", "Sample Lure", "Sample Pulse", "Sample Ward"],
    "the first-level spells of the mage and of the cleric",
  );
});

test("an attack-roll filter offers only the cantrips that need an attack roll", () => {
  const offered = offeredChoices(makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Duelist")] })).find((c) => featOf(c) === "Sample Duelist");
  assert.deepEqual(offered?.options.map((o) => o.name).sort(), ["Sample Jab", "Sample Shot"], "the ranged and the melee cantrip, not Sample Ember");
});

test("a pick from a named list is one of the listed spells, and each pick counts toward the list's count", () => {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Scholar")], baseAbilityScores: scores({ cha: 14 }) });
  const offered = offeredChoices(character).find((c) => featOf(c) === "Sample Scholar");
  assert.equal(offered?.choose, 2, "two picks are owed");
  assert.deepEqual(offered?.options.map((o) => o.name).sort(), ["Sample Pulse", "Sample Ward"]);
  character = pickOption(character, "Sample Pulse", "Sample Scholar");
  character = pickOption(character, "Sample Ward", "Sample Scholar");
  const card = cardTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Scholar");
  assert.deepEqual(card?.spells.map((s) => s.name).sort(), ["Sample Pulse", "Sample Ward"]);
  assert.deepEqual(card?.notices ?? [], [], "nothing is owed once both are picked");
});

test("a ritual-only pick is not modelled: no choice is offered for it, and no card or notice is made", () => {
  const character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Ritualist")] });
  assert.equal(offeredChoices(character).some((c) => featOf(c) === "Sample Ritualist"), false, "no pick is offered");
  assert.deepEqual(evaluateCharacter(character, catalogs).grantedSpellSources, [], "and no card, since nothing else is granted");
});

// A background that grants a spell feat (ADR 0017). The background section claims the feat with the Background source
// marker; the reader must hold it by name, and its picks and counters follow the background's life.

const DRIFTER = { name: "Sample Drifter", source: "TST" };
const KEEPER = { name: "Sample Keeper", source: "TST" };

/** Selects a background as the background section does: the background is set, and no feat yet. */
const selectBackground = (character: Character, background: { name: string; source: string }): Character => ({ ...character, background });

/** Claims the feat a background's feature grants, as the background section does (the feat has the Background source). */
function claimBackgroundFeat(character: Character, backgroundName: string, featureDescription: string): Character {
  const grant = getBackgroundFeatGrant(backgroundName, featureDescription);
  assert.ok(grant, `${backgroundName} grants a feat`);
  return claimFeat(character, grant.featName);
}

/** Claims a feat under the Background source marker, as the background section does for a feat it grants. */
const claimFeat = (character: Character, featName: string): Character => grantBackgroundFeat(character, featName, undefined, compendium, ALL_BOOKS);

/** Every granted spell of a card, with the character's picks made for Sample Initiate and its first-level spell. */
const initiateCard = (character: Character) => cardTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Initiate (Sample Mage)");

test("a background-granted feat is held once claimed: its card appears and its picks are offered", () => {
  const base = makeChar({ background: DRIFTER, classes: [mage(4)], baseAbilityScores: scores({ int: 14 }) });
  assert.equal(evaluateCharacter(base, catalogs).grantedSpellSources.length, 0, "not held before it is claimed");

  let character = claimBackgroundFeat(base, "Sample Drifter", "You gain the Sample Initiate feat.");
  assert.ok(offeredChoices(character).some((c) => featOf(c) === "Sample Initiate"), "the feat's picks are offered");
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  const card = initiateCard(character);
  assert.ok(card, "the card is titled by the feat and the picked list");
  assert.equal(card.ability, "int", "the ability is the list's own");
  assert.equal(card.spellSaveDc, 8 + 2 + 2, "8 + proficiency bonus + INT 14");
});

test("clearing the background releases the granted feat's picks, its card and its long-rest counters, with a notice", () => {
  let character = claimBackgroundFeat(makeChar({ background: DRIFTER, classes: [mage(4)] }), "Sample Drifter", "You gain the Sample Initiate feat.");
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  character = pickOption(character, "Sample Glimmer", "Sample Initiate");
  character = pickOption(character, "Sample Pulse", "Sample Initiate");
  const pulse = initiateCard(character)?.spells.find((s) => s.name === "Sample Pulse");
  assert.ok(pulse?.resourceCounterId, "the first-level spell has a long-rest counter");
  character = toggleInnateSpellUse(character, pulse);
  assert.ok(character.resourceCounters?.[pulse.resourceCounterId], "the counter has been used");

  const cleared = clearBackground(character, { compendium, activeBooks: ALL_BOOKS });
  assert.equal(cleared.background, null);
  assert.deepEqual(cleared.ruleChoices ?? [], [], "every pick of the feat is released");
  assert.equal(evaluateCharacter(cleared, catalogs).grantedSpellSources.length, 0, "and its card is gone");
  assert.equal(cleared.resourceCounters?.[pulse.resourceCounterId], undefined, "and its counter is dropped");
  assert.ok(cleared.needsReview?.some((notice) => /Sample Initiate removed/.test(notice)), "the feat's removal is recorded");
  assert.ok(cleared.needsReview?.some((notice) => /Sample Pulse removed/.test(notice)), "and the counter's removal is recorded");
});

test("changing to a background that grants the same feat releases the old picks, and the feat must be picked again", () => {
  let character = claimBackgroundFeat(makeChar({ background: DRIFTER, classes: [mage(4)] }), "Sample Drifter", "You gain the Sample Initiate feat.");
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  const changed = claimBackgroundFeat(selectBackground(clearBackground(character, { compendium, activeBooks: ALL_BOOKS }), DRIFTER), "Sample Drifter", "You gain the Sample Initiate feat.");
  assert.deepEqual(changed.ruleChoices ?? [], [], "the old picks do not survive the change");
  assert.ok(changed.needsReview?.some((notice) => /Sample Initiate removed/.test(notice)), "the release is recorded");
  const card = cardTitled(evaluateCharacter(changed, catalogs).grantedSpellSources, "Sample Initiate");
  assert.ok(card, "the feat is held again");
  assert.equal(card.spells.length, 0, "and nothing is picked until the player picks it again");
  assert.ok(card.notices?.some((notice) => /spell list/.test(notice)), "the list is asked for again");
});

test("changing to a background that grants a different feat releases the old feat's picks and counters", () => {
  let character = claimBackgroundFeat(makeChar({ background: DRIFTER, classes: [mage(4)] }), "Sample Drifter", "You gain the Sample Initiate feat.");
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  character = pickOption(character, "Sample Pulse", "Sample Initiate");
  const changed = claimBackgroundFeat(selectBackground(clearBackground(character, { compendium, activeBooks: ALL_BOOKS }), KEEPER), "Sample Keeper", "You gain the Sample Warding feat.");
  assert.ok(!(changed.ruleChoices ?? []).some((rc) => rc.id.includes("Sample Initiate")), "no pick of the old feat survives");
  const sources = evaluateCharacter(changed, catalogs).grantedSpellSources;
  assert.equal(cardTitled(sources, "Sample Initiate (Sample Mage)"), undefined, "the old feat's card is gone");
  assert.ok(cardTitled(sources, "Sample Warding"), "the new feat's own card is there");
});

test("when a background offers a choice of feats, the picks follow the feat the player claimed, and switching releases the other's", () => {
  let character = makeChar({ background: DRIFTER, classes: [mage(4)], baseAbilityScores: scores({ int: 14 }) });
  character = claimFeat(character, "Sample Warding");
  assert.ok(!offeredChoices(character).some((c) => featOf(c) === "Sample Initiate"), "no pick of an unclaimed option is offered");
  assert.ok(cardTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Warding"), "the claimed option gives its card");

  character = claimFeat(removeOriginFeat(character, { featName: "Sample Warding", featSource: BACKGROUND_FEAT_SOURCE }, compendium, ALL_BOOKS), "Sample Initiate");
  assert.ok(offeredChoices(character).some((c) => featOf(c) === "Sample Initiate"), "the other option's picks are offered once it is claimed");
  assert.equal(cardTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Warding"), undefined, "and the first option's card is gone");
});

test("a feat a background grants is never the ancestry's origin feat, whichever feat the background grants", () => {
  const character = makeChar({
    race: { name: "Variant Human", source: "PHB" },
    background: KEEPER,
    originFeats: [
      { level: 1, type: "feat", featName: "Sample Warding", featSource: "Background" },
      { level: 1, type: "feat", featName: "Sample Cinder", featSource: "TST" },
    ],
  });
  assert.equal(resolveAncestryState(character, { compendium, activeBooks: ALL_BOOKS }).currentOriginFeat?.featName, "Sample Cinder");
});

test("releasing a background feat keeps the counters of another held feat whose name it begins with", () => {
  let character = makeChar({
    background: DRIFTER,
    classes: [mage(4)],
    asiSelections: [takenFeat("Sample Initiate Alt")],
  });
  character = claimBackgroundFeat(character, "Sample Drifter", "You gain the Sample Initiate feat.");
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  character = pickOption(character, "Sample Pulse", "Sample Initiate");
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate Alt");
  character = pickOption(character, "Sample Glimmer", "Sample Initiate Alt");
  character = pickOption(character, "Sample Pulse", "Sample Initiate Alt");
  const altPulse = cardTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Initiate Alt (Sample Mage)")?.spells.find((s) => s.name === "Sample Pulse");
  assert.ok(altPulse?.resourceCounterId);
  character = toggleInnateSpellUse(character, altPulse);

  const cleared = clearBackground(character, { compendium, activeBooks: ALL_BOOKS });
  assert.ok(cleared.resourceCounters?.[altPulse.resourceCounterId], "the other feat's counter is kept");
  assert.ok(!cleared.needsReview?.some((notice) => /Sample Initiate Alt/.test(notice)), "and gets no notice");
});
