import test from "node:test";
import assert from "node:assert/strict";
import { grantedFeatures } from "../src/rules/grantedFeatures.ts";
import {
  CUSTOM_BACKGROUND_SKILLS_ID,
  CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_GRANT,
  CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_ID,
  borrowableFeatures,
  hasCustomFlag,
  isCustomBackground,
  withoutCatalogCustomBackground,
} from "../src/rules/customBackground.ts";
import { catalogListings } from "../src/rules/catalogs.ts";
import { heldByOtherSources } from "../src/rules/proficiencyChoiceOffers.ts";
import type { BackgroundData } from "../src/types/dnd5e.ts";
import { checkActiveBooksIntegrity, clearBackground, setCustomBackground } from "../src/rules/builderTransitions.ts";
import { proficiencySheet } from "../src/rules/proficiencySheet.ts";
import { dropLegacyBackgroundSkills } from "../src/rules/legacyBackgroundSkills.ts";
import { makeChar, integratedTestCompendium, inMemoryCompendium, srdBaselineCompendium } from "./testUtils.ts";

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

test("a custom background named like a catalog background grants none of that catalog background's feature", () => {
  const catalogBackground: BackgroundData = {
    name: "Gladiator",
    source: "TST",
    skillProficiencies: [],
    toolProficiencies: [],
    languages: [],
    startingEquipment: [],
    feature: { name: "Sample Feature", description: "Placeholder description for the feature." },
    characteristics: {},
    description: "Placeholder description for the background.",
  };
  const custom = makeChar({ background: { name: "Gladiator", source: "Custom" } });
  const features = grantedFeatures(custom, { races: [], classes: [], backgrounds: [catalogBackground], feats: [], activeBooks: ["TST"] });
  assert.equal(features.some((feature) => feature.name === "Sample Feature"), false);
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

test("hasCustomFlag reads only the legacy flag, so a source Custom background without it is not flagged", () => {
  assert.equal(hasCustomFlag({ name: "Gladiator", source: "PHB", isCustom: true }), true);
  assert.equal(hasCustomFlag({ name: "Gladiator", source: "Custom" }), false);
  assert.equal(hasCustomFlag(undefined), false);
});

test("the legacy skill cleanup keeps a custom background's chosen skill, flagged or source Custom, even when its name matches a catalog background", () => {
  const acolyte: BackgroundData = {
    name: "Acolyte",
    source: "PHB",
    skillProficiencies: ["Insight"],
    toolProficiencies: [],
    languages: [],
    grants: [{ id: "PHB/Background/Acolyte@0#0", kind: "fixed", category: "skills", names: ["Insight"] }],
    startingEquipment: [],
    feature: null,
    characteristics: {},
    description: "",
  };
  const compendium = inMemoryCompendium({ backgrounds: [acolyte] }, { integrated: true });
  const activeBooks = ["TCE"];
  const flagged = makeChar({ background: { name: "Acolyte", source: "PHB", isCustom: true }, chosenSkills: ["Insight"] });
  const bySource = makeChar({ background: { name: "Acolyte", source: "Custom" }, chosenSkills: ["Insight"] });
  assert.equal(dropLegacyBackgroundSkills(flagged, compendium, activeBooks), flagged);
  assert.equal(dropLegacyBackgroundSkills(bySource, compendium, activeBooks), bySource);
});

test("the legacy skill cleanup finds a background saved on the SRD Baseline in the catalog, and drops its copy once the book is off", () => {
  const scholar: BackgroundData = {
    name: "Sample Scholar",
    source: "TST",
    skillProficiencies: ["Insight"],
    toolProficiencies: [],
    languages: [],
    grants: [{ id: "TST/Background/Sample Scholar@0#0", kind: "fixed", category: "skills", names: ["Insight"] }],
    startingEquipment: [],
    feature: null,
    characteristics: {},
    description: "",
  };
  const compendium = inMemoryCompendium({ backgrounds: [scholar] }, { integrated: true });
  const character = makeChar({ background: { name: "Sample Scholar", source: "SRD" }, chosenSkills: ["Insight"] });
  assert.deepEqual(dropLegacyBackgroundSkills(character, compendium, ["ALT"]).chosenSkills, []);
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

test("the borrowable features are one row per background feature, labelled by feature and background, without the catalog placeholder", () => {
  const backgrounds = [
    { name: "Custom Background", source: "PHB", feature: { name: "Choose a Feature", description: "Placeholder." } },
    { name: "Lamp Keeper", source: "INV", feature: { name: "Invented Lantern", description: "Invented lantern text." } },
    { name: "Plain Trade", source: "INV", feature: null },
    { name: "Road Scribe", source: "INV", feature: { name: "Invented Route", description: "Invented route text." } },
  ] as unknown as BackgroundData[];
  const rows = borrowableFeatures(backgrounds);
  assert.deepEqual(
    rows.map((row) => [row.label, row.name, row.background, row.description]),
    [
      ["Invented Lantern (Lamp Keeper)", "Invented Lantern", "Lamp Keeper", "Invented lantern text."],
      ["Invented Route (Road Scribe)", "Invented Route", "Road Scribe", "Invented route text."],
    ],
  );
  assert.equal(new Set(rows.map((row) => row.key)).size, rows.length, "each row has its own key");
});

test("the integrated catalog's borrowable features are one per background that has a feature, and none is the placeholder", () => {
  const backgrounds = catalogListings({ compendium: integratedTestCompendium() }).backgrounds();
  const withFeature = withoutCatalogCustomBackground(backgrounds).filter((background) => background.feature);
  const rows = borrowableFeatures(backgrounds);
  assert.equal(rows.length, withFeature.length);
  assert.equal(rows.some((row) => row.background === "Custom Background"), false);
  assert.equal(rows.some((row) => row.name === "Choose a Feature"), false);
});

test("the custom background's tool-or-language grant is exported, and held-by-other-sources sees what the rest of the character holds", () => {
  assert.equal(CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_GRANT.id, CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_ID);
  const compendium = srdBaselineCompendium();
  const held = heldByOtherSources(
    makeChar({ race: { name: "Dwarf", source: "PHB" }, addedTools: ["Smith's Tools"] }),
    CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_GRANT,
    { compendium },
  );
  assert.equal(held("Smith's Tools"), true, "a tool held by hand");
  assert.equal(held("Dwarvish"), true, "a language the race grants");
  assert.equal(held("Elvish"), false, "a language nothing holds");
});

test("a pick on the choice does not hold its own name", () => {
  const compendium = inMemoryCompendium({});
  const picked = makeChar({
    proficiencyPicks: { [CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_ID]: ["Elvish"] },
  });
  assert.equal(heldByOtherSources(picked, CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_GRANT, { compendium })("Elvish"), false);
});

test("a custom background built in the Builder is not warned as from a disabled sourcebook", () => {
  const character = makeChar({ background: { name: "Gladiator Guild", source: "Custom" } });
  assert.deepEqual(checkActiveBooksIntegrity(character, ["PHB"]), []);
});

test("a non-custom background from a disabled sourcebook still gets the warning", () => {
  const character = makeChar({ background: { name: "Acolyte", source: "PHB" } });
  assert.deepEqual(checkActiveBooksIntegrity(character, ["XGE"]), [
    'Background "Acolyte" is from disabled sourcebook "PHB".',
  ]);
});
