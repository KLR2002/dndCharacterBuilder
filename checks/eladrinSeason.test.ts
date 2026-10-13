import { test } from "node:test";
import assert from "node:assert/strict";
import { grantedFeatures } from "../src/rules/grantedFeatures.ts";
import { ancestryRuleChoices, availableRuleChoices } from "../src/rules/ruleChoices.ts";
import { makeChar, loadTestCatalog } from "./testUtils.ts";
import type { Character } from "../src/types/character.ts";

const readCatalog = (name: string) => loadTestCatalog(name);
const catalog = {
  races: readCatalog("races"),
  classes: readCatalog("classes"),
  backgrounds: readCatalog("backgrounds"),
  feats: readCatalog("feats"),
};

const MPMM = makeChar({ race: { name: "Eladrin", source: "MPMM" } }) as Character;
const MTF = makeChar({
  race: { name: "Elf", source: "PHB", subraceName: "Eladrin", subraceSource: "MTF" },
}) as Character;
const DMG = makeChar({
  race: { name: "Elf", source: "PHB", subraceName: "Eladrin", subraceSource: "DMG" },
}) as Character;

const withSeason = (character: Character, season: string): Character => {
  const [choice] = ancestryRuleChoices(character, catalog.races);
  if (!choice) throw new Error("expected a season choice");
  return {
    ...character,
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
    ruleChoices: [
      {
        id: choice.id,
        trait: choice.traitName,
        origin: "race",
        choose: 1,
        from: choice.options.map((o) => o.name),
        picked: [season],
      },
    ],
  };
};

const feyStep = (character: Character) =>
  grantedFeatures(character, catalog).find((f) => f.name === "Fey Step");

test("all four seasons are offered, each with its own text", () => {
  const [choice] = ancestryRuleChoices(MPMM, catalog.races);
  assert.ok(choice);
  assert.deepEqual(choice.options.map((o) => o.name), ["Autumn", "Winter", "Spring", "Summer"]);
  for (const option of choice.options) {
    assert.ok(option.description.length > 20, `${option.name} should carry readable text`);
  }
});

test("the season is recorded at first level but its effect waits until third", () => {
  const atOne = availableRuleChoices(MPMM, catalog.races, 1);
  assert.equal(atOne.length, 1);
  assert.equal(atOne[0].level, 1);
  assert.equal(atOne[0].effectLevel, 3);

  const below = feyStep({ ...withSeason(MPMM, "Winter"), classes: [{ className: "Wizard", source: "PHB", level: 1 }] });
  assert.ok(below, "the trait itself is granted from first level");
  assert.equal(below.chosenOption, undefined, "the extra effect must not apply yet");
});

test("from third level the chosen season's effect appears on the sheet", () => {
  const feature = feyStep(withSeason(MPMM, "Winter"));
  assert.ok(feature);
  assert.equal(feature.chosenOption, "Winter");
  assert.match(feature.description, /frightened/i);
});

test("each season shows only its own effect", () => {
  const summer = feyStep(withSeason(MPMM, "Summer"));
  assert.ok(summer);
  assert.match(summer.description, /fire damage/i);
  assert.doesNotMatch(summer.description, /charmed by you/i, "must not show the Autumn effect");
});

test("the two eladrin entries resolve independently", () => {
  const feySteps = [feyStep(withSeason(MPMM, "Spring")), feyStep(withSeason(MTF, "Autumn"))];
  assert.match(feySteps[0].description, /teleports instead of you/i, "MPMM eladrin spring");
  assert.match(feySteps[1].description, /charmed by you/i, "MTF eladrin autumn");
});

test("their choice ids differ, so one cannot overwrite the other", () => {
  const [mpmmChoice] = ancestryRuleChoices(MPMM, catalog.races);
  const [mtfChoice] = ancestryRuleChoices(MTF, catalog.races);
  assert.notEqual(mpmmChoice.id, mtfChoice.id, "same subrace name, different source");
});

test("the DMG eladrin has no season and is unaffected", () => {
  assert.deepEqual(ancestryRuleChoices(DMG, catalog.races), []);
  const feature = feyStep(DMG);
  assert.ok(feature, "the DMG eladrin still has its own Fey Step");
  assert.equal(feature.chosenOption, undefined);
  assert.match(feature.description, /misty step/i, "the DMG version casts misty step");
});

test("selecting one eladrin does not leak a season onto the other", () => {
  const pickedMtf = withSeason(MTF, "Autumn");
  const mmmFeature = feyStep({ ...pickedMtf, race: MPMM.race });
  assert.equal(mmmFeature?.chosenOption, undefined, "MPMM ids must not match MTF ids");
});