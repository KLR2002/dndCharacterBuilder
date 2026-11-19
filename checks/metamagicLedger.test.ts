import { ALL_BOOKS } from "../src/constants/books.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import { metamagicAllowance } from "../src/rules/spellcasting.ts";
import { toggleMetamagic } from "../src/rules/characterSpells.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import type { Character } from "../src/types/character.ts";

const sorcerer = (level: number, chosenMetamagic: string[] = []): Character =>
  makeChar({ classes: [{ className: "Sorcerer", source: "PHB", level }], chosenMetamagic });

const THREE_PICKS = ["Quickened Spell", "Twinned Spell", "Careful Spell"];

describe("Metamagic in the Ledger", () => {
  it("allows nothing below Sorcerer 3, then 2, 3 at 10 and 4 at 17", () => {
    assert.equal(metamagicAllowance(makeChar()), 0);
    assert.equal(metamagicAllowance(sorcerer(2)), 0);
    assert.equal(metamagicAllowance(sorcerer(3)), 2);
    assert.equal(metamagicAllowance(sorcerer(9)), 2);
    assert.equal(metamagicAllowance(sorcerer(10)), 3);
    assert.equal(metamagicAllowance(sorcerer(17)), 4);
  });

  it("drops a chosen option, adds below the allowance, and returns the same character at it", () => {
    const full = sorcerer(3, ["Quickened Spell", "Twinned Spell"]);
    assert.equal(toggleMetamagic(full, "Careful Spell"), full);

    const dropped = toggleMetamagic(full, "Quickened Spell");
    assert.deepEqual(dropped.chosenMetamagic, ["Twinned Spell"]);
    assert.deepEqual(toggleMetamagic(dropped, "Careful Spell").chosenMetamagic, ["Twinned Spell", "Careful Spell"]);
  });

  it("adds nothing to a character with no allowance", () => {
    const below = sorcerer(2);
    assert.equal(toggleMetamagic(below, "Quickened Spell"), below);
  });

  it("releases the picks above a lost level with one notice each", () => {
    const compendium = currentCompendium();
    const reconciled = reconcile(sorcerer(9, THREE_PICKS), compendium, { activeBooks: ALL_BOOKS });
    assert.deepEqual(reconciled.chosenMetamagic, ["Quickened Spell", "Twinned Spell"]);
    assert.deepEqual(reconciled.needsReview, ["Careful Spell removed: Metamagic allows 2"]);
  });

  it("keeps the picks at the allowance, and a second reconcile adds no notice", () => {
    const compendium = currentCompendium();
    const atTen = reconcile(sorcerer(10, THREE_PICKS), compendium, { activeBooks: ALL_BOOKS });
    assert.deepEqual(atTen.chosenMetamagic, THREE_PICKS);
    assert.equal(atTen.needsReview, undefined);

    const lost = reconcile(sorcerer(9, THREE_PICKS), compendium, { activeBooks: ALL_BOOKS });
    const again = reconcile(lost, compendium, { activeBooks: ALL_BOOKS });
    assert.deepEqual(again.chosenMetamagic, ["Quickened Spell", "Twinned Spell"]);
    assert.deepEqual(again.needsReview, ["Careful Spell removed: Metamagic allows 2"]);
  });

  it("keeps an empty list for a character without Sorcerer levels", () => {
    const reconciled = reconcile(makeChar(), currentCompendium(), { activeBooks: ALL_BOOKS });
    assert.deepEqual(reconciled.chosenMetamagic, []);
    assert.equal(reconciled.needsReview, undefined);
  });

  it("migrates metamagicOptions into chosenMetamagic and drops the legacy field", () => {
    const legacy = JSON.parse(
      JSON.stringify({
        ...sorcerer(3),
        chosenMetamagic: ["Quickened Spell"],
        metamagicOptions: ["Quickened Spell", "Twinned Spell"],
      }),
    );
    const migrated = migrateCharacter(legacy, undefined, undefined, ALL_BOOKS);
    assert.deepEqual(migrated.chosenMetamagic, ["Quickened Spell", "Twinned Spell"]);
    assert.equal("metamagicOptions" in migrated, false);
  });
});
