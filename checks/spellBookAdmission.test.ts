import { test } from "node:test";
import assert from "node:assert/strict";
import { integratedTestCompendium } from "./testUtils.ts";
import { pickSpell, getSubclassSpells } from "../src/rules/subclassSpells.ts";
import { isSpellAvailableForClass } from "../src/rules/spellcasting.ts";
import { featOfSelection } from "../src/rules/spellGrants.ts";
import { BACKGROUND_FEAT_SOURCE } from "../src/constants/rules.ts";
import type { AsiSelection } from "../src/types/character.ts";
import type { FeatData, SpellData } from "../src/types/dnd5e.ts";

const compendium = integratedTestCompendium();
const spell = (name: string, source: string, extra: Record<string, unknown> = {}) =>
  ({ name, source, level: 1, school: "Abjuration", classes: ["Wizard"], ...extra }) as unknown as SpellData;

const phbCopy = spell("Shield", "PHB");
const srdCopy = spell("Shield", "SRD");

test("pickSpell with books PHB gives the PHB copy over the SRD copy", () => {
  assert.equal(pickSpell([srdCopy, phbCopy], ["phb"], compendium.for(["phb"])), phbCopy);
});

test("pickSpell with only XGE active and activeOnly gives the SRD copy", () => {
  assert.equal(pickSpell([phbCopy, srdCopy], ["XGE"], compendium.for(["XGE"]), true), srdCopy);
});

test("pickSpell with an empty book list and activeOnly gives the SRD copy, not the first copy", () => {
  assert.equal(pickSpell([phbCopy, srdCopy], [], compendium.for([]), true), srdCopy);
});

test("an empty book list admits SRD spells only in the spellcasting reader", () => {
  assert.equal(isSpellAvailableForClass(srdCopy, "Wizard", [], undefined, compendium), true);
  assert.equal(isSpellAvailableForClass(phbCopy, "Wizard", [], undefined, compendium), false);
});

test("getSubclassSpells with an empty book list offers no spells of a book", () => {
  const none = getSubclassSpells("Sorcerer", "Clockwork Soul", 3, { activeBooks: [], compendium });
  assert.deepEqual(none.known, []);
  assert.deepEqual(none.cantrips, []);
});

test("a feat claimed by a background resolves to the copy of a mixed-case active book", () => {
  const selection = { type: "feat", featName: "Alert", featSource: BACKGROUND_FEAT_SOURCE } as unknown as AsiSelection;
  const phb = { name: "Alert", source: "PHB" } as unknown as FeatData;
  const mixed = { name: "Alert", source: "SatO" } as unknown as FeatData;
  const resolved = featOfSelection(selection, [phb, mixed], {
    activeBooks: ["SATO"],
    listings: compendium.for(["SATO"]),
  });
  assert.equal(resolved, mixed);
});
