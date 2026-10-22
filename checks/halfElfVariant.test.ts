import { test } from "node:test";
import assert from "node:assert/strict";
import { grantedFeatures } from "../src/rules/grantedFeatures.ts";
import { availableRuleChoices, ruleChoiceId, ancestryRuleChoices } from "../src/rules/ruleChoices.ts";
import { skills } from "../src/rules/skills.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { integratedTestCompendium, makeChar, loadTestCatalog } from "./testUtils.ts";
import type { Character } from "../src/types/character.ts";

const readCatalog = (name: string) => loadTestCatalog(name);
const catalog = {
  races: readCatalog("races"),
  classes: readCatalog("classes"),
  backgrounds: readCatalog("backgrounds"),
  feats: readCatalog("feats"),
};
const races = catalog.races;

const DESCENT = "Drow Descent";
const halfElfVariant = (picked: string[]) => {
  const character = makeChar({
    race: { name: "Half-Elf", source: "PHB", subraceName: DESCENT, subraceSource: "SCAG" },
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
  }) as Character;
  const choice = ancestryRuleChoices(character, races)[0];
  if (!choice) throw new Error("expected a descent choice");
  return {
    ...character,
    ruleChoices: [{ id: choice.id, trait: choice.traitName, origin: "race" as const, choose: 1, from: choice.options.map((o) => o.name), picked }],
  };
};

/** The race's skill Proficiency Choices the character is offered: the grant ids carry the category. */
const skillOffersOf = (character: Character) =>
  proficiencyChoiceOffers(character, { compendium: integratedTestCompendium() }).filter((offer) => offer.id.includes("#skills:"));

const choiceId = (subrace: string) =>
  ruleChoiceId({ source: "SCAG", race: "Half-Elf", subrace: { name: subrace }, trait: "Variant Feature (Choose 1)" });

test("each SCAG descent offers exactly its own option set", () => {
  const expected: Record<string, string[]> = {
    "Drow Descent": ["Skill Versatility", "Drow Magic"],
    "Aquatic Elf Descent": ["Skill Versatility", "Swim"],
  };
  for (const [descent, options] of Object.entries(expected)) {
    const character = makeChar({
      race: { name: "Half-Elf", source: "PHB", subraceName: descent, subraceSource: "SCAG" },
    });
    const [choice] = ancestryRuleChoices(character, races);
    assert.ok(choice, `${descent} should offer a choice`);
    assert.deepEqual(choice.options.map((o) => o.name), options, `${descent} option set`);
  }
});

test("choosing Skill Versatility yields the normal two-skill choice", () => {
  const choices = skillOffersOf(halfElfVariant(["Skill Versatility"]));
  assert.equal(choices.length, 1);
  assert.equal(choices[0].choose, 2);
  assert.equal(choices[0].options.length, 18);
});

test("choosing a descent feature yields no skill choice at all", () => {
  assert.deepEqual(skillOffersOf(halfElfVariant(["Drow Magic"])), [], "the variant replaced Skill Versatility, so no skill choice remains");
});

test("a variant half-elf picking a descent feature gains no skill choice to fill", () => {
  // What matters is that a descent pick offers no skill choice at all - the
  // two-skill picker never appears - while a Skill Versatility pick does.
  assert.deepEqual(skillOffersOf(halfElfVariant(["Drow Magic"])), []);
  const svPick = skillOffersOf(halfElfVariant(["Skill Versatility"]));
  assert.equal(svPick.length, 1);
  assert.equal(svPick[0].choose, 2);
});

test("the chosen descent feature appears on the sheet", () => {
  const features = grantedFeatures(halfElfVariant(["Drow Magic"]), catalog);
  const variant = features.find((f) => f.name === "Variant Feature (Choose 1)");
  assert.ok(variant);
  assert.equal(variant.chosenOption, "Drow Magic");
  assert.match(variant.description, /dancing lights/i);
});

test("Skill Versatility is suppressed when a different feature was chosen", () => {
  const features = grantedFeatures(halfElfVariant(["Drow Magic"]), catalog);
  const sv = features.find((f) => f.name === "Skill Versatility");
  assert.equal(sv, undefined, "the catalog marks the descent feature as replacing Skill Versatility");
});

test("choosing Skill Versatility keeps the trait rather than suppressing it", () => {
  const features = grantedFeatures(halfElfVariant(["Skill Versatility"]), catalog);
  const variant = features.find((f) => f.name === "Variant Feature (Choose 1)");
  assert.equal(variant.chosenOption, "Skill Versatility");
  assert.match(variant.description, /two skills of your choice/i);
});

test("a base (non-variant) half-elf still gets Skill Versatility and no descent choice", () => {
  const base = makeChar({ race: { name: "Half-Elf", source: "PHB" } });
  assert.deepEqual(ancestryRuleChoices(base, races), []);
  const choices = skillOffersOf(base);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].choose, 2);
  assert.ok(grantedFeatures(base, catalog).some((f) => f.name === "Skill Versatility"));
});

test("a variant half-elf with no recorded choice shows no descent feature as chosen", () => {
  const character = makeChar({
    race: { name: "Half-Elf", source: "PHB", subraceName: DESCENT, subraceSource: "SCAG" },
  });
  const features = grantedFeatures(character, catalog);
  const variant = features.find((f) => f.name === "Variant Feature (Choose 1)");
  assert.equal(variant?.chosenOption, undefined);
  assert.deepEqual(ancestryRuleChoices(character, races)[0].id, choiceId(DESCENT));
});

test("the descent choice is offered from first level and has no separate effect level", () => {
  const character = makeChar({ race: { name: "Half-Elf", source: "PHB", subraceName: DESCENT, subraceSource: "SCAG" } });
  const atOne = availableRuleChoices(character, races, 1);
  assert.equal(atOne.length, 1);
  assert.equal(atOne[0].level, 1);
  assert.equal(atOne[0].effectLevel, 1);
});