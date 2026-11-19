import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { makeChar , integratedTestCompendium } from "./testUtils.ts";
import { choiceCatalogBundle } from "./choiceCatalogFixture.ts";
import { createCompendium, type Compendium } from "../src/services/compendium.ts";
import { REQUIRED_CATALOG_FORMAT } from "../src/services/compendiumStorage.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { BACKGROUND_FEAT_SOURCE } from "../src/constants/rules.ts";
import { effectiveScores, hasFeat } from "../src/rules/abilities.ts";
import { FIGHTING_INITIATE_CHOICE_ID } from "../src/rules/choices/fightingStyles.ts";
import { featIncreaseOptions, findFeat } from "../src/rules/featIncrease.ts";
import {
  applyFeatSlotPick,
  featPickView,
  featSlotView,
  takenFeatProficiencyChoices,
  takenFeatRuleChoices,
  type FeatSlotPick,
} from "../src/rules/featSlot.ts";
import { classChoicesStepView } from "../src/rules/classChoices.ts";
import type { AbilityKey, AsiSelection } from "../src/types/character.ts";
import type { FeatData, OptionFeatureData } from "../src/types/dnd5e.ts";

const ALL_ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

function feat(overrides: Partial<FeatData> & { name: string }): FeatData {
  return { source: "PHB", prerequisite: null, abilityScoreIncrease: null, description: "", ...overrides };
}

const RESILIENT_CHOICE = { from: ALL_ABILITIES, count: 1, amount: 1 };
const FIGHTING_INITIATE = feat({ name: "Fighting Initiate", source: "TCE" });
const MAGIC_INITIATE = feat({
  name: "Magic Initiate",
  source: "PHB",
  additionalSpells: [
    { name: "Cleric Spells", ability: "wis", known: { _: [{ choose: "level=0|class=Cleric", count: 2 }] } },
  ],
});

/** Two invented style options the Fighting Initiate style choice offers. */
const STYLE_OPTIONS: OptionFeatureData[] = ["Test Style Alpha", "Test Style Beta"].map((name) => ({
  name,
  source: "TCE",
  category: "Fighting Style",
  featureType: ["FS:F"],
  prerequisite: null,
  description: "",
}));

function catalog(feats: FeatData[]): Compendium {
  return createCompendium(choiceCatalogBundle({ feats, optionsAndFeatures: STYLE_OPTIONS }));
}

const WIZARD_4 = makeChar({
  baseAbilityScores: { str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 8 },
  classes: [{ className: "Wizard", source: "PHB", level: 4 }],
});

function asiPick(overrides: Partial<FeatSlotPick> = {}): FeatSlotPick {
  return {
    slot: { kind: "asi", className: "Wizard", classLevel: 4 },
    featName: null,
    ...overrides,
  };
}

test("Resilient's Increase Choice comes from the catalog: one of six scores, +1", () => {
  const compendium = catalog([feat({ name: "Resilient", abilityScoreChoices: [RESILIENT_CHOICE] })]);
  const resilient = findFeat("Resilient", undefined, compendium, ALL_BOOKS);
  assert.ok(resilient, "Resilient is found");
  const options = featIncreaseOptions(resilient);
  assert.equal(options.type, "choice");
  assert.deepEqual(options.abilities, ALL_ABILITIES);
  assert.equal(options.amount, 1);
});

test("a feat with no increase in the catalog is still offered, with no increase", () => {
  const compendium = catalog([feat({ name: "Resilient" }), feat({ name: "Alert" })]);
  const character = makeChar({
    ...WIZARD_4,
    asiSelections: [{ level: 4, className: "Wizard", classLevel: 4, type: "feat", featName: "Alert", featSource: "PHB" }],
  });
  const view = featSlotView(character, asiPick(), { compendium, activeBooks: ALL_BOOKS });
  const offer = view.offered.find((o) => o.feat.name === "Resilient");
  assert.ok(offer, "Resilient is offered without its increase");
  assert.equal(featIncreaseOptions(offer.feat).type, "none");
  assert.equal(view.offered.find((o) => o.feat.name === "Alert")?.held, true, "a feat the character holds is marked held");
  assert.equal(view.offered.find((o) => o.feat.name === "Resilient")?.held, false);
});

