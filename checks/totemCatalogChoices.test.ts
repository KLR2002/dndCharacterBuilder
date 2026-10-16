import test from "node:test";
import assert from "node:assert/strict";
import { makeChar, srdBaselineCompendium } from "./testUtils.ts";
import { choiceCatalogBundle } from "./choiceCatalogFixture.ts";
import { createCompendium, type Compendium } from "../src/services/compendium.ts";
import type { CompendiumCollections } from "../src/services/compendiumStorage.ts";
import { offeredRuleChoices, pickRuleChoice, subclassRuleChoices } from "../src/rules/ruleChoices.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";

// The Totem Warrior rows are offered from the Integrated Catalog. These seam tests go through the
// Rule Choice interface only; the fixture catalog carries the placeholder text.

const SPIRIT_3 = "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3";
const ASPECT_6 = "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6";
const ATTUNEMENT_14 = "PHB__Barbarian__Path of the Totem Warrior__Totemic Attunement 14";
const TOTEM_IDS = [SPIRIT_3, ASPECT_6, ATTUNEMENT_14];

const totemChar = () =>
  makeChar({
    classes: [{ className: "Barbarian", source: "PHB", level: 14, subclassName: "Path of the Totem Warrior" }],
  });

const totemOffers = (char: ReturnType<typeof totemChar>, books: string[], compendium: Compendium) =>
  subclassRuleChoices(char, books, compendium).filter((c) => TOTEM_IDS.includes(c.id));

const catalog = (bundle: CompendiumCollections = choiceCatalogBundle()) => createCompendium(bundle);

// The Barbarian's Totem Warrior features, cloned so each test can change its own copy.
const totemFeatures = (bundle: CompendiumCollections) => bundle.classes[0].subclasses[0].features;

test("SRD Baseline offers no Totem Warrior choice, with or without SCAG", () => {
  const srd = srdBaselineCompendium();
  assert.deepEqual(totemOffers(totemChar(), ["PHB"], srd), []);
  assert.deepEqual(totemOffers(totemChar(), ["PHB", "SCAG"], srd), []);
});

test("the integrated catalog offers the three Totem choices with catalog text, and Elk and Tiger only while SCAG is active", () => {
  const compendium = catalog();

  const phbOnly = totemOffers(totemChar(), ["PHB"], compendium);
  assert.deepEqual(phbOnly.map((c) => c.id), TOTEM_IDS);
  assert.deepEqual(phbOnly.map((c) => c.options.map((o) => o.name)), [
    ["Bear", "Eagle", "Wolf"],
    ["Bear", "Eagle", "Wolf"],
    ["Bear", "Eagle", "Wolf"],
  ]);

  const withScag = totemOffers(totemChar(), ["PHB", "SCAG"], compendium);
  assert.deepEqual(withScag.map((c) => c.options.map((o) => o.name)), [
    ["Bear", "Eagle", "Wolf", "Elk", "Tiger"],
    ["Bear", "Eagle", "Wolf", "Elk", "Tiger"],
    ["Bear", "Eagle", "Wolf", "Elk", "Tiger"],
  ]);
  assert.deepEqual(withScag.map((c) => c.choose), [1, 1, 1]);
  assert.equal(withScag[0].options[0].description, "Placeholder text for Bear at level 3.");
});

test("a stale catalog with no choices on the Totem features hides the rows and keeps saved picks", () => {
  const stale = structuredClone(choiceCatalogBundle());
  for (const feature of totemFeatures(stale)) delete feature.choices;
  const compendium = catalog(stale);

  const saved = makeChar({
    ...totemChar(),
    ruleChoices: [
      {
        id: SPIRIT_3,
        trait: "Totem Spirit (3rd Level)",
        origin: "subclass",
        choose: 1,
        from: ["Bear", "Eagle", "Wolf"],
        picked: ["Bear"],
      },
    ],
  });

  assert.deepEqual(totemOffers(saved, ["PHB", "SCAG"], compendium), []);
  assert.deepEqual(
    offeredRuleChoices(saved, { activeBooks: ["PHB", "SCAG"], compendium }).filter((c) => TOTEM_IDS.includes(c.id)),
    [],
  );
  assert.deepEqual(reconcile(saved, compendium).ruleChoices, saved.ruleChoices);
});

test("a Totem row is not offered when the catalog's feature is at another level", () => {
  const bundle = structuredClone(choiceCatalogBundle());
  const aspect = totemFeatures(bundle).find((f) => f.name === "Aspect of the Beast");
  assert.ok(aspect);
  aspect.level = 7;
  const offered = totemOffers(totemChar(), ["PHB"], catalog(bundle)).map((c) => c.id);
  assert.deepEqual(offered, [SPIRIT_3, ATTUNEMENT_14], "Aspect of the Beast 6 is not offered when the catalog places it at 7");
});

test("a Totem row is not offered when the catalog has no feature of that name", () => {
  const bundle = structuredClone(choiceCatalogBundle());
  bundle.classes[0].subclasses[0].features = totemFeatures(bundle).filter((f) => f.name !== "Totem Spirit");
  const offered = totemOffers(totemChar(), ["PHB"], catalog(bundle)).map((c) => c.id);
  assert.deepEqual(offered, [ASPECT_6, ATTUNEMENT_14]);
});

test("no Totem row is offered when the catalog's Barbarian is some other class", () => {
  const bundle = structuredClone(choiceCatalogBundle());
  bundle.classes[0].name = "Fighter";
  assert.deepEqual(totemOffers(totemChar(), ["PHB", "SCAG"], catalog(bundle)), []);
});

test("picking a catalog Totem option records it under its id, and the result is already reconciled", () => {
  const compendium = catalog();
  const char = totemChar();
  const spirit = totemOffers(char, ["PHB", "SCAG"], compendium).find((c) => c.id === SPIRIT_3);
  assert.ok(spirit, "the Totem Spirit choice is offered");

  const picked = pickRuleChoice(char, spirit, "Elk", compendium);
  assert.deepEqual(picked.ruleChoices?.find((rc) => rc.id === SPIRIT_3)?.picked, ["Elk"]);
  assert.deepEqual(reconcile(picked, compendium), picked);
});
