import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { makeChar, srdBaselineCompendium } from "./testUtils.ts";
import { choiceCatalogBundle } from "./choiceCatalogFixture.ts";
import { INFUSION_FIXTURE_RECORDS } from "./infusionFixture.ts";
import { createCompendium, type Compendium } from "../src/services/compendium.ts";
import { REQUIRED_CATALOG_FORMAT } from "../src/services/compendiumStorage.ts";
import { offeredRuleChoices } from "../src/rules/ruleChoices.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import type { Character, RuleChoiceEntry } from "../src/types/character.ts";

// A stale Integrated Catalog is one saved below the required format. Stale hides the Totem feature
// rows and the Infusions Known choice even when their records are there, and prunes no infusion
// pick. Spell-choice rows stay offered, since an older catalog still holds what they derive from.
// Saved picks are never touched. These tests go through the Rule Choice interface only.

const OLD_FORMAT = 1;
const TOTEM_SPIRIT = "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3";
const TOTEM_ASPECT = "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6";
const TOTEM_ATTUNEMENT = "PHB__Barbarian__Path of the Totem Warrior__Totemic Attunement 14";
const TOTEM_IDS = [TOTEM_SPIRIT, TOTEM_ASPECT, TOTEM_ATTUNEMENT];
const INFUSIONS_2 = "TCE__Artificer__Infusions 2";
const INFUSIONS_6 = "TCE__Artificer__Infusions 6";
const BIOME_ID = "PHB__Druid__Circle of the Land__Biome";
const AFFINITY_ID = "XGE__Sorcerer__Divine Soul__Affinity";

// Records a catalog synced before the infusion umbrella and its Replicate rows existed: plain infusions only.
const OLD_INFUSION_RECORDS = INFUSION_FIXTURE_RECORDS.filter((r) => !r.name.startsWith("Replicate Magic Item"));

const currentCatalog = (): Compendium =>
  createCompendium(choiceCatalogBundle({ optionsAndFeatures: INFUSION_FIXTURE_RECORDS }));

const staleCatalog = (): Compendium =>
  createCompendium(choiceCatalogBundle({ catalogFormat: OLD_FORMAT, optionsAndFeatures: OLD_INFUSION_RECORDS }));

const totemChar = (): Character =>
  makeChar({
    classes: [{ className: "Barbarian", source: "PHB", level: 14, subclassName: "Path of the Totem Warrior" }],
  });

const artificerChar = (ruleChoices?: RuleChoiceEntry[]): Character =>
  makeChar({
    classes: [{ className: "Artificer", level: 6, hitDiceType: "d8" }],
    ...(ruleChoices ? { ruleChoices } : {}),
  });

const offeredIds = (char: Character, compendium: Compendium, activeBooks: string[]) =>
  offeredRuleChoices(char, { activeBooks, compendium }).map((c) => c.id);

const totemIds = (char: Character, compendium: Compendium) =>
  offeredIds(char, compendium, ["PHB"]).filter((id) => TOTEM_IDS.includes(id));

const infusionIds = (char: Character, compendium: Compendium) =>
  offeredIds(char, compendium, ["PHB", "TCE"]).filter((id) => id.startsWith("TCE__Artificer__Infusions"));

const savedTotemPick = (): RuleChoiceEntry => ({
  id: TOTEM_SPIRIT,
  trait: "Totem Spirit (3rd Level)",
  origin: "subclass",
  choose: 1,
  from: ["Bear", "Eagle", "Wolf"],
  picked: ["Bear"],
});

// The second pick is the title-cased form old saves hold; the third is an infusion the catalog no longer offers.
const savedInfusionPicks = (): RuleChoiceEntry => ({
  id: INFUSIONS_2,
  trait: "Infusions Known (2nd Level)",
  origin: "class",
  choose: 4,
  from: [],
  picked: ["Placeholder Alpha", "Replicate Magic Item: Placeholder Jug", "Placeholder Vanished"],
});

test("the stale fixture is stale, and the current fixture is not", () => {
  assert.equal(staleCatalog().stale, true);
  assert.equal(currentCatalog().stale, false);
});

// Format 2 predates Proficiency Grants (ADR 0015): a catalog saved at it has no grants on its features,
// so the Proficiency Sheet would show the old lists. It must be stale, so Settings asks for a re-sync.
const PRE_GRANTS_FORMAT = 2;