test("Fighting Initiate opens its style Rule Choice, and the pick is incomplete until a style is picked", () => {
  const compendium = catalog([FIGHTING_INITIATE]);
  const pick = asiPick({ featName: "Fighting Initiate", featSource: "TCE" });
  const view = featSlotView(WIZARD_4, pick, { compendium, activeBooks: ALL_BOOKS });
  assert.deepEqual(view.subChoices.map((choice) => choice.id), [FIGHTING_INITIATE_CHOICE_ID]);
  assert.equal(view.complete, false, "no style picked yet");

  const picked = featSlotView(
    WIZARD_4,
    { ...pick, subChoicePicks: { [FIGHTING_INITIATE_CHOICE_ID]: ["Test Style Alpha"] } },
    { compendium, activeBooks: ALL_BOOKS },
  );
  assert.equal(picked.complete, true);
});

test("Magic Initiate's spell picks are offered on the feat and do not make the pick incomplete", () => {
  const compendium = catalog([MAGIC_INITIATE]);
  const view = featSlotView(
    WIZARD_4,
    asiPick({ featName: "Magic Initiate", featSource: "PHB" }),
    { compendium, activeBooks: ALL_BOOKS },
  );
  assert.ok(view.spellChoices.length > 0, "the feat's spell list is offered");
  assert.equal(view.complete, true, "no spell picked, and the pick is still complete");
});

test("findFeat takes a feat by name and source, or by name alone only when one active feat has it", () => {
  const compendium = catalog([
    feat({ name: "Resilient", source: "PHB", abilityScoreChoices: [RESILIENT_CHOICE] }),
    feat({ name: "Resilient", source: "TCE" }),
  ]);
  assert.equal(findFeat("Resilient", undefined, compendium, ["PHB"])?.source, "PHB", "only PHB is active");
  assert.equal(findFeat("Resilient", undefined, compendium, ALL_BOOKS), null, "two active feats share the name");
  assert.equal(findFeat("Resilient", "TCE", compendium, ALL_BOOKS)?.source, "TCE", "the source picks the record");
  assert.equal(
    findFeat("Resilient", BACKGROUND_FEAT_SOURCE, compendium, ["PHB"])?.source,
    "PHB",
    "a background's copy carries the Background marker, not a book, and is found by name",
  );
});

test("a saved Resilient +1 Constitution keeps counting on a catalog without the Increase Choice", () => {
  const stale = catalog([feat({ name: "Resilient" })]);
  const character = makeChar({
    baseAbilityScores: { str: 10, dex: 12, con: 10, int: 16, wis: 10, cha: 8 },
    classes: [{ className: "Wizard", source: "PHB", level: 4 }],
    asiSelections: [
      { level: 4, className: "Wizard", classLevel: 4, type: "feat", featName: "Resilient", featSource: "PHB", featAbility: "con" },
    ],
  });
  assert.equal(effectiveScores(character).scores.con, 11, "the saved +1 counts");
  const view = featSlotView(
    character,
    asiPick({ featName: "Resilient", featSource: "PHB", featAbility: "con" }),
    { compendium: stale, activeBooks: ALL_BOOKS },
  );
  assert.equal(view.increase.type, "none", "the stale catalog states no Increase Choice");
  assert.equal(hasFeat(character, "Resilient"), true);
});

test("applyFeatSlotPick takes an ASI feat and records its sub-choice pick", () => {
  const compendium = catalog([FIGHTING_INITIATE]);
  const pick = asiPick({
    featName: "Fighting Initiate",
    featSource: "TCE",
    subChoicePicks: { [FIGHTING_INITIATE_CHOICE_ID]: ["Test Style Alpha"] },
  });
  const updated = applyFeatSlotPick(WIZARD_4, pick, { compendium, activeBooks: ALL_BOOKS });
  assert.equal(hasFeat(updated, "Fighting Initiate"), true);
  assert.deepEqual(
    updated.ruleChoices?.find((entry) => entry.id === FIGHTING_INITIATE_CHOICE_ID)?.picked,
    ["Test Style Alpha"],
  );
});

test("applyFeatSlotPick takes a race origin feat into the origin feats with its Increase Choice", () => {
  const compendium = catalog([feat({ name: "Resilient", abilityScoreChoices: [RESILIENT_CHOICE] })]);
  const pick: FeatSlotPick = {
    slot: { kind: "origin", grantedBy: "race" },
    featName: "Resilient",
    featSource: "PHB",
    featAbility: "wis",
  };
  const updated = applyFeatSlotPick(WIZARD_4, pick, { compendium, activeBooks: ALL_BOOKS });
  assert.deepEqual(updated.originFeats, [
    { level: 1, type: "feat", featName: "Resilient", featSource: "PHB", featAbility: "wis" },
  ]);
});

