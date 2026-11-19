import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { availableRuleChoices, availableSubclassRuleChoices } from "../src/rules/ruleChoices.ts";
import type { Character } from "../src/types/character.ts";
import { describeClassFeature } from "../src/rules/featureOptions.ts";
import { classChoicesStepView } from "../src/rules/classChoices.ts";
import { checkActiveBooksIntegrity } from "../src/rules/builderTransitions.ts";
import { subclassOptions } from "../src/rules/levelUpFlow.ts";
import type { ClassFeatureData } from "../src/types/dnd5e.ts";
import { integratedTestCompendium, loadTestCatalog, makeChar, srdBaselineCompendium } from "./testUtils.ts";

const races = loadTestCatalog("races");
const integrated = integratedTestCompendium();
const srd = srdBaselineCompendium();

const aasimar = (): Character => makeChar({ race: { name: "Aasimar", source: "MPMM" } });

describe("book admission in Rule Choices and subclass offers", () => {
  test("mixed-case books give the same ancestry Rule Choices as upper-case", () => {
    const upper = availableRuleChoices(aasimar(), races, 3, ["MPMM"], integrated);
    const mixed = availableRuleChoices(aasimar(), races, 3, ["mpmm"], integrated);
    assert.equal(upper.length, 1);
    assert.deepEqual(mixed.map((c) => c.id), upper.map((c) => c.id));
  });

  test("mixed-case books give the same subclass Rule Choices as upper-case", () => {
    const druid = makeChar({ classes: [{ className: "Druid", source: "PHB", level: 2, subclassName: "Circle of the Land" }] });
    const upper = availableSubclassRuleChoices(druid, ["PHB"], integrated);
    const mixed = availableSubclassRuleChoices(druid, ["phb"], integrated);
    assert.ok(upper.length > 0, "the Circle of the Land offers its biome");
    assert.deepEqual(mixed.map((c) => c.id), upper.map((c) => c.id));
  });

  test("mixed-case books give the same subclass offers as upper-case", () => {
    const upper = subclassOptions("Wizard", "PHB", { compendium: integrated, activeBooks: ["PHB"] });
    const mixed = subclassOptions("Wizard", "PHB", { compendium: integrated, activeBooks: ["phb"] });
    assert.ok(upper.length > 0, "the Wizard offers its subclasses");
    assert.deepEqual(mixed, upper);
  });

  test("a Hunter's Prey option sourced SRD is listed by describeClassFeature with books XGE", () => {
    const feature: ClassFeatureData = {
      name: "Hunter's Prey",
      level: 3,
      description: "Placeholder description.",
      choices: {
        pick: 1,
        options: [
          { name: "Colossus Slayer", description: "Colossus text.", source: "SRD" },
          { name: "Placeholder Gamma", description: "Gamma text.", source: "XGE" },
        ],
      },
    };
    const text = describeClassFeature(feature, "PHB", ["XGE"], "fallback", integrated);
    assert.match(text, /\*\*Colossus Slayer\*\*/);
    assert.match(text, /\*\*Placeholder Gamma\*\*/);
  });

  test("with the SRD Baseline and books SRD, an SRD Ranger 3 Hunter is offered Hunter's Prey", () => {
    const ranger = makeChar({ classes: [{ className: "Ranger", source: "SRD", level: 3, subclassName: "Hunter" }] });
    const view = classChoicesStepView(ranger, { compendium: srd, activeBooks: ["SRD"] });
    const prey = view.cards.other.filter((choice) => choice.traitName === "Hunter's Prey");
    assert.equal(prey.length, 1);
    assert.deepEqual(
      prey[0].options.map((option) => option.name),
      ["Colossus Slayer", "Giant Killer", "Horde Breaker"],
    );
  });

  test("with the SRD Baseline and books SRD, an SRD Druid 2 Land is offered its Biome pick", () => {
    const druid = makeChar({ classes: [{ className: "Druid", source: "SRD", level: 2, subclassName: "Land" }] });
    const view = classChoicesStepView(druid, { compendium: srd, activeBooks: ["SRD"] });
    const biomes = view.cards.other.filter((choice) => choice.options.length === 8);
    assert.equal(biomes.length, 1, "the Land offers one pick of eight biomes");
  });

  test("an integrated character with an XGE feat warns when books are PHB", () => {
    const character = makeChar({
      asiSelections: [{ level: 4, type: "feat", featName: "Placeholder Feat", featSource: "XGE" }],
    });
    const warnings = checkActiveBooksIntegrity(character, ["PHB"], integrated);
    assert.ok(warnings.some((w) => w.includes("Placeholder Feat") && w.includes("XGE")));
  });

  test("the same character with the SRD Baseline gets no warning", () => {
    const character = makeChar({
      asiSelections: [{ level: 4, type: "feat", featName: "Placeholder Feat", featSource: "XGE" }],
    });
    assert.deepEqual(checkActiveBooksIntegrity(character, ["PHB"], srd), []);
  });

  test("an SRD race never warns", () => {
    const character = makeChar({ race: { name: "Human", source: "SRD" } });
    assert.deepEqual(checkActiveBooksIntegrity(character, ["PHB"], integrated), []);
  });
});
