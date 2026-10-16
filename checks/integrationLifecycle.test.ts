import test from "node:test";
import assert from "node:assert/strict";
import {
  __setCompendiumKvForTests,
  saveCompendiumData,
  clearCompendiumData,
  hasIntegratedCatalog,
} from "../src/services/compendiumStorage.ts";
import {
  isCompendiumIntegrated,
  getRaces,
  getClasses,
  getFeats,
  getBackgrounds,
  getSpells,
} from "../src/services/dataService.ts";
import { getAvailableSpellsForClass } from "../src/rules/spellcasting.ts";
import { hydrateCompendiumFromStorage, loadTestCatalog, resetTestCompendium } from "./testUtils.ts";

test("End-to-End Integration Lifecycle: SRD baseline -> Integration -> Book gating -> Revert", async () => {
  const testKv = new Map<string, string>();
  __setCompendiumKvForTests(testKv);

  try {
    // -------------------------------------------------------------
    // Phase 1: Baseline SRD Mode (Pre-integration)
    // -------------------------------------------------------------
    await clearCompendiumData();
    await hydrateCompendiumFromStorage();

    assert.equal(await hasIntegratedCatalog(), false, "Should not be marked as integrated");
    assert.equal(isCompendiumIntegrated(), false, "dataService should report unintegrated");

    const srdRaces = getRaces();
    assert.equal(srdRaces.length, 9, "SRD baseline should contain exactly 9 races");
    assert.ok(srdRaces.every((r) => r.source === "SRD"), "All SRD races must have source === 'SRD'");

    const srdClasses = getClasses();
    assert.equal(srdClasses.length, 12, "SRD baseline should contain exactly 12 classes");
    assert.ok(srdClasses.every((c) => c.source === "SRD"), "All SRD classes must have source === 'SRD'");
    assert.ok(srdClasses.every((c) => c.subclasses.length === 1), "Each SRD class has exactly 1 archetype");

    const srdFeats = getFeats();
    assert.equal(srdFeats.length, 1, "Only Grappler feat is part of SRD 5.1");
    assert.equal(srdFeats[0].name, "Grappler");

    const srdBackgrounds = getBackgrounds();
    assert.equal(srdBackgrounds.length, 1, "Only Acolyte background is part of SRD 5.1");
    assert.equal(srdBackgrounds[0].name, "Acolyte");

    // -------------------------------------------------------------
    // Phase 2: Integration Cutover (IndexedDB hydrated with 5eTools)
    // -------------------------------------------------------------
    const fullCompendium = {
      hasIntegratedCatalog: true,
      integratedAt: new Date().toISOString(),
      races: loadTestCatalog("races"),
      classes: loadTestCatalog("classes"),
      feats: loadTestCatalog("feats"),
      optionsAndFeatures: loadTestCatalog("options_and_features"),
      backgrounds: loadTestCatalog("backgrounds"),
      items: loadTestCatalog("items"),
      spells: loadTestCatalog("spells"),
      beasts: loadTestCatalog("beasts"),
      conditions: loadTestCatalog("conditions"),
      books: loadTestCatalog("books"),
    };

    await saveCompendiumData(fullCompendium);
    await hydrateCompendiumFromStorage();

    assert.equal(await hasIntegratedCatalog(), true, "Should report hasIntegratedCatalog = true");
    assert.equal(isCompendiumIntegrated(), true, "dataService should report integrated");

    const integratedRaces = getRaces();
    assert.ok(integratedRaces.length > 9, "Integrated compendium must have expansion races");
    // Verify dataset swapping: SRD records are deactivated to avoid duplicates
    assert.ok(
      integratedRaces.every((r) => r.source !== "SRD"),
      "SRD baseline races must be excluded when integrated compendium is active"
    );

    const integratedClasses = getClasses();
    assert.ok(integratedClasses.length >= 12, "Integrated classes should include all classes");
    assert.ok(
      integratedClasses.every((c) => c.source !== "SRD"),
      "SRD baseline classes must be excluded when integrated compendium is active"
    );

    // Verify subclasses are expanded (Fighter has Champion, Battle Master, Eldritch Knight, etc.)
    const fighter = integratedClasses.find((c) => c.name === "Fighter");
    assert.ok(fighter, "Fighter must exist in integrated catalog");
    assert.ok(fighter.subclasses.length > 1, "Integrated Fighter should have multiple subclasses");
    const subNames = fighter.subclasses.map((s) => s.name);
    assert.ok(subNames.includes("Champion"), "Champion exists");
    assert.ok(subNames.includes("Battle Master"), "Battle Master exists");
    assert.ok(subNames.includes("Eldritch Knight"), "Eldritch Knight exists");

    // Verify expanded feats and backgrounds
    const integratedFeats = getFeats();
    assert.ok(integratedFeats.length > 1, "Expansion feats exist");
    assert.ok(integratedFeats.some((f) => f.name === "Alert"), "Alert feat exists in expansion catalog");

    // -------------------------------------------------------------
    // Phase 3: Book Gating
    // -------------------------------------------------------------
    const allSpells = getSpells();
    const tollTheDead = allSpells.find((s) => s.name === "Toll the Dead");
    assert.ok(tollTheDead, "Toll the Dead should be in integrated spells catalog");
    assert.equal(tollTheDead.source, "XGE", "Toll the Dead is from XGE");

    // With only PHB active, XGE spells are filtered out
    const phbWizardSpells = getAvailableSpellsForClass(allSpells, "Wizard", ["PHB"]);
    const hasTollInPhb = phbWizardSpells.some((s) => s.name === "Toll the Dead");
    assert.equal(hasTollInPhb, false, "Toll the Dead should not be available with only PHB active");

    // With PHB and XGE active, Toll the Dead is available
    const xgeWizardSpells = getAvailableSpellsForClass(allSpells, "Wizard", ["PHB", "XGE"]);
    const hasTollInXge = xgeWizardSpells.some((s) => s.name === "Toll the Dead");
    assert.equal(hasTollInXge, true, "Toll the Dead should be available with PHB + XGE active");

    // -------------------------------------------------------------
    // Phase 4: Revert to SRD Baseline
    // -------------------------------------------------------------
    await clearCompendiumData();
    await hydrateCompendiumFromStorage();

    assert.equal(await hasIntegratedCatalog(), false, "After revert, hasIntegratedCatalog must be false");
    assert.equal(isCompendiumIntegrated(), false, "After revert, isCompendiumIntegrated must be false");

    const revertedRaces = getRaces();
    assert.equal(revertedRaces.length, 9, "Races should revert to 9 SRD races");
    assert.ok(revertedRaces.every((r) => r.source === "SRD"), "Reverted races must have source === 'SRD'");

    const revertedClasses = getClasses();
    assert.equal(revertedClasses.length, 12, "Classes should revert to 12 SRD classes");
    assert.ok(revertedClasses.every((c) => c.source === "SRD"), "Reverted classes must have source === 'SRD'");
    assert.ok(revertedClasses.every((c) => c.subclasses.length === 1), "Reverted classes must each have 1 archetype");

    const revertedFeats = getFeats();
    assert.equal(revertedFeats.length, 1, "Feats should revert to 1 SRD feat (Grappler)");
    assert.equal(revertedFeats[0].name, "Grappler");
  } finally {
    await clearCompendiumData();
    __setCompendiumKvForTests(undefined);
    resetTestCompendium();
  }
});
