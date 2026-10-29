import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import type { ClassData, ProficiencyGrant, SubclassData } from "../src/types/dnd5e.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { moveAliasedProficiencyPicks, pruneInvalidProficiencyPicks } from "../src/rules/proficiencyPicks.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { anyLanguageChoice, wardenClass } from "./proficiencySheetFixture.ts";

// One invented class, Tidesinger, is printed twice from two sources, and both prints list the same invented
// subclass (Circle of Foam, from GAMMA). The shared subclass's grant therefore has one id under both classes,
// and the pick must stay with a character holding either class. Nothing here is real 5e text.

const FIRST = "ALPHA";
const SECOND = "BETA";
const SUBCLASS_SOURCE = "GAMMA";
const TONGUE_ID = "GAMMA/Tidesinger/Circle of Foam/Foam Tongue@3#languages:choice:any";
const FORMER_TONGUE_ID = "GAMMA/Tidesinger/Circle of Foam/Old Foam Tongue@3#0";

const foamTongue = (aliases: string[] = []): ProficiencyGrant => ({ ...anyLanguageChoice(TONGUE_ID, 1), aliases });

const circleOfFoam = (classSource: string, aliases?: string[]): SubclassData => ({
  name: "Circle of Foam",
  shortName: "Foam",
  source: SUBCLASS_SOURCE,
  className: "Tidesinger",
  classSource,
  features: [{ name: "Foam Step", level: 3, description: "Invented subclass feature.", grants: [foamTongue(aliases)] }],
  description: "Placeholder description for the Circle of Foam.",
});

const tidesinger = (source: string, aliases?: string[]): ClassData =>
  wardenClass({ name: "Tidesinger", source, subclasses: [circleOfFoam(source, aliases)] });

const bothPrints = (firstAliases?: string[]) =>
  inMemoryCompendium({ classes: [tidesinger(FIRST, firstAliases), tidesinger(SECOND)] });

const holding = (source: string, extra: Partial<Character> = {}) =>
  makeChar({
    classes: [{ className: "Tidesinger", source, level: 3, subclassName: "Circle of Foam", subclassSource: SUBCLASS_SOURCE }],
    ...extra,
  });

test("a character holding the first class keeps a pick on the shared subclass's choice, through a pick and a reconcile", () => {
  const compendium = bothPrints();
  const before = holding(FIRST);
  const offer = proficiencyChoiceOffers(before, { compendium, activeBooks: ALL_BOOKS }).find((choice) => choice.id === TONGUE_ID);
  assert.ok(offer, "the shared subclass's choice is offered");

  const picked = pickRuleChoice(before, offer, "Elvish", compendium, ALL_BOOKS);
  assert.deepEqual(picked.proficiencyPicks, { [TONGUE_ID]: ["Elvish"] }, "the pick is recorded");
  assert.deepEqual(picked.needsReview ?? [], [], "the pick is not released for review");

  assert.deepEqual(reconcile(picked, compendium, { activeBooks: ALL_BOOKS }).proficiencyPicks, { [TONGUE_ID]: ["Elvish"] }, "the pick survives a reconcile");
});

test("a character holding the second class keeps a pick on the shared subclass's choice", () => {
  const compendium = bothPrints();
  const second = holding(SECOND, { proficiencyPicks: { [TONGUE_ID]: ["Elvish"] } });
  assert.deepEqual(pruneInvalidProficiencyPicks(second, compendium, ALL_BOOKS).proficiencyPicks, { [TONGUE_ID]: ["Elvish"] });
  assert.deepEqual(reconcile(second, compendium, { activeBooks: ALL_BOOKS }).proficiencyPicks, { [TONGUE_ID]: ["Elvish"] });
});

test("a character holding neither class still has the pick released, with a review notice", () => {
  const compendium = bothPrints();
  const stranger = makeChar({
    classes: [{ className: "Cinderwright", source: "DELTA", level: 3, subclassName: "Circle of Foam", subclassSource: SUBCLASS_SOURCE }],
    proficiencyPicks: { [TONGUE_ID]: ["Elvish"] },
  });
  const pruned = pruneInvalidProficiencyPicks(stranger, compendium, ALL_BOOKS);
  assert.equal(pruned.proficiencyPicks, undefined);
  assert.deepEqual(pruned.needsReview, ["Elvish removed from Foam Step: no longer granted"]);
});

test("a pick saved under an alias migrates when the id has several owners, even if only one owner carries the alias", () => {
  const compendium = bothPrints([FORMER_TONGUE_ID]);
  const saved = holding(SECOND, { proficiencyPicks: { [FORMER_TONGUE_ID]: ["Elvish"] } });
  const migrated = moveAliasedProficiencyPicks(saved, compendium, ALL_BOOKS);
  assert.deepEqual(migrated.proficiencyPicks, { [TONGUE_ID]: ["Elvish"] });
  assert.deepEqual(pruneInvalidProficiencyPicks(migrated, compendium, ALL_BOOKS).proficiencyPicks, { [TONGUE_ID]: ["Elvish"] });
});
