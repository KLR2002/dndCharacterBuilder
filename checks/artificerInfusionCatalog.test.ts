import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { makeChar, srdBaselineCompendium } from "./testUtils.ts";
import { infusionCatalog, staleInfusionCatalog } from "./infusionFixture.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import {
  artificerInfusionChoices,
  findArtificerInfusion,
  getKnownInfusions,
  pickRuleChoice,
  subclassRuleChoices,
} from "../src/rules/ruleChoices.ts";
import type { Character, RuleChoiceEntry } from "../src/types/character.ts";

const INFUSIONS_KNOWN_2 = "TCE__Artificer__Infusions 2";

function artificer(level: number, ruleChoices?: RuleChoiceEntry[]): Character {
  return makeChar({
    classes: [{ className: "Artificer", level, hitDiceType: "d8" }],
    ...(ruleChoices ? { ruleChoices } : {}),
  });
}

function savedInfusions(picked: string[]): RuleChoiceEntry {
  return {
    id: INFUSIONS_KNOWN_2,
    trait: "Infusions Known (2nd Level)",
    origin: "class",
    choose: 4,
    from: [],
    picked,
  };
}

test("the catalog's infusions are offered by level, and the umbrella record is not offered", () => {
  const [choice] = artificerInfusionChoices(artificer(2), undefined, infusionCatalog());
  const names = choice.options.map((o) => o.name);

  assert.ok(names.includes("Placeholder Alpha"));
  assert.ok(names.includes("Placeholder Bravo"), "a plain prerequisite with no level is a 2nd-level infusion");
  assert.ok(names.includes("Replicate Magic Item: placeholder jug"), "the catalog's own casing is offered");
  assert.ok(names.includes("Replicate Magic Item: placeholder bag"));
  assert.ok(!names.includes("Replicate Magic Item"), "the umbrella record is not selectable");
  assert.ok(!names.includes("Placeholder Charlie"), "a 6th-level infusion is locked at 2nd level");
  assert.ok(!names.includes("Replicate Magic Item: placeholder boots"), "a 6th-level replicate row is locked at 2nd level");
  assert.equal(choice.choose, 4);
  assert.equal(choice.level, 2);
});

test("each milestone offers the infusions unlocked by then, from the catalog", () => {
  const catalog = infusionCatalog();
  const offeredAt = (level: number) =>
    artificerInfusionChoices(artificer(level), undefined, catalog)
      .flatMap((c) => c.options.map((o) => o.name));

  assert.ok(offeredAt(6).includes("Placeholder Charlie"));
  assert.ok(offeredAt(6).includes("Replicate Magic Item: placeholder boots"));
  assert.ok(!offeredAt(6).includes("Placeholder Delta"));
  assert.ok(offeredAt(10).includes("Replicate Magic Item: placeholder ring"));
  assert.ok(!offeredAt(10).includes("Placeholder Echo"));
  assert.ok(offeredAt(14).includes("Replicate Magic Item: placeholder amulet"));
});

test("Dual-Mode: the SRD Baseline offers no infusions, and the integrated catalog offers them", () => {
  const sixth = artificer(6);
  assert.deepEqual(artificerInfusionChoices(sixth, undefined, srdBaselineCompendium()), []);
  assert.ok(artificerInfusionChoices(sixth, undefined, infusionCatalog()).length > 0);

  const srdIds = subclassRuleChoices(sixth, undefined, srdBaselineCompendium()).map((c) => c.id);
  const integratedIds = subclassRuleChoices(sixth, undefined, infusionCatalog()).map((c) => c.id);
  assert.ok(!srdIds.some((id) => id.startsWith("TCE__Artificer__Infusions")));
  assert.ok(integratedIds.includes(INFUSIONS_KNOWN_2));
});

test("a stale catalog hides the infusions choice and keeps saved picks untouched", () => {
  const picked = artificer(6, [savedInfusions(["Placeholder Alpha", "Replicate Magic Item: Placeholder jug"])]);
  assert.deepEqual(artificerInfusionChoices(picked, undefined, staleInfusionCatalog()), []);

  const reconciled = reconcile(picked, staleInfusionCatalog(), { activeBooks: ALL_BOOKS });
  assert.deepEqual(reconciled.ruleChoices, picked.ruleChoices);
  assert.equal(reconciled.needsReview, undefined);
});

