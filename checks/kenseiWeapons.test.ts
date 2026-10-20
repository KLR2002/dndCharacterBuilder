import test from "node:test";
import assert from "node:assert/strict";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import type { Character, InventoryItem } from "../src/types/character.ts";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { getWeaponAttacks } from "../src/rules/attacks.ts";
import { integratedTestCompendium, makeChar } from "./testUtils.ts";

/**
 * Kensei weapons (ticket 10). The Way of the Kensei monk chooses a melee and a ranged kensei weapon at 3rd
 * level, and one more weapon of either kind at 6th, 11th and 17th level. The pool is read from the
 * Compendium's item properties; a chosen weapon is proficient and counts as a Monk Weapon. Everything
 * runs against the integrated test compendium, since the Kensei is not in the SRD Baseline.
 */

const PATH = "XGE/Monk/Way of the Kensei/Path of the Kensei";
const MELEE_3 = `${PATH}@3#1`;
const RANGED_3 = `${PATH}@3#2`;
const BLADE_6 = "XGE/Monk/Way of the Kensei/One with the Blade@6#0";
const SHARPEN_11 = "XGE/Monk/Way of the Kensei/Sharpen the Blade@11#0";
const UNERRING_17 = "XGE/Monk/Way of the Kensei/Unerring Accuracy@17#0";

const names = (entries: SheetEntry[]) => entries.map((entry) => entry.name);

const monk = (level: number, extra: Partial<Character> = {}) =>
  makeChar({
    classes: [{ className: "Monk", source: "PHB", level, subclassName: "Way of the Kensei", subclassSource: "XGE" }],
    ...extra,
  });

const kenseiOffers = (character: Character): AvailableRuleChoice[] =>
  proficiencyChoiceOffers(character, { compendium: integratedTestCompendium() }).filter((offer) =>
    offer.id.startsWith("XGE/Monk/Way of the Kensei/"),
  );

test("the Kensei weapon choices unlock at 3rd, 6th, 11th and 17th level, one melee and one ranged at 3rd", () => {
  const at3 = kenseiOffers(monk(3)).map((offer) => offer.id);
  assert.ok(at3.includes(MELEE_3), "a melee kensei weapon at 3rd level");
  assert.ok(at3.includes(RANGED_3), "a ranged kensei weapon at 3rd level");
  assert.equal(kenseiOffers(monk(2)).some((offer) => offer.id.includes("Path of the Kensei")), false, "nothing at 2nd level");

  assert.equal(kenseiOffers(monk(5)).some((offer) => offer.id === BLADE_6), false, "the 6th-level choice waits for 6th level");
  assert.ok(kenseiOffers(monk(6)).some((offer) => offer.id === BLADE_6));
  assert.ok(kenseiOffers(monk(11)).some((offer) => offer.id === SHARPEN_11));
  assert.ok(kenseiOffers(monk(17)).some((offer) => offer.id === UNERRING_17));

  for (const id of [MELEE_3, RANGED_3, BLADE_6, SHARPEN_11, UNERRING_17]) {
    const offer = kenseiOffers(monk(17)).find((o) => o.id === id);
    assert.equal(offer?.pick, "proficiency", `${id} is a Proficiency Choice`);
    assert.equal(offer?.choose, 1, `${id} picks one weapon`);
    assert.equal(offer?.origin, "subclass");
  }
});

/** The option names of one Kensei choice. The offer itself must exist, so an empty pool cannot pass a check. */
const optionsOf = (character: Character, id: string): string[] => {
  const offer = kenseiOffers(character).find((o) => o.id === id);
  assert.ok(offer, `${id} is offered`);
  return offer.options.map((option) => option.name);
};

test("the melee choice offers simple and martial melee weapons without heavy or special, and no ranged ones", () => {
  const options = optionsOf(monk(3), MELEE_3);
  for (const name of ["Battleaxe", "Flail", "Longsword", "Morningstar", "Rapier", "Scimitar", "Trident", "War Pick", "Warhammer", "Whip"]) {
    assert.ok(options.includes(name), `${name} is in the pool`);
  }
  for (const name of ["Glaive", "Greataxe", "Greatsword", "Halberd", "Lance", "Maul", "Pike"]) {
    assert.equal(options.includes(name), false, `${name} is heavy or special`);
  }
  for (const name of ["Blowgun", "Hand Crossbow", "Longbow", "Heavy Crossbow"]) {
    assert.equal(options.includes(name), false, `${name} is ranged`);
  }
});