test("a catalog saved before Proficiency Grants is stale, and one at the required format is not", () => {
  assert.ok(REQUIRED_CATALOG_FORMAT > PRE_GRANTS_FORMAT, "the required format is past the pre-grants format");
  assert.equal(createCompendium(choiceCatalogBundle({ catalogFormat: PRE_GRANTS_FORMAT })).stale, true);
  assert.equal(createCompendium(choiceCatalogBundle()).stale, false);
});

test("a stale catalog hides the Totem rows even though it holds their option records, and keeps saved picks", () => {
  const stale = staleCatalog();
  const char = makeChar({ ...totemChar(), ruleChoices: [savedTotemPick()] });

  assert.deepEqual(totemIds(char, stale), []);
  assert.deepEqual(reconcile(char, stale, { activeBooks: ALL_BOOKS }).ruleChoices, char.ruleChoices, "the saved Totem pick is untouched");
});

test("a stale catalog hides the Infusions Known choice even though old infusion records exist, and prunes nothing", () => {
  const stale = staleCatalog();
  const char: Character = {
    ...artificerChar([savedInfusionPicks()]),
    activeInfusions: [{ infusionName: "Placeholder Alpha" }],
  };

  assert.deepEqual(infusionIds(char, stale), []);

  const reconciled = reconcile(char, stale, { activeBooks: ALL_BOOKS });
  assert.deepEqual(reconciled.ruleChoices, char.ruleChoices, "every saved infusion pick is kept, unrenamed");
  assert.deepEqual(reconciled.activeInfusions, char.activeInfusions);
  assert.equal(reconciled.needsReview, undefined, "nothing is pruned, so nothing is flagged for review");
});

test("a current catalog offers the Totem rows and the Infusions Known choice, and prunes what it no longer offers", () => {
  const current = currentCatalog();
  assert.deepEqual(totemIds(totemChar(), current), TOTEM_IDS);
  assert.ok(infusionIds(artificerChar(), current).includes(INFUSIONS_2));
  assert.ok(infusionIds(artificerChar(), current).includes(INFUSIONS_6));

  const withTotemPick = makeChar({ ...totemChar(), ruleChoices: [savedTotemPick()] });
  assert.deepEqual(reconcile(withTotemPick, current, { activeBooks: ALL_BOOKS }).ruleChoices, withTotemPick.ruleChoices, "a saved Totem pick is kept");

  const reconciled = reconcile(artificerChar([savedInfusionPicks()]), current, { activeBooks: ALL_BOOKS });
  const picked = reconciled.ruleChoices?.find((rc) => rc.id === INFUSIONS_2)?.picked;
  assert.deepEqual(picked, ["Placeholder Alpha", "Replicate Magic Item: Placeholder Jug"], "a current catalog prunes what it no longer offers and keeps the rest exactly as saved");
});

test("a stale catalog still offers the spell-choice rows exactly as a current catalog does", () => {
  const druid = makeChar({ classes: [{ className: "Druid", source: "PHB", level: 2, subclassName: "Circle of the Land" }] });
  const sorcerer = makeChar({ classes: [{ className: "Sorcerer", source: "XGE", level: 1, subclassName: "Divine Soul" }] });

  for (const [char, id] of [[druid, BIOME_ID], [sorcerer, AFFINITY_ID]] as const) {
    const current = offeredRuleChoices(char, { compendium: currentCatalog(), activeBooks: ALL_BOOKS }).find((c) => c.id === id);
    const stale = offeredRuleChoices(char, { compendium: staleCatalog(), activeBooks: ALL_BOOKS }).find((c) => c.id === id);
    assert.ok(current, `${id} is offered on a current catalog`);
    assert.deepEqual(stale, current, `${id} is offered the same on a stale catalog`);
  }
});

test("the SRD Baseline is never stale: it offers neither the Totem rows nor the Infusions Known choice, and keeps saved picks", () => {
  const srd = srdBaselineCompendium();
  assert.equal(srd.stale, false);
  assert.deepEqual(totemIds(totemChar(), srd), []);
  assert.deepEqual(infusionIds(artificerChar(), srd), []);

  const char = artificerChar([savedInfusionPicks()]);
  assert.deepEqual(reconcile(char, srd, { activeBooks: ALL_BOOKS }).ruleChoices, char.ruleChoices);
});
