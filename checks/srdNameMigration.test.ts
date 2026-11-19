import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { renameSrdNames } from "../src/rules/srdNames.ts";
import type { Character, InventoryItem } from "../src/types/character.ts";
import { integratedTestCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";

function item(name: string, source: string): InventoryItem {
  return { id: `item_${name}`, name, source, quantity: 1, isEquipped: false, section: "carried" };
}

function savedWizard(overrides: Partial<Character>): Character {
  return makeChar({ classes: [{ className: "Wizard", source: "PHB", level: 5 }], ...overrides });
}

const integrated = integratedTestCompendium();

describe("Saved SRD names follow the integrated catalog's SRD names", () => {
  test("an SRD-sourced known and prepared Melf's Acid Arrow becomes Acid Arrow", () => {
    const character = savedWizard({
      knownSpells: [{ name: "Melf's Acid Arrow", source: "SRD", ownerKey: "Wizard__PHB" }],
      preparedSpells: ["Melf's Acid Arrow__SRD__Wizard__PHB"],
    });

    const renamed = renameSrdNames(character, integrated);

    assert.deepEqual(renamed.knownSpells, [{ name: "Acid Arrow", source: "SRD", ownerKey: "Wizard__PHB" }]);
    assert.deepEqual(renamed.preparedSpells, ["Acid Arrow__SRD__Wizard__PHB"]);
  });

  test("an SRD-sourced Heward's Handy Haversack in the inventory becomes Handy Haversack", () => {
    const character = savedWizard({ items: [item("Heward's Handy Haversack", "SRD")] });

    const renamed = renameSrdNames(character, integrated);

    assert.deepEqual(renamed.items.map((entry) => entry.name), ["Handy Haversack"]);
  });

  test("an SRD-sourced Leomund's Tiny Hut in the Ritual Book becomes Tiny Hut", () => {
    const character = savedWizard({
      ritualBook: [{ name: "Leomund's Tiny Hut", source: "SRD", level: 3, isStarting: false }],
    });

    const renamed = renameSrdNames(character, integrated);

    assert.deepEqual(renamed.ritualBook, [{ name: "Tiny Hut", source: "SRD", level: 3, isStarting: false }]);
  });

  test("a PHB-sourced Melf's Acid Arrow stays", () => {
    const character = savedWizard({
      knownSpells: [{ name: "Melf's Acid Arrow", source: "PHB", ownerKey: "Wizard__PHB" }],
      preparedSpells: ["Melf's Acid Arrow__PHB__Wizard__PHB"],
      items: [item("Heward's Handy Haversack", "PHB")],
    });

    const renamed = renameSrdNames(character, integrated);

    assert.equal(renamed, character);
  });

  test("a saved name with no source is left alone", () => {
    const character = savedWizard({ items: [item("Heward's Handy Haversack", "")] });

    const renamed = renameSrdNames(character, integrated);

    assert.equal(renamed, character);
  });

  test("a character with no SRD-sourced old name is returned as it is", () => {
    const character = savedWizard({ knownSpells: [{ name: "Magic Missile", source: "SRD", ownerKey: "Wizard__PHB" }] });

    assert.equal(renameSrdNames(character, integrated), character);
  });

  test("with the SRD Baseline, nothing changes", () => {
    const character = savedWizard({
      knownSpells: [{ name: "Melf's Acid Arrow", source: "SRD", ownerKey: "Wizard__PHB" }],
      preparedSpells: ["Melf's Acid Arrow__SRD__Wizard__PHB"],
      items: [item("Heward's Handy Haversack", "SRD")],
      ritualBook: [{ name: "Leomund's Tiny Hut", source: "SRD", level: 3 }],
    });

    assert.equal(renameSrdNames(character, srdBaselineCompendium()), character);
  });
});