test("reverting to the SRD Baseline leaves saved infusion picks and active infusions in place", () => {
  const saved: Character = {
    ...artificer(6, [savedInfusions(["Placeholder Alpha", "Replicate Magic Item: Placeholder jug"])]),
    activeInfusions: [{ infusionName: "Placeholder Alpha" }],
  };
  const reconciled = reconcile(saved, srdBaselineCompendium(), { activeBooks: ALL_BOOKS });
  assert.deepEqual(reconciled.ruleChoices, saved.ruleChoices);
  assert.deepEqual(reconciled.activeInfusions, saved.activeInfusions);
});

test("a saved title-cased pick is read through the catalog and kept exactly as saved", () => {
  const saved = artificer(2, [savedInfusions(["Replicate Magic Item: Placeholder Jug", "Placeholder Alpha"])]);
  const reconciled = reconcile(saved, infusionCatalog(), { activeBooks: ALL_BOOKS });

  const entry = reconciled.ruleChoices?.find((rc) => rc.id === INFUSIONS_KNOWN_2);
  assert.deepEqual(entry?.picked, ["Replicate Magic Item: Placeholder Jug", "Placeholder Alpha"]);
  assert.deepEqual(getKnownInfusions(reconciled), ["Replicate Magic Item: Placeholder Jug", "Placeholder Alpha"]);
  assert.equal(reconciled.needsReview, undefined, "a resolved pick raises no review notice");
});

test("a pick saved in another casing is never rewritten, and it still counts toward the choice", () => {
  const saved = artificer(2, [savedInfusions(["replicate magic item: PLACEHOLDER JUG", "Placeholder Alpha"])]);
  const reconciled = reconcile(saved, infusionCatalog(), { activeBooks: ALL_BOOKS });

  const entry = reconciled.ruleChoices?.find((rc) => rc.id === INFUSIONS_KNOWN_2);
  assert.deepEqual(entry?.picked, ["replicate magic item: PLACEHOLDER JUG", "Placeholder Alpha"]);
  assert.equal(entry?.choose, 4);
  assert.equal(reconciled.needsReview, undefined);
});

test("two saved picks that differ only in casing collapse to one, kept as the first was saved", () => {
  const saved = artificer(2, [savedInfusions(["placeholder alpha", "Placeholder Alpha"])]);
  const reconciled = reconcile(saved, infusionCatalog(), { activeBooks: ALL_BOOKS });

  const entry = reconciled.ruleChoices?.find((rc) => rc.id === INFUSIONS_KNOWN_2);
  assert.deepEqual(entry?.picked, ["placeholder alpha"]);
});

test("picking a new infusion leaves a saved pick in another casing exactly as stored", () => {
  const saved = artificer(2, [savedInfusions(["Placeholder Alpha", "replicate magic item: PLACEHOLDER JUG"])]);
  const [choice] = artificerInfusionChoices(saved, undefined, infusionCatalog());

  const picked = pickRuleChoice(saved, choice, "Placeholder Bravo", infusionCatalog(), ALL_BOOKS);
  const entry = picked.ruleChoices?.find((rc) => rc.id === INFUSIONS_KNOWN_2);
  assert.deepEqual(entry?.picked, ["Placeholder Alpha", "replicate magic item: PLACEHOLDER JUG", "Placeholder Bravo"]);
});

test("clicking the catalog-cased option removes the pick saved in another casing, and the rest stay as saved", () => {
  const saved = artificer(2, [savedInfusions(["Placeholder Alpha", "replicate magic item: PLACEHOLDER JUG"])]);
  const [choice] = artificerInfusionChoices(saved, undefined, infusionCatalog());

  const toggled = pickRuleChoice(saved, choice, "Replicate Magic Item: placeholder jug", infusionCatalog(), ALL_BOOKS);
  const entry = toggled.ruleChoices?.find((rc) => rc.id === INFUSIONS_KNOWN_2);
  assert.deepEqual(entry?.picked, ["Placeholder Alpha"]);
});