test("a feat with no increase in the catalog gets none, whatever its name", () => {
  const compendium = catalog([feat({ name: "Actor" })]);
  const view = featSlotView(WIZARD_4, asiPick({ featName: "Actor", featSource: "PHB" }), {
    compendium,
    activeBooks: ALL_BOOKS,
  });
  assert.equal(view.increase.type, "none");
  assert.equal(view.complete, true);
});

const STR_DEX_CHOICE = { from: ["str", "dex"] as AbilityKey[], count: 1, amount: 1 };
const RESILIENT_PAST_POOL = {
  baseAbilityScores: { str: 10, dex: 12, con: 10, int: 16, wis: 10, cha: 8 },
  classes: [{ className: "Wizard", source: "PHB", level: 4 }],
};
const RELEASED_CON_NOTICE = "Ability increase to Constitution removed from Resilient: the feat no longer offers it";

test("a saved Increase Choice outside its feat's pool is released with one notice naming the feat and the score", () => {
  const compendium = catalog([feat({ name: "Resilient", abilityScoreChoices: [STR_DEX_CHOICE] })]);
  const character = makeChar({
    ...RESILIENT_PAST_POOL,
    asiSelections: [
      {
        level: 4,
        className: "Wizard",
        classLevel: 4,
        type: "feat",
        featName: "Resilient",
        featSource: "PHB",
        featAbility: "con",
        asi: { con: 1 },
      },
    ],
  });
  const updated = reconcile(character, compendium, { activeBooks: ALL_BOOKS });
  assert.equal(updated.asiSelections?.[0].featName, "Resilient", "the feat stays taken");
  assert.equal(updated.asiSelections?.[0].featAbility, undefined);
  assert.equal(updated.asiSelections?.[0].asi, undefined);
  assert.equal(effectiveScores(updated).scores.con, 10, "the score drops by one");
  assert.deepEqual(updated.needsReview, [RELEASED_CON_NOTICE]);
});

test("a saved Increase Choice is kept with no notice when its feat has no Increase Choice in the catalog", () => {
  const compendium = catalog([feat({ name: "Resilient" })]);
  const character = makeChar({
    ...RESILIENT_PAST_POOL,
    asiSelections: [
      { level: 4, className: "Wizard", classLevel: 4, type: "feat", featName: "Resilient", featSource: "PHB", featAbility: "con" },
    ],
  });
  const updated = reconcile(character, compendium, { activeBooks: ALL_BOOKS });
  assert.equal(updated.asiSelections?.[0].featAbility, "con");
  assert.equal(updated.needsReview, undefined);
});

test("a saved Increase Choice is kept with no notice on a stale catalog", () => {
  const stale = createCompendium({
    ...choiceCatalogBundle({ feats: [feat({ name: "Resilient", abilityScoreChoices: [STR_DEX_CHOICE] })] }),
    catalogFormat: REQUIRED_CATALOG_FORMAT - 1,
  });
  assert.equal(stale.stale, true);
  const character = makeChar({
    ...RESILIENT_PAST_POOL,
    asiSelections: [
      { level: 4, className: "Wizard", classLevel: 4, type: "feat", featName: "Resilient", featSource: "PHB", featAbility: "con" },
    ],
  });
  const updated = reconcile(character, stale, { activeBooks: ALL_BOOKS });
  assert.equal(updated.asiSelections?.[0].featAbility, "con");
  assert.equal(updated.needsReview, undefined);
});

test("a race origin feat's Increase Choice outside its pool is released the same way", () => {
  const compendium = catalog([feat({ name: "Resilient", abilityScoreChoices: [STR_DEX_CHOICE] })]);
  const character = makeChar({
    ...RESILIENT_PAST_POOL,
    originFeats: [{ level: 1, type: "feat", featName: "Resilient", featSource: "PHB", featAbility: "con" }],
  });
  const updated = reconcile(character, compendium, { activeBooks: ALL_BOOKS });
  assert.equal(updated.originFeats?.[0].featAbility, undefined);
  assert.equal(effectiveScores(updated).scores.con, 10);
  assert.deepEqual(updated.needsReview, [RELEASED_CON_NOTICE]);
});

