import test from "node:test";
import assert from "node:assert/strict";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import type { Character, InventoryItem } from "../src/types/character.ts";
import type { ItemData } from "../src/types/dnd5e.ts";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { getWeaponAttacks } from "../src/rules/attacks.ts";
import { kenseiWeaponNames } from "../src/rules/kenseiWeapons.ts";
import { poolNames, type ChoiceProficiencyGrant } from "../src/rules/proficiencyPools.ts";
import { fixedGrant, placeholderFeat } from "./proficiencySheetFixture.ts";
import {
  inMemoryCompendium,
  integratedTestCompendium,
  integratedTestCompendiumWithItems,
  loadSrdCatalog,
  makeChar,
} from "./testUtils.ts";

/**
 * Kensei weapons. The Way of the Kensei monk chooses a melee and a ranged kensei weapon at 3rd
 * level, and one more weapon of either kind at 6th, 11th and 17th level. The pool is read from the
 * Compendium's item properties; a chosen weapon is proficient and counts as a Monk Weapon. Everything
 * runs against the integrated test compendium, since the Kensei is not in the SRD Baseline.
 */

const PATH = "XGE/Monk/Way of the Kensei/Path of the Kensei";
// The weapon pool's grant ids: the base types, excluded properties, extra weapon and attack type the choice names.
const WEAPON_POOL = "weapons:choice:base=martial,simple;without=heavy,special;plus=longbow;attack=";
const MELEE_3 = `${PATH}@3#${WEAPON_POOL}melee`;
const RANGED_3 = `${PATH}@3#${WEAPON_POOL}ranged`;
const BLADE_6 = `XGE/Monk/Way of the Kensei/One with the Blade@6#${WEAPON_POOL}any`;
const SHARPEN_11 = `XGE/Monk/Way of the Kensei/Sharpen the Blade@11#${WEAPON_POOL}any`;
const UNERRING_17 = `XGE/Monk/Way of the Kensei/Unerring Accuracy@17#${WEAPON_POOL}any`;

const names = (entries: SheetEntry[]) => entries.map((entry) => entry.name);

const monk = (level: number, extra: Partial<Character> = {}) =>
  makeChar({
    classes: [{ className: "Monk", source: "PHB", level, subclassName: "Way of the Kensei", subclassSource: "XGE" }],
    ...extra,
  });

