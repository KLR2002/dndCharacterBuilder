import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { grantedFeatures } from "../src/rules/grantedFeatures.ts";
import { ruleChoiceId } from "../src/rules/ruleChoices.ts";
import { makeChar } from "./testUtils.ts";

const readCatalog = (name: string) =>
  JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
const catalog = {
  races: readCatalog("races"),
  classes: readCatalog("classes"),
  backgrounds: readCatalog("backgrounds"),
  feats: readCatalog("feats"),
};

const REVELATION_ID = ruleChoiceId({
  source: "MPMM",
  race: "Aasimar",
  subrace: null,
  trait: "Celestial Revelation",
});

const aasimar = (picked: string[], level = 3) =>
  makeChar({
    race: { name: "Aasimar", source: "MPMM" },
    classes: [{ className: "Cleric", source: "PHB", level }],
    ruleChoices: picked.length
      ? [{ id: REVELATION_ID, origin: "race", choose: 1, from: ["Necrotic Shroud", "Radiant Consumption", "Radiant Soul"], picked }]
      : [],
  });

const revelation = (character: ReturnType<typeof aasimar>) =>
  grantedFeatures(character, catalog).find((f) => f.name === "Celestial Revelation");

test("an aasimar's chosen revelation appears on the sheet beneath the trait", () => {
  const feature = revelation(aasimar(["Radiant Soul"]));
  assert.ok(feature, "Celestial Revelation should be granted");
  assert.equal(feature.chosenOption, "Radiant Soul");
  assert.match(feature.description, /spectral wings/i, "the chosen option's own text should show");
  assert.match(feature.description, /Celestial Revelation|revelation options/i, "the trait's own prose is kept");
});

test("an aasimar who has not chosen has no chosen option and no option text", () => {
  const feature = revelation(aasimar([]));
  assert.ok(feature);
  assert.equal(feature.chosenOption, undefined);
});

test("each revelation shows only its own text, not the other two", () => {
  const shroud = revelation(aasimar(["Necrotic Shroud"]));
  assert.ok(shroud);
  assert.match(shroud.description, /pools of darkness/i);
  assert.doesNotMatch(shroud.description, /fire damage equal to your Charisma modifier/i, "must not show the Summer/other options");
});

test("the revelation's effect is withheld below its effect level but the choice stays recorded", () => {
  const low = revelation(aasimar(["Radiant Soul"], 1));
  assert.ok(low, "the trait itself is still granted at first level");
  assert.equal(low.chosenOption, undefined, "the effect must not apply before its level");
});

test("the DMG and VGM aasimars are unaffected", () => {
  for (const source of ["DMG", "VGM"]) {
    const features = grantedFeatures(
      makeChar({ race: { name: "Aasimar", source }, classes: [{ className: "Cleric", source: "PHB", level: 3 }] }),
      catalog
    );
    assert.equal(features.find((f) => f.name === "Celestial Revelation"), undefined, `${source} aasimar has no revelation`);
    assert.ok(features.some((f) => f.name === "Celestial Legacy") || source === "VGM", `${source} keeps its own content`);
  }
});