test("a fixed increase is never released, even when the saved score differs from the record", () => {
  const compendium = catalog([feat({ name: "Tough", abilityScoreIncrease: [{ con: 1 }] })]);
  const character = makeChar({
    ...RESILIENT_PAST_POOL,
    asiSelections: [
      { level: 4, className: "Wizard", classLevel: 4, type: "feat", featName: "Tough", featSource: "PHB", featAbility: "str" },
    ],
  });
  const updated = reconcile(character, compendium, { activeBooks: ALL_BOOKS });
  assert.equal(updated.asiSelections?.[0].featAbility, "str");
  assert.equal(updated.needsReview, undefined);
});

test("a saved feat entry opens the Rule Choice of its feat: Fighting Initiate's style choice", () => {
  const compendium = catalog([FIGHTING_INITIATE]);
  const selection: AsiSelection = {
    level: 4,
    className: "Wizard",
    classLevel: 4,
    type: "feat",
    featName: "Fighting Initiate",
    featSource: "TCE",
  };
  const character = makeChar({ ...WIZARD_4, asiSelections: [selection] });
  const opened = takenFeatRuleChoices(character, selection, ALL_BOOKS, compendium);
  assert.deepEqual(opened.map((choice) => choice.id), [FIGHTING_INITIATE_CHOICE_ID]);
});

test("a race origin feat entry opens the Rule Choice of its feat: a Variant Human's Fighting Initiate style", () => {
  const compendium = catalog([FIGHTING_INITIATE]);
  const selection: AsiSelection = {
    level: 1,
    type: "feat",
    featName: "Fighting Initiate",
    featSource: "TCE",
  };
  const character = makeChar({ ...WIZARD_4, originFeats: [selection] });
  const opened = takenFeatRuleChoices(character, selection, ALL_BOOKS, compendium);
  assert.deepEqual(opened.map((choice) => choice.id), [FIGHTING_INITIATE_CHOICE_ID]);
});

describe("A feat's Proficiency Choices come from the Feat Slot, not the Class Choices step", () => {
  const compendium = integratedTestCompendium();
  const SKILLED_CHOICE_ID = "PHB/Feat/Skilled@0#skills:choice:any";
  const FIGHTER_4 = makeChar({ classes: [{ className: "Fighter", source: "PHB", level: 4 }] });
  const skilledAtAsi: AsiSelection = {
    level: 4,
    className: "Fighter",
    classLevel: 4,
    type: "feat",
    featName: "Skilled",
    featSource: "PHB",
  };
  const skilledAsOrigin: AsiSelection = { level: 1, type: "feat", featName: "Skilled", featSource: "PHB" };

  test("a Skilled pick shows its three-skill choice in the Feat Slot view", () => {
    const view = featPickView(
      FIGHTER_4,
      { slot: { kind: "asi", className: "Fighter", classLevel: 4 }, featName: "Skilled", featSource: "PHB" },
      { compendium, activeBooks: ALL_BOOKS },
    );
    assert.deepEqual(view.proficiencyChoices.map((choice) => [choice.id, choice.choose]), [[SKILLED_CHOICE_ID, 3]]);
  });

  test("a Skilled taken at an ASI gets its choice from the Feat Slot, and the class view does not list it", () => {
    const character = makeChar({ ...FIGHTER_4, asiSelections: [skilledAtAsi] });
    const taken = takenFeatProficiencyChoices(character, skilledAtAsi, ALL_BOOKS, compendium);
    assert.deepEqual(taken.map((choice) => choice.id), [SKILLED_CHOICE_ID]);

    const view = classChoicesStepView(character, { compendium, activeBooks: ALL_BOOKS });
    assert.equal(view.skillPicks.some((offer) => offer.id === SKILLED_CHOICE_ID), false, "not in skillPicks");
    assert.equal(view.cards.other.some((choice) => choice.id === SKILLED_CHOICE_ID), false, "not in cards.other");
  });

  test("a Skilled taken as a Variant Human origin feat gets its choice from the Feat Slot, and the class view does not list it", () => {
    const character = makeChar({ ...FIGHTER_4, originFeats: [skilledAsOrigin] });
    const taken = takenFeatProficiencyChoices(character, skilledAsOrigin, ALL_BOOKS, compendium);
    assert.deepEqual(taken.map((choice) => choice.id), [SKILLED_CHOICE_ID]);

    const view = classChoicesStepView(character, { compendium, activeBooks: ALL_BOOKS });
    assert.equal(view.skillPicks.some((offer) => offer.id === SKILLED_CHOICE_ID), false, "not in skillPicks");
    assert.equal(view.cards.other.some((choice) => choice.id === SKILLED_CHOICE_ID), false, "not in cards.other");
  });
});