/** A Fighter 1 who multiclasses into a Way of the Kensei Monk. The Fighter's class gives both weapon categories. */
const fighterMonk = (monkLevel: number, extra: Partial<Character> = {}) =>
  makeChar({
    classes: [
      { className: "Fighter", source: "PHB", level: 1 },
      { className: "Monk", source: "PHB", level: monkLevel, subclassName: "Way of the Kensei", subclassSource: "XGE" },
    ],
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

test("the kensei picker shows weapons the sheet already holds, because a kensei weapon is also a Monk Weapon", () => {
  // A Monk holds simple weapons (a category) and shortswords (a name) from the class. The pick still
  // makes a Monk Weapon of a weapon it already holds, so the held ones stay on the list.
  const melee = optionsOf(monk(3), MELEE_3);
  assert.ok(melee.includes("Dagger"), "simple weapons held by category are offered");
  assert.ok(melee.includes("Shortsword"), "shortswords held by name are offered");
  const ranged = optionsOf(monk(3), RANGED_3);
  assert.ok(ranged.includes("Sling"), "simple ranged weapons held by category are offered");
});

test("a Fighter 1 / Way of the Kensei Monk 3 is offered every kensei weapon, including the ones the Fighter already holds", () => {
  const character = fighterMonk(3);
  const compendium = integratedTestCompendium();
  // The precondition: the Fighter holds both weapon categories, so every pool candidate counts as held.
  assert.deepEqual(
    names(proficiencySheet(character, { compendium }).weapons).sort(),
    ["Martial weapons", "Simple weapons"],
  );

  const melee = optionsOf(character, MELEE_3);
  assert.ok(melee.length > 0, "the melee kensei choice is not empty");
  assert.ok(melee.includes("Longsword"), "a martial melee weapon the Fighter holds is offered");
  assert.ok(melee.includes("Dagger"), "a simple melee weapon the Fighter holds is offered");

  const ranged = optionsOf(character, RANGED_3);
  assert.ok(ranged.length > 0, "the ranged kensei choice is not empty");
  assert.ok(ranged.includes("Longbow"), "a martial ranged weapon the Fighter holds is offered");
  assert.ok(ranged.includes("Sling"), "a simple ranged weapon the Fighter holds is offered");
});

test("picking a held kensei weapon records it, keeps it a Monk Weapon, and adds no duplicate sheet row", () => {
  const compendium = integratedTestCompendium();
  const character = fighterMonk(3);
  const offer = kenseiOffers(character).find((o) => o.id === MELEE_3);
  assert.ok(offer, "the melee kensei choice is offered");
  assert.ok(offer.options.some((option) => option.name === "Rapier"), "Rapier is on the list the player picks from");

  const picked = pickRuleChoice(character, offer, "Rapier", compendium);
  assert.deepEqual(picked.proficiencyPicks?.[MELEE_3], ["Rapier"], "the pick is recorded under the grant id");
  assert.deepEqual(kenseiWeaponNames(picked, { compendium }), ["Rapier"], "the pick is a kensei weapon");

  // The Fighter's Martial weapons already cover Rapier, so the sheet shows no row of its own for it.
  const sheetNames = names(proficiencySheet(picked, { compendium }).weapons);
  assert.equal(sheetNames.filter((name) => /rapier/i.test(name)).length, 0, "no Rapier row on the sheet");
  assert.equal(sheetNames.filter((name) => name === "Martial weapons").length, 1, "one Martial weapons row");

  const equipped: InventoryItem = {
    id: "item_rapier",
    name: "Rapier",
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
  };
  const attacks = getWeaponAttacks({ ...picked, items: [equipped] }, { catalogs: { compendium } });
  assert.equal(attacks.find((attack) => attack.name === "Rapier")?.isMonkWeapon, true, "a held kensei weapon is a Monk Weapon");
});

test("a feat's weapon choice still hides the weapons the sheet already holds", () => {
  // Invented feats: one holds Dagger by a fixed grant, the other offers a simple melee weapon pick.
  const CLUB_CHOICE = "FIX/Club Drill/melee";
  const compendium = inMemoryCompendium({
    items: loadSrdCatalog<ItemData[]>("items"),
    feats: [
      placeholderFeat({ name: "Dagger Drill", grants: [fixedGrant("FIX/Dagger Drill", "weapons", ["Dagger"])] }),
      placeholderFeat({
        name: "Club Drill",
        grants: [
          {
            id: CLUB_CHOICE,
            kind: "choice",
            category: "weapons",
            count: 1,
            pool: { kind: "weapons", base: ["simple"], withoutProperties: [], plus: [], attackType: "melee" },
          },
        ],
      }),
    ],
  });
  const character = makeChar({
    asiSelections: [
      { level: 4, type: "feat", featName: "Dagger Drill", featSource: "PHB" },
      { level: 8, type: "feat", featName: "Club Drill", featSource: "PHB" },
    ],
  });
  const offer = proficiencyChoiceOffers(character, { compendium }).find((o) => o.id === CLUB_CHOICE);
  assert.ok(offer, "the feat's weapon choice is offered");
  const options = offer.options.map((option) => option.name);
  assert.ok(options.includes("Club"), "an unheld simple melee weapon is offered");
  assert.equal(options.includes("Dagger"), false, "Dagger is held by the other feat, so it is hidden");
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

test("firearms are kensei weapons too: a martial ranged firearm without heavy or special is in the ranged pool", () => {
  // The rule is the category, the properties and the attack type only, so the Dungeon Master's Guide's
  // martial firearms qualify. None of them is in the melee pool.
  const ranged = optionsOf(monk(3), RANGED_3);
  for (const name of ["Pistol", "Musket", "Shotgun", "Laser Pistol"]) {
    assert.ok(ranged.includes(name), `${name} is in the ranged pool`);
  }
  assert.equal(optionsOf(monk(3), MELEE_3).includes("Pistol"), false, "a firearm is not a melee weapon");
});

test("weapons from other books are offered by their category: a melee and a simple ranged one from the Compendium", () => {
  // Hooked Shortspear (Out of the Abyss, martial, light) and Light Repeating Crossbow (simple, ranged) are not in
  // the SRD Baseline. The integrated Compendium carries their category, so the pools offer them.
  assert.ok(optionsOf(monk(3), MELEE_3).includes("Hooked Shortspear"), "a martial melee weapon from another book");
  assert.ok(optionsOf(monk(3), RANGED_3).includes("Light Repeating Crossbow"), "a simple ranged weapon from another book");
});

/** An invented weapon from an invented book, shaped as the scraped items are. */
const inventedWeapon = (overrides: Partial<ItemData>): ItemData => ({
  name: "Invented Blade",
  source: "OTB",
  type: "Melee Weapon",
  itemCategory: "Weapon",
  rarity: "None",
  attunement: false,
  cost: null,
  weight: 2,
  damage: "1d6",
  damageType: "slashing",
  range: null,
  properties: [],
  ac: null,
  strengthRequirement: null,
  stealthDisadvantage: false,
  description: "",
  ...overrides,
});

/** The option names of one Kensei choice, over an invented item list in place of the Compendium's items. */
const kenseiOptionsWith = (items: ItemData[], id: string): string[] => {
  const offer = proficiencyChoiceOffers(monk(3), { compendium: integratedTestCompendiumWithItems(items) }).find((o) => o.id === id);
  assert.ok(offer, `${id} is offered`);
  return offer.options.map((option) => option.name);
};

test("a simple or martial weapon from another book is offered when its category is in the Compendium", () => {
  const items = [
    inventedWeapon({ name: "Verdant Slicer", weaponCategory: "martial", properties: ["Finesse"] }),
    inventedWeapon({ name: "Brightsling", type: "Ranged Weapon", weaponCategory: "simple", range: "30/120" }),
  ];
  assert.ok(kenseiOptionsWith(items, MELEE_3).includes("Verdant Slicer"), "a martial melee weapon from another book");
  assert.ok(kenseiOptionsWith(items, RANGED_3).includes("Brightsling"), "a simple ranged weapon from another book");
  assert.equal(kenseiOptionsWith(items, RANGED_3).includes("Verdant Slicer"), false, "a melee weapon is not ranged");
});

test("a weapon from another book with the heavy or special property is not offered", () => {
  const items = [
    inventedWeapon({ name: "Verdant Maul", weaponCategory: "martial", properties: ["Heavy", "Two-Handed"] }),
    inventedWeapon({ name: "Verdant Net", weaponCategory: "martial", properties: ["Special"] }),
  ];
  const options = kenseiOptionsWith(items, MELEE_3);
  assert.equal(options.includes("Verdant Maul"), false, "heavy");
  assert.equal(options.includes("Verdant Net"), false, "special");
});

test("a magic weapon without a base category is never offered, although it sits beside its base weapon", () => {
  const items = [
    inventedWeapon({ name: "Verdant Slicer", weaponCategory: "martial", properties: ["Finesse"] }),
    inventedWeapon({ name: "Verdant Slicer, +1", rarity: "Uncommon", bonusWeapon: 1 }),
  ];
  const options = kenseiOptionsWith(items, MELEE_3);
  assert.ok(options.includes("Verdant Slicer"));
  assert.equal(options.includes("Verdant Slicer, +1"), false, "a magic variant is not a base weapon");
});

test("a standard weapon name is not enough: without its category in the Compendium it is not offered", () => {
  const items = [inventedWeapon({ name: "Longsword", source: "PHB", properties: [] })];
  assert.equal(kenseiOptionsWith(items, MELEE_3).includes("Longsword"), false);
});

test("the SRD Baseline's items give the Kensei options the standard lists gave", () => {
  const grant = (attackType: "melee" | "ranged"): ChoiceProficiencyGrant => ({
    id: MELEE_3,
    kind: "choice",
    category: "weapons",
    count: 1,
    pool: { kind: "weapons", base: ["simple", "martial"], withoutProperties: ["heavy", "special"], plus: ["longbow"], attackType },
  });
  const srdItems = loadSrdCatalog<ItemData[]>("items");
  assert.deepEqual(poolNames(grant("melee"), srdItems), [
    "Battleaxe", "Club", "Dagger", "Flail", "Greatclub", "Handaxe", "Javelin", "Light Hammer", "Longsword", "Mace",
    "Morningstar", "Quarterstaff", "Rapier", "Scimitar", "Shortsword", "Sickle", "Spear", "Trident", "War Pick", "Warhammer", "Whip",
  ]);
  assert.deepEqual(poolNames(grant("ranged"), srdItems), [
    "Blowgun", "Dart", "Hand Crossbow", "Light Crossbow", "Longbow", "Shortbow", "Sling",
  ]);
});
