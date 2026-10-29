import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { availableRuleChoices, pickRuleChoice, ruleChoiceId } from "../src/rules/ruleChoices.ts";
import { clearRuleChoices } from "../src/rules/builderTransitions.ts";
import { makeChar, loadTestCatalog } from "./testUtils.ts";

const races = loadTestCatalog("races");

const base = makeChar({
  race: { name: "Aasimar", source: "MPMM" },
  classes: [{ className: "Cleric", source: "PHB", level: 3 }],
});

test("picking an option records it, and re-picking swaps rather than accumulates", () => {
  const choices = availableRuleChoices(base, races, 3, ALL_BOOKS);
  const [choice] = choices;

  const picked = pickRuleChoice(base, choice, "Radiant Soul", undefined, ALL_BOOKS);
  assert.deepEqual(picked.ruleChoices?.[0].picked, ["Radiant Soul"]);

  const swapped = pickRuleChoice(picked, choice, "Necrotic Shroud", undefined, ALL_BOOKS);
  assert.deepEqual(swapped.ruleChoices?.[0].picked, ["Necrotic Shroud"], "pick 1 means one option");
});

test("deselecting an option clears the entry entirely", () => {
  const [choice] = availableRuleChoices(base, races, 3, ALL_BOOKS);
  const picked = pickRuleChoice(base, choice, "Radiant Soul", undefined, ALL_BOOKS);
  const cleared = pickRuleChoice(picked, choice, "Radiant Soul", undefined, ALL_BOOKS);
  assert.deepEqual(cleared.ruleChoices, []);
});

test("changing ancestry drops the previous ancestry's picks", () => {
  const [choice] = availableRuleChoices(base, races, 3, ALL_BOOKS);
  const picked = pickRuleChoice(base, choice, "Radiant Soul", undefined, ALL_BOOKS);
  assert.equal(clearRuleChoices(picked).ruleChoices?.length, 0);
});

test("the choice id the picker writes is the one the sheet reads back", () => {
  const [choice] = availableRuleChoices(base, races, 3, ALL_BOOKS);
  assert.equal(
    choice.id,
    ruleChoiceId({ source: "MPMM", race: "Aasimar", subrace: null, trait: "Celestial Revelation" })
  );
});