test("the ranged choice offers ranged weapons without heavy or special, plus the longbow", () => {
  const options = optionsOf(monk(3), RANGED_3);
  for (const name of ["Blowgun", "Hand Crossbow", "Longbow"]) {
    assert.ok(options.includes(name), `${name} is in the pool`);
  }
  for (const name of ["Heavy Crossbow", "Net", "Rapier", "Greatsword"]) {
    assert.equal(options.includes(name), false, `${name} is not a ranged weapon without heavy or special`);
  }
});

test("the later choices are either kind, so they offer melee and ranged weapons", () => {
  const options = optionsOf(monk(6), BLADE_6);
  assert.ok(options.includes("Rapier"), "a melee weapon");
  assert.ok(options.includes("Blowgun"), "a ranged weapon");
  assert.ok(options.includes("Longbow"), "the longbow");
  assert.equal(options.includes("Glaive"), false, "heavy weapons stay out");
});

test("the picker hides weapons the sheet already holds, by name or by category", () => {
  // A Monk holds simple weapons (a category) and shortswords (a name) from the class.
  const melee = optionsOf(monk(3), MELEE_3);
  assert.equal(melee.includes("Dagger"), false, "simple weapons are held by category");
  assert.equal(melee.includes("Shortsword"), false, "shortswords are held by name");
  const ranged = optionsOf(monk(3), RANGED_3);
  assert.equal(ranged.includes("Sling"), false, "simple ranged weapons are held by category");
});

test("a picked kensei weapon is proficient on the sheet, and a pick outside the pool is not", () => {
  const compendium = integratedTestCompendium();
  const base = monk(3);
  const offer = kenseiOffers(base).find((o) => o.id === MELEE_3);
  const picked = pickRuleChoice(base, offer!, "Rapier", compendium);
  // The sheet spells a weapon the way its weapon normalization does: Rapier is "Rapiers" there.
  assert.ok(names(proficiencySheet(picked, { compendium }).weapons).includes("Rapiers"));

  const outside = monk(3, { proficiencyPicks: { [MELEE_3]: ["Glaive"] } });
  assert.equal(names(proficiencySheet(outside, { compendium }).weapons).some((n) => /glaive/i.test(n)), false, "Glaive is heavy");
});

test("a picked kensei weapon counts as a Monk Weapon, and an unpicked heavy weapon does not", () => {
  const compendium = integratedTestCompendium();
  const equipped = (name: string): InventoryItem => ({
    id: `item_${name.replace(/\W+/g, "_")}`,
    name,
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
  });
  const character = monk(3, {
    proficiencyPicks: { [MELEE_3]: ["Rapier"], [RANGED_3]: ["Longbow"] },
    items: [equipped("Rapier"), equipped("Longbow"), equipped("Greataxe")],
  });
  const attacks = getWeaponAttacks(character, { catalogs: { compendium } });
  const monkWeapon = (name: string) => attacks.find((attack) => attack.name === name)?.isMonkWeapon;
  assert.equal(monkWeapon("Rapier"), true, "a chosen melee kensei weapon is a Monk Weapon");
  assert.equal(monkWeapon("Longbow"), true, "a chosen ranged kensei weapon is a Monk Weapon");
  assert.equal(monkWeapon("Greataxe"), false, "a heavy weapon nobody chose is not");
});

test("changing the subclass releases a kensei weapon pick through reconcile() with a notice", () => {
  const compendium = integratedTestCompendium();
  const picked = monk(3, { proficiencyPicks: { [MELEE_3]: ["Rapier"] } });
  const changed: Character = {
    ...picked,
    classes: [{ ...picked.classes[0], subclassName: "Way of the Four Elements", subclassSource: "PHB" }],
  };
  const out = reconcile(changed, compendium);
  assert.equal(out.proficiencyPicks?.[MELEE_3], undefined);
  assert.ok(out.needsReview?.some((note) => note.includes("Rapier")), "the release is recorded in needsReview");
});

test("leveling down below 6th level releases the 6th-level kensei weapon pick with a notice, and keeps the 3rd", () => {
  const compendium = integratedTestCompendium();
  const picked = monk(6, { proficiencyPicks: { [BLADE_6]: ["Longbow"], [MELEE_3]: ["Rapier"] } });
  const lowered: Character = { ...picked, classes: [{ ...picked.classes[0], level: 5 }] };
  const out = reconcile(lowered, compendium);
  assert.equal(out.proficiencyPicks?.[BLADE_6], undefined, "the 6th-level pick no longer applies");
  assert.deepEqual(out.proficiencyPicks?.[MELEE_3], ["Rapier"], "the 3rd-level pick still applies");
  assert.ok(out.needsReview?.some((note) => note.includes("Longbow")), "the release is recorded in needsReview");
});
