import { test } from "node:test";
import assert from "node:assert/strict";
import { grantedFeatures } from "../src/rules/grantedFeatures.ts";
import { ancestryRuleChoices } from "../src/rules/ruleChoices.ts";
import { makeChar, loadTestCatalog } from "./testUtils.ts";
import type { Character } from "../src/types/character.ts";

const readCatalog = (name: string) => loadTestCatalog(name);
const catalog = {
  races: readCatalog("races"),
  classes: readCatalog("classes"),
  backgrounds: readCatalog("backgrounds"),
  feats: readCatalog("feats"),
};

const drowVariant = (picked: string): Character => {
  const base = makeChar({
    race: { name: "Half-Elf", source: "PHB", subraceName: "Drow Descent", subraceSource: "SCAG" },
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
  }) as Character;
  const [choice] = ancestryRuleChoices(base, catalog.races);
  if (!choice) throw new Error("expected a descent choice");
  return {
    ...base,
    ruleChoices: [
      {
        id: choice.id,
        trait: choice.traitName,
        origin: "race",
        choose: 1,
        from: choice.options.map((o) => o.name),
        picked: [picked],
      },
    ],
  };
};

test("the descent trait lists only the chosen option, not every option", () => {
  const variant = grantedFeatures(drowVariant("Drow Magic"), catalog).find(
    (f) => f.name === "Variant Feature (Choose 1)"
  );
  assert.ok(variant);
  assert.match(variant.description, /dancing lights/i, "the chosen option's text is present");
  assert.doesNotMatch(
    variant.description,
    /two skills of your choice/i,
    "the unchosen Skill Versatility option must not be listed"
  );
  // The chosen option appears exactly once, not duplicated onto the option list.
  const occurrences = variant.description.split("dancing lights").length - 1;
  assert.equal(occurrences, 1, `expected the option text once, saw ${occurrences}`);
});

test("choosing Skill Versatility keeps its text and omits the descent option", () => {
  const variant = grantedFeatures(drowVariant("Skill Versatility"), catalog).find(
    (f) => f.name === "Variant Feature (Choose 1)"
  );
  assert.ok(variant);
  assert.match(variant.description, /two skills of your choice/i);
  assert.doesNotMatch(variant.description, /dancing lights/i, "Drow Magic was not chosen");
});

test("a replaced trait is absent from the sheet whatever the option list shape", () => {
  // The eladrin's options render as bullets and the half-elf's as headings; both
  // must be handled by the same code path.
  const features = grantedFeatures(drowVariant("Drow Magic"), catalog);
  assert.equal(features.find((f) => f.name === "Skill Versatility"), undefined);
});