test("a pick saved in another casing still excludes its infusion from the other milestones", () => {
  const saved = artificer(6, [
    savedInfusions(["replicate magic item: PLACEHOLDER JUG"]),
  ]);
  const offered = artificerInfusionChoices(saved, undefined, infusionCatalog())
    .filter((c) => c.id !== INFUSIONS_KNOWN_2)
    .flatMap((c) => c.options.map((o) => o.name));

  assert.ok(!offered.includes("Replicate Magic Item: placeholder jug"));
});

test("active infusions and infused items match their picks whatever the casing", () => {
  const boots = {
    id: "boots_1", name: "Leather Boots", source: "PHB", quantity: 1, isEquipped: true, section: "equipped" as const,
    infusedWith: "placeholder alpha", isInfused: true,
  };
  const jug = {
    id: "jug_1", name: "Jug", source: "TCE", quantity: 1, isEquipped: false, section: "carried" as const,
    infusedWith: "replicate magic item: PLACEHOLDER JUG", isInfused: true,
  };
  const saved: Character = {
    ...artificer(2, [savedInfusions(["PLACEHOLDER ALPHA", "Replicate Magic Item: placeholder jug"])]),
    activeInfusions: [
      { infusionName: "placeholder alpha", targetItemId: "boots_1" },
      { infusionName: "REPLICATE MAGIC ITEM: placeholder jug" },
    ],
    items: [boots, jug],
  };
  const reconciled = reconcile(saved, infusionCatalog(), { activeBooks: ALL_BOOKS });

  assert.deepEqual(reconciled.activeInfusions, saved.activeInfusions, "neither active infusion is pruned");
  assert.equal(reconciled.items?.find((i) => i.id === "boots_1")?.infusedWith, "placeholder alpha");
  assert.equal(reconciled.items?.find((i) => i.id === "jug_1")?.infusedWith, "replicate magic item: PLACEHOLDER JUG");
  assert.equal(reconciled.needsReview, undefined);
});

test("a saved title-cased pick toggles off when the player picks the catalog's name", () => {
  const saved = artificer(2, [savedInfusions(["Replicate Magic Item: Placeholder Jug"])]);
  const [choice] = artificerInfusionChoices(saved, undefined, infusionCatalog());

  const toggled = pickRuleChoice(saved, choice, "Replicate Magic Item: placeholder jug", infusionCatalog(), ALL_BOOKS);
  assert.deepEqual(getKnownInfusions(toggled), []);
});

test("a new pick is stored under the catalog's name", () => {
  const fresh = artificer(2);
  const [choice] = artificerInfusionChoices(fresh, undefined, infusionCatalog());

  const picked = pickRuleChoice(fresh, choice, "Replicate Magic Item: Placeholder Bag", infusionCatalog(), ALL_BOOKS);
  assert.deepEqual(getKnownInfusions(picked), ["Replicate Magic Item: placeholder bag"]);
});

test("a saved pick above the character's level is pruned with a review notice", () => {
  const saved = artificer(2, [savedInfusions(["Placeholder Charlie", "Placeholder Alpha"])]);
  const reconciled = reconcile(saved, infusionCatalog(), { activeBooks: ALL_BOOKS });

  assert.deepEqual(getKnownInfusions(reconciled), ["Placeholder Alpha"]);
  assert.ok(reconciled.needsReview?.some((note) => note.includes("Placeholder Charlie")));
});

test("a saved pick the catalog no longer offers is pruned when the catalog has infusions", () => {
  const saved = artificer(2, [savedInfusions(["Placeholder Vanished", "Placeholder Alpha"])]);
  const reconciled = reconcile(saved, infusionCatalog(), { activeBooks: ALL_BOOKS });

  assert.deepEqual(getKnownInfusions(reconciled), ["Placeholder Alpha"]);
});

test("the description of a saved infusion comes from the catalog, whatever its casing", () => {
  assert.equal(
    findArtificerInfusion("Replicate Magic Item: Placeholder Boots", infusionCatalog())?.description,
    "Placeholder text for Replicate Magic Item: placeholder boots.",
  );
  assert.equal(findArtificerInfusion("Placeholder Alpha", srdBaselineCompendium()), undefined);
});
