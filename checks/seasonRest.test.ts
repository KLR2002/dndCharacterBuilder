import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyLongRest, applyShortRest } from "../src/rules/rest.ts";
import { ancestryRuleChoices, availableRuleChoices } from "../src/rules/ruleChoices.ts";
import { makeChar } from "./testUtils.ts";
import type { Character } from "../src/types/character.ts";

const races = JSON.parse(readFileSync(new URL("../src/data/races.json", import.meta.url), "utf8"));

const eladrin = (season: string): Character => {
  const base = makeChar({
    race: { name: "Eladrin", source: "MPMM" },
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
  }) as Character;
  const [choice] = ancestryRuleChoices(base, races);
  if (!choice) throw new Error("expected a season choice");
  return {
    ...base,
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

test("a long rest makes a changeable season re-promptable", () => {
  const rested = applyLongRest(eladrin("Winter"));
  assert.deepEqual(rested.ruleChoices, [], "the season is offered again after a long rest");
  // The choice is still available, so the player can pick a new one.
  assert.equal(availableRuleChoices(rested, races, 3).length, 1);
});

test("a short rest leaves the season unchanged", () => {
  const rested = applyShortRest(eladrin("Winter"));
  assert.deepEqual(rested.ruleChoices?.map((rc) => rc.picked), [["Winter"]]);
});

test("a long rest on a character with no eladrin changes nothing", () => {
  const base = makeChar({ classes: [{ className: "Wizard", source: "PHB", level: 3 }] }) as Character;
  assert.equal(applyLongRest(base).ruleChoices, undefined, "a character with no choices is untouched");
});

test("a long rest leaves an unchangeable choice alone", () => {
  // Only the eladrin's season is changeable at a long rest; a revelation is not.
  const aasimar = makeChar({
    race: { name: "Aasimar", source: "MPMM" },
    classes: [{ className: "Cleric", source: "PHB", level: 3 }],
  }) as Character;
  const [choice] = ancestryRuleChoices(aasimar, races);
  const picked: Character = {
    ...aasimar,
    ruleChoices: [
      {
        id: choice.id,
        trait: choice.traitName,
        origin: "race",
        choose: 1,
        from: choice.options.map((o) => o.name),
        picked: ["Radiant Soul"],
      },
    ],
  };
  assert.deepEqual(applyLongRest(picked).ruleChoices?.map((rc) => rc.picked), [["Radiant Soul"]]);
});