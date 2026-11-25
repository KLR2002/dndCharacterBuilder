import test from "node:test";
import assert from "node:assert/strict";
import {
  __setCompendiumKvForTests,
  loadCompendiumData,
} from "../src/services/compendiumStorage.ts";
import { currentCompendium, integrate, revertToSrd } from "../src/services/compendium.ts";
import { __setKvForTests, updateSettings } from "../src/services/storage.ts";
import { resetTestCompendium } from "./testUtils.ts";

const CATALOG_KEY = "@dnd5e_integrated_compendium";
const SETTINGS_KEY = "@dnd5e_app_settings";

/** An Integrated Catalog saved with two beasts, in the shape the sync saves. */
function savedCatalogWithBeasts() {
  return {
    hasIntegratedCatalog: true,
    catalogFormat: 16,
    integratedAt: "2026-03-01T09:00:00.000Z",
    races: [{ name: "Elf", source: "PHB", speed: { walk: 30 }, traits: [] }],
    classes: [{ name: "Wizard", source: "PHB", hitDie: 6, subclasses: [] }],
    feats: [{ name: "Alert", source: "PHB" }],
    backgrounds: [],
    items: [{ name: "Rope", source: "PHB" }],
    spells: [{ name: "Light", source: "PHB", level: 0 }],
    beasts: [
      { name: "Brown Bear", source: "MM", type: "beast", cr: "1", size: ["L"], ac: 11, hp: { average: 34, formula: "4d10+12" }, speed: { walk: 40 } },
      { name: "Fire Elemental", source: "MM", type: "elemental", cr: "5", size: ["L"], ac: 13, hp: { average: 102, formula: "12d10+36" }, speed: { walk: 50 } },
    ],
    conditions: [],
    optionsAndFeatures: [],
    books: [],
    originRules: [],
  };
}

test("switching Skip Beasts on and off leaves the saved catalog and the beast list unchanged", async () => {
  const catalogKv = new Map<string, string>([[CATALOG_KEY, JSON.stringify(savedCatalogWithBeasts())]]);
  __setCompendiumKvForTests(catalogKv);
  __setKvForTests(new Map([[SETTINGS_KEY, JSON.stringify({})]]));
  integrate(JSON.parse(catalogKv.get(CATALOG_KEY)!));
  try {
    const savedBefore = await loadCompendiumData();
    assert.ok(savedBefore);
    const beastsBefore = currentCompendium().for().beasts().map((b) => b.name);
    assert.deepEqual(beastsBefore, ["Brown Bear", "Fire Elemental"]);

    await updateSettings({ skipBeasts: true });
    assert.deepEqual(await loadCompendiumData(), savedBefore, "the saved catalog is unchanged with Skip Beasts on");
    assert.deepEqual(currentCompendium().for().beasts().map((b) => b.name), beastsBefore);

    await updateSettings({ skipBeasts: false });
    assert.deepEqual(await loadCompendiumData(), savedBefore, "the saved catalog is unchanged with Skip Beasts off again");
    assert.deepEqual(currentCompendium().for().beasts().map((b) => b.name), beastsBefore);
  } finally {
    __setCompendiumKvForTests(undefined);
    __setKvForTests(new Map());
    revertToSrd();
    resetTestCompendium();
  }
});
