import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { warlockPactBoonChoices, getChosenPactBoon } from "../src/rules/ruleChoices.ts";
import {
  inMemoryCompendium,
  integratedTestCompendium,
  loadSrdCatalog,
  makeChar,
  srdBaselineCompendium,
} from "./testUtils.ts";
import type { OptionFeatureData } from "../src/types/dnd5e.ts";

const warlock3 = () => makeChar({ classes: [{ className: "Warlock", level: 3, hitDiceType: "d8" }] });

test("SRD mode offers exactly the three SRD boons from the baseline records", () => {
  const choices = warlockPactBoonChoices(warlock3(), undefined, srdBaselineCompendium());
  assert.equal(choices.length, 1);
  assert.equal(choices[0].id, "PHB__Warlock__Pact Boon");
  assert.equal(choices[0].choose, 1);
  assert.deepEqual(
    choices[0].options.map((o) => o.name),
    ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"],
  );

  // Descriptions come from the SRD baseline records, not from a hand-written list.
  const srdBoons = loadSrdCatalog<OptionFeatureData[]>("options_and_features").filter((o) =>
    (o.featureType ?? []).includes("PB"),
  );
  for (const option of choices[0].options) {
    const record = srdBoons.find((o) => o.name === option.name);
    assert.ok(record, `${option.name} is an SRD baseline Pact Boon record`);
    assert.equal(option.description, record.description ?? "");
  }
});

test("a catalog with no Pact Boon records does not offer the Pact Boon choice", () => {
  const empty = inMemoryCompendium({});
  assert.deepEqual(warlockPactBoonChoices(warlock3(), undefined, empty), []);
});

test("a catalog with no Pact Boon records leaves a saved Pact Boon pick untouched", () => {
  const character = makeChar({
    classes: [{ className: "Warlock", level: 3, hitDiceType: "d8" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        origin: "class",
        choose: 1,
        from: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"],
        picked: ["Pact of the Blade"],
      },
    ],
  });
  const reconciled = reconcile(character, inMemoryCompendium({}), { activeBooks: ALL_BOOKS });
  assert.equal(getChosenPactBoon(reconciled), "Pact of the Blade");
  assert.deepEqual(reconciled.ruleChoices, character.ruleChoices);
});

test("integrated mode offers only catalog boons, and the TCE boon only while TCE is active", () => {
  const compendium = integratedTestCompendium();
  const catalogBoons = compendium.for().optionsAndFeatures().filter((o) =>
    (o.featureType ?? []).includes("PB"),
  );
  const namesFor = (activeBooks?: string[]) =>
    warlockPactBoonChoices(warlock3(), activeBooks, compendium)[0].options.map((o) => o.name).sort();

  assert.deepEqual(namesFor(["PHB"]), ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"]);
  assert.deepEqual(namesFor(["PHB", "TCE"]), [
    "Pact of the Blade",
    "Pact of the Chain",
    "Pact of the Talisman",
    "Pact of the Tome",
  ]);
  assert.deepEqual(namesFor(undefined), namesFor(["PHB", "TCE"]));

  for (const option of warlockPactBoonChoices(warlock3(), ["PHB", "TCE"], compendium)[0].options) {
    const record = catalogBoons.find((o) => o.name === option.name);
    assert.ok(record, `${option.name} comes from the catalog`);
    assert.equal(option.description, record.description ?? "");
  }
});
