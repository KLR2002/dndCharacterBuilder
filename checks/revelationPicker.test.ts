import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { availableRuleChoices, ruleChoiceId } from "../src/rules/ruleChoices.ts";
import { setRuleChoicePick, clearRuleChoices } from "../src/rules/builderTransitions.ts";
import { makeChar } from "./testUtils.ts";

const races = JSON.parse(readFileSync(new URL("../src/data/races.json", import.meta.url), "utf8"));

const base = makeChar({
  race: { name: "Aasimar", source: "MPMM" },
  classes: [{ className: "Cleric", source: "PHB", level: 3 }],
});

test("picking an option records it, and re-picking swaps rather than accumulates", () => {
  const choices = availableRuleChoices(base, races, 3);
  const [choice] = choices;

  const picked = setRuleChoicePick(base, choice.id, choice.traitName, "Radiant Soul", choice.options.map((o) => o.name), 1);
  assert.deepEqual(picked.ruleChoices?.[0].picked, ["Radiant Soul"]);

  const swapped = setRuleChoicePick(picked, choice.id, choice.traitName, "Necrotic Shroud", choice.options.map((o) => o.name), 1);
  assert.deepEqual(swapped.ruleChoices?.[0].picked, ["Necrotic Shroud"], "pick 1 means one option");
});

test("deselecting an option clears the entry entirely", () => {
  const [choice] = availableRuleChoices(base, races, 3);
  const picked = setRuleChoicePick(base, choice.id, choice.traitName, "Radiant Soul", choice.options.map((o) => o.name), 1);
  const cleared = setRuleChoicePick(picked, choice.id, choice.traitName, "Radiant Soul", choice.options.map((o) => o.name), 1);
  assert.deepEqual(cleared.ruleChoices, []);
});

test("changing ancestry drops the previous ancestry's picks", () => {
  const [choice] = availableRuleChoices(base, races, 3);
  const picked = setRuleChoicePick(base, choice.id, choice.traitName, "Radiant Soul", choice.options.map((o) => o.name), 1);
  assert.equal(clearRuleChoices(picked).ruleChoices?.length, 0);
});

test("the choice id the picker writes is the one the sheet reads back", () => {
  const [choice] = availableRuleChoices(base, races, 3);
  assert.equal(
    choice.id,
    ruleChoiceId({ source: "MPMM", race: "Aasimar", subrace: null, trait: "Celestial Revelation" })
  );
});