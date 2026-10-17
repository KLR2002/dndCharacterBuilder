import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, integratedTestCompendium } from "./testUtils.ts";
import { getClassSpellProfiles, isSpellAvailableForClass } from "../src/rules/spellcasting.ts";
import { learnSpell, isKnown } from "../src/rules/characterSpells.ts";
import type { Character } from "../src/types/character.ts";

// A Genie Warlock's kind is a subclass Rule Choice. Its expanded spells (and so what the owner may
// learn) depend on the chosen kind, so the owner gate must see the rule choices, not just the name.

const ACTIVE_BOOKS = ["PHB", "TCE"];
const compendium = integratedTestCompendium();

function genieWarlock(kind: string): Character {
  return makeChar({
    classes: [{ className: "Warlock", source: "TCE", level: 5, subclassName: "The Genie" }],
    ruleChoices: [
      {
        id: "TCE__Warlock__The Genie__Kind",
        trait: "The Genie: Genie Kind",
        origin: "subclass",
        choose: 1,
        from: ["Dao", "Djinni", "Efreeti", "Marid"],
        picked: [kind],
      },
    ],
  });
}

function warlockProfile(char: Character) {
  const profile = getClassSpellProfiles(char, { activeBooks: ACTIVE_BOOKS }).find((p) => p.className === "Warlock");
  assert.ok(profile, "expected a Warlock profile");
  return profile;
}

test("Efreeti Genie Warlock learns Burning Hands through the owner gate", () => {
  const char = genieWarlock("Efreeti");
  const profile = warlockProfile(char);
  const burningHands = { name: "Burning Hands", source: "PHB" };

  const learned = learnSpell(char, profile, burningHands, compendium, ACTIVE_BOOKS);

  assert.notStrictEqual(learned, char, "learnSpell should not reject Burning Hands for an Efreeti");
  assert.equal(isKnown(learned, profile, burningHands), true);
});

test("Dao Genie Warlock does not learn Burning Hands but does learn Sanctuary", () => {
  const char = genieWarlock("Dao");
  const profile = warlockProfile(char);

  const afterBurningHands = learnSpell(char, profile, { name: "Burning Hands", source: "PHB" }, compendium, ACTIVE_BOOKS);
  assert.strictEqual(afterBurningHands, char, "Burning Hands is not an expanded spell for a Dao");

  const afterSanctuary = learnSpell(char, profile, { name: "Sanctuary", source: "PHB" }, compendium, ACTIVE_BOOKS);
  assert.equal(isKnown(afterSanctuary, profile, { name: "Sanctuary", source: "PHB" }), true);
});

test("Efreeti kind is passed to the availability check when the context is given explicitly", () => {
  const burningHands = compendium.findSpell("Burning Hands", "PHB");
  assert.ok(burningHands, "Burning Hands must exist in the integrated compendium");

  assert.equal(
    isSpellAvailableForClass(burningHands, "Warlock", ACTIVE_BOOKS, { subclassName: "The Genie", kind: "Efreeti" }),
    true
  );
});
