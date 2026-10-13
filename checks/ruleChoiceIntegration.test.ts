import { test } from "node:test";
import assert from "node:assert/strict";
import { availableRuleChoices } from "../src/rules/ruleChoices.ts";
import { DEFAULT_ACTIVE_BOOK_CODES } from "../src/constants/books.ts";
import { makeChar, loadTestCatalog } from "./testUtils.ts";

const races = loadTestCatalog("races");

const aasimar = makeChar({
  race: { name: "Aasimar", source: "MPMM" },
  classes: [{ className: "Cleric", source: "PHB", level: 3 }],
});

test("a rule choice is offered only when its source book is active", () => {
  assert.equal(availableRuleChoices(aasimar, races, 3, DEFAULT_ACTIVE_BOOK_CODES).length, 1);
  assert.equal(availableRuleChoices(aasimar, races, 3, DEFAULT_ACTIVE_BOOK_CODES.filter((b) => b !== "MPMM")).length, 0);
});

test("every choice in the default book set resolves to an available choice", () => {
  const offered = availableRuleChoices(aasimar, races, 3, DEFAULT_ACTIVE_BOOK_CODES);
  for (const choice of offered) {
    assert.ok(choice.options.length >= 2, `${choice.id} should offer at least two options`);
    for (const option of choice.options) {
      assert.ok(option.name.length > 0);
      assert.ok(option.description.length > 0, `${option.name} needs readable text`);
    }
  }
});

test("book filtering is case-insensitive, matching the rest of the catalog", () => {
  assert.equal(availableRuleChoices(aasimar, races, 3, ["phb", "mpmm"]).length, 1);
});

test("option names stay short enough for the picker's wrapping chip grid", () => {
  // RuleChoicePicker renders options in a flexWrap row, so a very long name is a
  // legibility problem rather than an overflow one. Assert the data is bounded.
  const longest = Math.max(
    ...availableRuleChoices(aasimar, races, 20, DEFAULT_ACTIVE_BOOK_CODES).flatMap((c) =>
      c.options.map((o) => o.name.length)
    )
  );
  assert.ok(longest > 0, "there should be options to measure");
  assert.ok(longest < 40, `longest option name is ${longest} characters`);
});
