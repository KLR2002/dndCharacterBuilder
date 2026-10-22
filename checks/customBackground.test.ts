import test from "node:test";
import assert from "node:assert/strict";
import { grantedFeatures } from "../src/rules/grantedFeatures.ts";
import {
  CUSTOM_BACKGROUND_SKILLS_ID,
  CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_ID,
  isCustomBackground,
  withoutCatalogCustomBackground,
} from "../src/rules/customBackground.ts";
import { catalogListings } from "../src/rules/catalogs.ts";
import { clearBackground, setCustomBackground } from "../src/rules/builderTransitions.ts";
import { proficiencySheet } from "../src/rules/proficiencySheet.ts";
import { makeChar, integratedTestCompendium, inMemoryCompendium } from "./testUtils.ts";

const EMPTY_CATALOG = { races: [], classes: [], backgrounds: [], feats: [] };
const borrowedFeatures = (character: ReturnType<typeof makeChar>) =>
  grantedFeatures(character, EMPTY_CATALOG).filter((feature) => feature.origin === "Background");

test("a custom background's tool-or-language picks are stored under their grant id, beside the skill picks", () => {
  const custom = setCustomBackground(makeChar(), "Gladiator", ["Acrobatics", "Performance"], {
    toolsOrLanguages: ["Smith's Tools", "Elvish"],
  });
  assert.equal(CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_ID, "Custom/Background/Custom Background@0#languages:choice:any");
  assert.deepEqual(custom.proficiencyPicks?.[CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_ID], ["Smith's Tools", "Elvish"]);
  assert.deepEqual(custom.proficiencyPicks?.[CUSTOM_BACKGROUND_SKILLS_ID], ["Acrobatics", "Performance"]);
  assert.deepEqual(custom.background, { name: "Gladiator", source: "Custom" });
});

test("a custom background with no tool-or-language picks stores none under their grant id", () => {
  const custom = setCustomBackground(makeChar(), "Gladiator", ["Acrobatics", "Performance"]);
  assert.equal(custom.proficiencyPicks?.[CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_ID], undefined);
});

test("a borrowed feature is stored on the custom background and granted with origin Background", () => {
  const custom = setCustomBackground(makeChar(), "Gladiator", ["Acrobatics", "Performance"], {
    feature: { name: "Invented Favor", description: "Invented text for the favor." },
  });
  assert.deepEqual(custom.background, {
    name: "Gladiator",
    source: "Custom",
    customFeatureName: "Invented Favor",
    customFeatureDesc: "Invented text for the favor.",
  });
  assert.deepEqual(
    borrowedFeatures(custom).map((feature) => [feature.name, feature.description, feature.origin]),
    [["Invented Favor", "Invented text for the favor.", "Background"]],
  );
});

test("a custom background with no borrowed feature grants no background feature", () => {
  const custom = setCustomBackground(makeChar(), "Gladiator", ["Acrobatics", "Performance"]);
  assert.deepEqual(borrowedFeatures(custom), []);
});

test("clearing a custom background drops its borrowed feature and releases its tool-or-language picks", () => {
  const compendium = inMemoryCompendium({});
  const custom = setCustomBackground(
    makeChar(),
    "Gladiator",
    ["Acrobatics", "Performance"],
    { toolsOrLanguages: ["Elvish", "Smith's Tools"], feature: { name: "Invented Favor", description: "Invented." } },
  );
  assert.equal(borrowedFeatures(custom).length, 1);
  assert.ok(proficiencySheet(custom, { compendium }).languages.some((entry) => entry.name === "Elvish"));

  const cleared = clearBackground(custom, { compendium });
  assert.equal(cleared.background, null);
  assert.deepEqual(borrowedFeatures(cleared), []);
  assert.equal(cleared.proficiencyPicks?.[CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_ID], undefined);
  assert.equal(
    proficiencySheet(cleared, { compendium }).languages.some((entry) => entry.name === "Elvish"),
    false,
  );
});

test("a custom background is one whose source is Custom or that is flagged custom", () => {
  assert.equal(isCustomBackground({ name: "Gladiator", source: "Custom" }), true);
  assert.equal(isCustomBackground({ name: "Gladiator", source: "PHB", isCustom: true }), true);
  assert.equal(isCustomBackground({ name: "Acolyte", source: "PHB" }), false);
  assert.equal(isCustomBackground(null), false);
  assert.equal(isCustomBackground(undefined), false);
});

test("grantedFeatures reads the borrowed feature of a custom background by its source, and of a flagged one", () => {
  const bySource = makeChar({
    background: { name: "Gladiator", source: "Custom", customFeatureName: "Invented Favor", customFeatureDesc: "Invented." },
  });
  const flagged = makeChar({
    background: { name: "Gladiator", source: "PHB", isCustom: true, customFeatureName: "Invented Favor", customFeatureDesc: "Invented." },
  });
  assert.deepEqual(borrowedFeatures(bySource).map((feature) => feature.name), ["Invented Favor"]);
  assert.deepEqual(borrowedFeatures(flagged).map((feature) => feature.name), ["Invented Favor"]);
});

test("the catalog's Custom Background entry is left out of the Builder's background list, and the rest stay", () => {
  const listed = withoutCatalogCustomBackground([
    { name: "Acolyte", source: "PHB" },
    { name: "Custom Background", source: "PHB" },
    { name: "Sage", source: "PHB" },
  ]);
  assert.deepEqual(listed.map((background) => background.name), ["Acolyte", "Sage"]);
});

test("the integrated catalog lists the Custom Background entry, and the Builder's list leaves it out", () => {
  const backgrounds = catalogListings({ compendium: integratedTestCompendium() }).backgrounds();
  assert.ok(backgrounds.some((background) => background.name === "Custom Background"), "the catalog has the entry");
  assert.equal(
    withoutCatalogCustomBackground(backgrounds).some((background) => background.name === "Custom Background"),
    false,
  );
});
