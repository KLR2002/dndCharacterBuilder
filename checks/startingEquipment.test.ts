import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, inMemoryCompendium, srdBaselineCompendium } from "./testUtils.ts";
import {
  hasStartingEquipmentChoices,
  pruneStartingEquipmentPicks,
  resolveStartingEquipment,
  setStartingEquipmentItems,
  setStartingEquipmentOption,
  startingEquipmentCard,
  startingEquipmentOffers,
  startingEquipmentPool,
  type StartingEquipmentAddress,
} from "../src/rules/startingEquipment.ts";
import { applyStartingGrants, reclaimStartingGrants } from "../src/rules/builderTransitions.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import type { Character } from "../src/types/character.ts";
import type {
  ClassData,
  ItemData,
  StartingEquipmentEntry,
  StartingEquipmentSlot,
} from "../src/types/dnd5e.ts";

// Every name in this file is invented, except the SRD Baseline tests, which read the Fighter, the Cleric and the Druid.

const SRC = "TST";
const FERRY = "Ferryman";

function item(name: string, type: string, weaponCategory?: "simple" | "martial", source = SRC): ItemData {
  return {
    name,
    source,
    type,
    itemCategory: type,
    rarity: "None",
    attunement: false,
    cost: null,
    weight: null,
    damage: null,
    damageType: null,
    range: null,
    properties: [],
    ac: null,
    strengthRequirement: null,
    stealthDisadvantage: false,
    description: "",
    ...(weaponCategory ? { weaponCategory } : {}),
  };
}

const ITEMS: ItemData[] = [
  item("Tallow Lamp", "Adventuring Gear"),
  item("Reed Pack", "Adventuring Gear"),
  item("Quill Knife", "Melee Weapon", "simple"),
  item("Quill Knife", "Melee Weapon", "simple", "ALT"),
  item("Hand Sling", "Ranged Weapon", "simple"),
  item("Oarblade", "Melee Weapon", "martial"),
  item("Brine Mail", "Heavy Armor"),
  item("Gull Shield", "Shield"),
  item("Brass Fiddle", "Instrument"),
  item("Tidestone", "Spellcasting Focus"),
  item("Amulet", "Spellcasting Focus"),
];

const pick = (name: string, quantity = 1): StartingEquipmentEntry => ({ kind: "item", name, source: SRC, quantity });
const generic = (equipmentType: string, quantity = 1): StartingEquipmentEntry => ({ kind: "type", equipmentType, quantity });
const fixed = (...entries: StartingEquipmentEntry[]): StartingEquipmentSlot => ({ kind: "fixed", entries });
const choice = (...options: [string, StartingEquipmentEntry[]][]): StartingEquipmentSlot => ({
  kind: "choice",
  options: options.map(([letter, entries]) => ({ letter, entries })),
});

function invented(name: string, slots: StartingEquipmentSlot[] | undefined, source = SRC): ClassData {
  return {
    name,
    source,
    hitDie: "d8",
    description: "",
    primaryAbility: [],
    savingThrows: [],
    armorProficiencies: ["light", "shield"],
    weaponProficiencies: ["simple"],
    toolProficiencies: [],
    skillProficiencies: { choose: 0, from: [] },
    spellcasting: null,
    features: [],
    subclasses: [],
    ...(slots ? { startingEquipment: slots } : {}),
  };
}

// Slot 0: a melee option (a) or a martial one (b). Slot 1: a single item (a) or two items and a musical instrument (b).
// Slot 2 (fixed): two simple weapons of the player's choice and a focus. Slot 3: heavy armor (a) or a shield and a pack (b).
const FERRY_SLOTS: StartingEquipmentSlot[] = [
  choice(["a", [pick("Quill Knife")]], ["b", [pick("Oarblade")]]),
  choice(["a", [pick("Reed Pack")]], ["b", [pick("Tallow Lamp", 2), generic("instrumentMusical")]]),
  fixed(generic("weaponSimple", 2), pick("Tidestone")),
  choice(["a", [pick("Brine Mail")]], ["b", [pick("Gull Shield"), pick("Reed Pack")]]),
];

const ferryClass = invented(FERRY, FERRY_SLOTS);
const chartmaker = invented("Chartmaker", [fixed(pick("Sea Chart", 1), pick("Tallow Lamp"))]);
const drifter = invented("Drifter", undefined);

const compendium = inMemoryCompendium({ classes: [ferryClass, chartmaker, drifter], items: ITEMS });
const catalogs = { compendium, activeBooks: ALL_BOOKS };

const ferry = (overrides: Partial<Character> = {}): Character =>
  makeChar({ classes: [{ className: FERRY, source: SRC, level: 1 }], ...overrides });

/**
 * The Ferryman with every slot picked: the given option of slot 0, b of slot 1 with a Brass Fiddle, the given simple
 * weapon names for the fixed slot's generic entry, and b of slot 3.
 */
function pickedFerry(base: Character = ferry(), zero = "a", simple = ["Quill Knife", "Hand Sling"]): Character {
  let c = setStartingEquipmentOption(base, 0, zero, catalogs);
  c = setStartingEquipmentOption(c, 1, "b", catalogs);
  c = setStartingEquipmentItems(c, { slot: 1, option: "b", entry: 1 }, ["Brass Fiddle"], catalogs);
  c = setStartingEquipmentItems(c, { slot: 2, option: null, entry: 0 }, simple, catalogs);
  c = setStartingEquipmentOption(c, 3, "b", catalogs);
  return c;
}

const summary = (items: { id: string; name: string; quantity: number; isEquipped: boolean; section: string }[]) =>
  items.map((i) => [i.id, i.name, i.quantity, i.isEquipped, i.section]);

test("a claim grants the fixed items and the picked option of each slot, and never an item of the unpicked option", () => {
  const kit = resolveStartingEquipment(pickedFerry(), catalogs);
  assert.equal(kit.hasSlots, true);
  assert.equal(kit.complete, true);
  assert.deepEqual(summary(kit.items), [
    ["start_ferryman_0", "Quill Knife", 1, true, "equipped"],
    ["start_ferryman_1", "Tallow Lamp", 2, false, "carried"],
    ["start_ferryman_2", "Brass Fiddle", 1, false, "carried"],
    ["start_ferryman_3", "Quill Knife", 1, true, "equipped"],
    ["start_ferryman_4", "Hand Sling", 1, false, "carried"],
    ["start_ferryman_5", "Tidestone", 1, false, "carried"],
    ["start_ferryman_6", "Gull Shield", 1, true, "equipped"],
    ["start_ferryman_7", "Reed Pack", 1, false, "carried"],
  ]);
  assert.equal(kit.items.some((i) => i.name === "Oarblade" || i.name === "Brine Mail"), false, "the unpicked options grant nothing");
});

test("picks are incomplete until each slot has an offered option and each generic entry has its quantity of names", () => {
  assert.deepEqual(resolveStartingEquipment(ferry(), catalogs), { hasSlots: true, complete: false, items: [] });

  const onlySlotZero = setStartingEquipmentOption(ferry(), 0, "a", catalogs);
  assert.equal(resolveStartingEquipment(onlySlotZero, catalogs).complete, false);

  // Everything is picked but the quantity-2 generic entry holds one name only.
  const kit = resolveStartingEquipment(pickedFerry(ferry(), "a", ["Quill Knife"]), catalogs);
  assert.equal(kit.complete, false, "a quantity-2 slot needs two picks");
  assert.deepEqual(kit.items, []);
});

test("a generic entry is resolved to catalog items of its type, each name once, and a name may be picked twice", () => {
  assert.deepEqual(startingEquipmentPool("weaponSimple", catalogs), ["Hand Sling", "Quill Knife"]);
  assert.deepEqual(startingEquipmentPool("weaponMartial", catalogs), ["Oarblade"]);
  assert.deepEqual(startingEquipmentPool("weaponSimpleMelee", catalogs), ["Quill Knife"]);
  assert.deepEqual(startingEquipmentPool("weaponMartialMelee", catalogs), ["Oarblade"]);
  assert.deepEqual(startingEquipmentPool("instrumentMusical", catalogs), ["Brass Fiddle"]);
  assert.deepEqual(startingEquipmentPool("focusSpellcastingHoly", catalogs), ["Amulet"], "Tidestone names no kind");
  assert.deepEqual(startingEquipmentPool("notAType", catalogs), []);

  const twice = pickedFerry(ferry(), "a", ["Hand Sling", "Hand Sling"]);
  assert.equal(resolveStartingEquipment(twice, catalogs).complete, true, "the same item may be picked for both names");
});

test("the pool reads only the active books", () => {
  const integrated = inMemoryCompendium({ items: ITEMS }, { integrated: true });
  assert.deepEqual(startingEquipmentPool("weaponMartial", { compendium: integrated, activeBooks: ["TST"] }), ["Oarblade"]);
  assert.deepEqual(startingEquipmentPool("weaponMartial", { compendium: integrated, activeBooks: ["OTHER"] }), []);
});

test("an option is offered only when the character is proficient with every armor and weapon it names", () => {
  // Ferryman: light armor, shields, simple weapons. Oarblade (martial) and Brine Mail (heavy) are hidden.
  assert.deepEqual(startingEquipmentOffers(ferry(), catalogs), [
    { slot: 0, options: ["a"] },
    { slot: 1, options: ["a", "b"] },
    { slot: 3, options: ["b"] },
  ]);

  const martial = ferry({ multiclassProficiencies: [{ className: FERRY, weapons: ["Martial weapons"] }] });
  assert.deepEqual(startingEquipmentOffers(martial, catalogs)[0], { slot: 0, options: ["a", "b"] });

  const heavy = ferry({ multiclassProficiencies: [{ className: FERRY, armor: ["Heavy armor"] }] });
  assert.deepEqual(startingEquipmentOffers(heavy, catalogs)[2], { slot: 3, options: ["a", "b"] });
});

test("a pick whose option stops being offered counts as unpicked", () => {
  const martial = ferry({ multiclassProficiencies: [{ className: FERRY, weapons: ["Martial weapons"] }] });
  const full = pickedFerry(martial, "b");
  assert.equal(resolveStartingEquipment(full, catalogs).complete, true, "the martial pick is complete while the proficiency holds");

  const lostProficiency = { ...full, multiclassProficiencies: undefined };
  assert.equal(resolveStartingEquipment(lostProficiency, catalogs).complete, false, "the pick is unpicked once its option is hidden");
});

test("setters refuse an option the slot does not offer and a name outside the pool", () => {
  const base = ferry();
  assert.equal(setStartingEquipmentOption(base, 0, "z", catalogs), base);
  assert.equal(setStartingEquipmentOption(base, 0, "b", catalogs), base, "the martial option is hidden without martial weapons");
  assert.equal(setStartingEquipmentOption(base, 9, "a", catalogs), base);

  const withOption = setStartingEquipmentOption(base, 2, "a", catalogs);
  assert.equal(setStartingEquipmentItems(withOption, { slot: 2, option: null, entry: 0 }, ["Oarblade"], catalogs), withOption);
});

test("the equipment rule equips melee weapons, the first body armor and the first shield; the rest is carried", () => {
  const kit = resolveStartingEquipment(pickedFerry(), catalogs);
  const equipped = kit.items.filter((i) => i.isEquipped).map((i) => i.name);
  assert.deepEqual(equipped, ["Quill Knife", "Quill Knife", "Gull Shield"]);
  assert.ok(kit.items.filter((i) => !i.isEquipped).every((i) => i.section === "carried"));
});

test("an item the catalog does not know is granted by its printed name and source", () => {
  const kit = resolveStartingEquipment(
    makeChar({ classes: [{ className: "Chartmaker", source: SRC, level: 1 }] }),
    catalogs,
  );
  assert.equal(kit.complete, true);
  assert.deepEqual(summary(kit.items), [
    ["start_chartmaker_0", "Sea Chart", 1, false, "carried"],
    ["start_chartmaker_1", "Tallow Lamp", 1, false, "carried"],
  ]);
  assert.equal(kit.items[0].source, SRC);
});

test("a claim, a changed pick and a re-claim leave no stale start_ items", () => {
  const claimed = applyStartingGrants(pickedFerry(), "equipment", { catalogs });
  assert.ok(claimed.items.some((i) => i.name === "Brass Fiddle"));
  assert.equal(applyStartingGrants(claimed, "equipment", { catalogs }), claimed, "the same kit is already in place");

  const changed = setStartingEquipmentOption(claimed, 1, "a", catalogs);
  const reclaimed = applyStartingGrants(changed, "equipment", { catalogs });
  assert.equal(reclaimed.startingOption, "equipment");
  assert.equal(reclaimed.items.some((i) => i.name === "Brass Fiddle" || i.name === "Tallow Lamp"), false, "the old option's items are gone");
  assert.ok(reclaimed.items.some((i) => i.name === "Reed Pack" && i.id === "start_ferryman_1"));
  assert.equal(reclaimed.items.filter((i) => i.id.startsWith("start_")).length, 7, "only the new kit's start_ items");
});

test("incomplete picks grant no kit: the claim and the re-claim return the character unchanged", () => {
  const partial = setStartingEquipmentOption(ferry(), 0, "a", catalogs);
  assert.equal(applyStartingGrants(partial, "equipment", { catalogs }), partial);
  assert.equal(reclaimStartingGrants(partial, "equipment", { catalogs }), partial);
  assert.equal(partial.startingGrantsApplied, undefined);
});

test("a class change clears the picks", () => {
  const picked = pickedFerry();
  const changed = { ...picked, classes: [{ className: "Chartmaker", source: SRC, level: 1 }] };
  assert.deepEqual(resolveStartingEquipment(changed, catalogs).items.map((i) => i.name), ["Sea Chart", "Tallow Lamp"],
    "the Ferryman's picks are not read for the Chartmaker");
  assert.equal(pruneStartingEquipmentPicks(changed).startingEquipmentPicks, undefined);
  assert.equal(reconcile(changed, compendium, { activeBooks: ALL_BOOKS }).startingEquipmentPicks, undefined, "the reconciler drops them");
});

test("an old save without the picks field loads, and equipment cannot be claimed until picks are made", () => {
  // A saved record with every field but the picks, which an older build never wrote.
  const raw = ferry({ startingOption: "equipment", startingGrantsApplied: true });
  delete raw.startingEquipmentPicks;
  const migrated = migrateCharacter(raw, undefined, [ferryClass], ALL_BOOKS);
  assert.equal(migrated.startingEquipmentPicks, undefined);
  assert.equal(resolveStartingEquipment(migrated, catalogs).complete, false);
  assert.equal(applyStartingGrants(migrated, "equipment", { catalogs }), migrated);
});

test("a class with no slots cannot claim equipment and can still take gold", () => {
  const plain = makeChar({ classes: [{ className: "Drifter", source: SRC, level: 1 }] });
  assert.equal(hasStartingEquipmentChoices(plain, catalogs), false);
  assert.deepEqual(resolveStartingEquipment(plain, catalogs), { hasSlots: false, complete: false, items: [] });
  assert.equal(applyStartingGrants(plain, "equipment", { catalogs }), plain);

  const gold = applyStartingGrants(plain, "gold", { goldAmount: 10, catalogs });
  assert.equal(gold.pouch.gp, 10);
});

test("the print the class entry names is used, otherwise the first print with slots", () => {
  const plainPrint = invented(FERRY, undefined, "ALT");
  const both = inMemoryCompendium({ classes: [ferryClass, plainPrint], items: ITEMS });
  const bothCatalogs = { compendium: both, activeBooks: ALL_BOOKS };
  assert.equal(hasStartingEquipmentChoices(makeChar({ classes: [{ className: FERRY, source: "ALT", level: 1 }] }), bothCatalogs), false);
  assert.equal(hasStartingEquipmentChoices(makeChar({ classes: [{ className: FERRY, source: SRC, level: 1 }] }), bothCatalogs), true);
  assert.equal(hasStartingEquipmentChoices(makeChar({ classes: [{ className: FERRY, source: "NONE", level: 1 }] }), bothCatalogs), true);
});

test("the SRD Baseline Fighter prints chain mail or leather armor, longbow and arrows, never both", () => {
  const srd = srdBaselineCompendium();
  const srdCatalogs = { compendium: srd, activeBooks: ALL_BOOKS };
  const fighter = srd.for().classes().find((c) => c.name === "Fighter");
  if (!fighter?.startingEquipment) throw new Error("the Fighter carries no starting equipment slots");
  const fighterChar = makeChar({ classes: [{ className: "Fighter", source: fighter.source, level: 1 }] });
  assert.deepEqual(startingEquipmentOffers(fighterChar, srdCatalogs)[0], { slot: 0, options: ["a", "b"] });

  const armorAndBow = (letter: "a" | "b") => {
    let c = setStartingEquipmentOption(fighterChar, 0, letter, srdCatalogs);
    c = setStartingEquipmentOption(c, 1, "a", srdCatalogs);
    c = setStartingEquipmentItems(c, { slot: 1, option: "a", entry: 0 }, ["Longsword"], srdCatalogs);
    c = setStartingEquipmentOption(c, 2, "a", srdCatalogs);
    c = setStartingEquipmentOption(c, 3, "a", srdCatalogs);
    return resolveStartingEquipment(c, srdCatalogs).items.map((i) => i.name);
  };
  const chainKit = armorAndBow("a");
  assert.ok(chainKit.includes("Chain Mail"));
  assert.equal(chainKit.includes("Leather Armor") || chainKit.includes("Longbow"), false);

  let bowKit = setStartingEquipmentOption(fighterChar, 0, "b", srdCatalogs);
  bowKit = setStartingEquipmentOption(bowKit, 1, "b", srdCatalogs);
  bowKit = setStartingEquipmentItems(bowKit, { slot: 1, option: "b", entry: 0 }, ["Longsword", "Shortsword"], srdCatalogs);
  bowKit = setStartingEquipmentOption(bowKit, 2, "b", srdCatalogs);
  bowKit = setStartingEquipmentOption(bowKit, 3, "b", srdCatalogs);
  const names = resolveStartingEquipment(bowKit, srdCatalogs).items.map((i) => i.name);
  assert.ok(names.includes("Leather Armor") && names.includes("Longbow"));
  assert.equal(names.includes("Chain Mail"), false);
});

test("the SRD Baseline Cleric is offered chain mail and the warhammer only with the domain or martial weapons that grant them", () => {
  const srd = srdBaselineCompendium();
  const srdCatalogs = { compendium: srd, activeBooks: ALL_BOOKS };
  const cleric = (subclassName?: string) =>
    makeChar({
      classes: [{ className: "Cleric", source: "SRD", level: 1, ...(subclassName ? { subclassName, subclassSource: "SRD" } : {}) }],
    });

  assert.deepEqual(startingEquipmentOffers(cleric(), srdCatalogs), [
    { slot: 0, options: ["a"] },
    { slot: 1, options: ["a", "b"] },
    { slot: 2, options: ["a", "b"] },
    { slot: 3, options: ["a", "b"] },
  ]);
  assert.deepEqual(startingEquipmentOffers(cleric("Life Domain"), srdCatalogs)[1], { slot: 1, options: ["a", "b", "c"] },
    "the Life Domain's Bonus Proficiency gives heavy armor, so chain mail is offered");
});

test("the SRD Baseline Druid is offered the shield, whose sheet name carries the printed druid restriction", () => {
  const srd = srdBaselineCompendium();
  const druid = makeChar({ classes: [{ className: "Druid", source: "SRD", level: 1 }] });
  assert.deepEqual(startingEquipmentOffers(druid, { compendium: srd, activeBooks: ALL_BOOKS })[0], { slot: 0, options: ["a", "b"] });
});

test("across the SRD Baseline classes with only their own proficiencies, the hidden options are the Cleric's warhammer and chain mail", () => {
  const srd = srdBaselineCompendium();
  const srdCatalogs = { compendium: srd, activeBooks: ALL_BOOKS };
  const hidden: string[] = [];
  const withSlots = srd.for().classes().filter((c) => (c.startingEquipment?.length ?? 0) > 0);
  assert.equal(withSlots.length, 12, "the twelve PHB classes carry slots");
  for (const cls of withSlots) {
    const offers = startingEquipmentOffers(makeChar({ classes: [{ className: cls.name, source: cls.source, level: 1 }] }), srdCatalogs);
    for (const [index, slot] of (cls.startingEquipment ?? []).entries()) {
      if (slot.kind !== "choice") continue;
      const offered = offers.find((o) => o.slot === index)?.options ?? [];
      for (const option of slot.options) {
        if (!offered.includes(option.letter)) {
          const names = option.entries.map((e) => (e.kind === "item" ? e.name : e.kind === "type" ? e.equipmentType : "?"));
          hidden.push(`${cls.name} slot ${index} option ${option.letter}: ${names.join(", ")}`);
        }
      }
    }
  }
  assert.deepEqual(hidden, [
    "Cleric slot 0 option b: warhammer",
    "Cleric slot 1 option c: chain mail",
  ]);
});

test("the SRD Baseline focus types each offer only their kind's focus items, and the three pools share no name", () => {
  const srd = srdBaselineCompendium();
  const srdCatalogs = { compendium: srd, activeBooks: ALL_BOOKS };
  const arcane = ["Crystal", "Orb", "Rod", "Staff", "Wand"];
  const holy = ["Amulet", "Emblem", "Reliquary"];
  const druidic = ["Sprig of Mistletoe", "Totem", "Wooden Staff", "Yew Wand"];

  assert.deepEqual(startingEquipmentPool("focusSpellcastingArcane", srdCatalogs), arcane);
  assert.deepEqual(startingEquipmentPool("focusSpellcastingHoly", srdCatalogs), holy);
  assert.deepEqual(startingEquipmentPool("focusSpellcastingDruidic", srdCatalogs), druidic);

  const all = [...arcane, ...holy, ...druidic];
  assert.equal(new Set(all).size, all.length, "no focus item serves two kinds");
});

test("the card lists a fixed slot's entries, and each choice slot's offered options only", () => {
  const card = startingEquipmentCard(ferry(), catalogs);
  assert.equal(card.hasSlots, true);
  assert.equal(card.complete, false);
  assert.deepEqual(
    card.slots.map((slot) => {
      if (slot.kind === "choice") return ["choice", slot.slot, slot.options.map((o) => o.letter)];
      if (slot.kind === "unrecognised") return ["unrecognised", slot.slot];
      const names = slot.entries.map((e) => (e.kind === "item" ? e.name : e.kind === "type" ? e.equipmentType : "?"));
      return ["fixed", slot.slot, names];
    }),
    [
      ["choice", 0, ["a"]],
      ["choice", 1, ["a", "b"]],
      ["fixed", 2, ["weaponSimple", "Tidestone"]],
      ["choice", 3, ["b"]],
    ],
    "the martial option of slot 0 and the heavy armor of slot 3 are not shown",
  );
});

test("the card marks the picked option and gives each generic entry its picks and its pool", () => {
  let c = setStartingEquipmentOption(ferry(), 1, "b", catalogs);
  c = setStartingEquipmentItems(c, { slot: 1, option: "b", entry: 1 }, ["Brass Fiddle"], catalogs);
  const card = startingEquipmentCard(c, catalogs);

  const slot1 = card.slots[1];
  assert.equal(slot1.kind, "choice");
  if (slot1.kind !== "choice") return;
  assert.deepEqual(slot1.options.map((o) => [o.letter, o.chosen]), [["a", false], ["b", true]]);
  const generic = slot1.options[1].entries[1];
  assert.equal(generic.kind, "type");
  if (generic.kind !== "type") return;
  assert.deepEqual([generic.quantity, generic.picks, generic.pool], [1, ["Brass Fiddle"], ["Brass Fiddle"]]);

  const fixedEntry = card.slots[2];
  assert.equal(fixedEntry.kind, "fixed");
  if (fixedEntry.kind !== "fixed") return;
  const simple = fixedEntry.entries[0];
  assert.equal(simple.kind, "type");
  if (simple.kind !== "type") return;
  assert.deepEqual([simple.quantity, simple.picks, simple.pool], [2, [], ["Hand Sling", "Quill Knife"]]);
});

test("the card's complete flag is the claim's: true only when every slot and quantity is picked", () => {
  assert.equal(startingEquipmentCard(pickedFerry(), catalogs).complete, true);
  assert.equal(startingEquipmentCard(pickedFerry(ferry(), "a", ["Quill Knife"]), catalogs).complete, false);
  assert.equal(startingEquipmentCard(ferry(), catalogs).complete, false);
});

test("the card of a class with no slots has no slots and is never complete", () => {
  const card = startingEquipmentCard(makeChar({ classes: [{ className: "Drifter", source: SRC, level: 1 }] }), catalogs);
  assert.deepEqual(card, { hasSlots: false, complete: false, slots: [] });
});

test("the SRD Baseline Fighter card offers the two-name martial slot as one generic entry of quantity 2", () => {
  const srd = srdBaselineCompendium();
  const srdCatalogs = { compendium: srd, activeBooks: ALL_BOOKS };
  const fighter = srd.for().classes().find((c) => c.name === "Fighter");
  if (!fighter) throw new Error("the Fighter is missing from the SRD Baseline");
  const card = startingEquipmentCard(makeChar({ classes: [{ className: "Fighter", source: fighter.source, level: 1 }] }), srdCatalogs);
  assert.equal(card.slots.length, 4);
  const slot1 = card.slots[1];
  assert.equal(slot1.kind, "choice");
  if (slot1.kind !== "choice") return;
  const option = slot1.options.find((o) => o.letter === "b");
  const entry = option?.entries[0];
  assert.equal(entry?.kind, "type");
  if (entry?.kind !== "type") return;
  assert.equal(entry.quantity, 2, "two pickers for quantity 2");
  assert.ok(entry.pool.includes("Longsword"));
});

test("the card names each item as the catalog does, not as the class entry prints it", () => {
  const srd = srdBaselineCompendium();
  const cleric = srd.for().classes().find((c) => c.name === "Cleric");
  if (!cleric) throw new Error("the Cleric is missing from the SRD Baseline");
  const clericChar = makeChar({ classes: [{ className: "Cleric", source: cleric.source, level: 1 }] });
  const card = startingEquipmentCard(clericChar, { compendium: srd, activeBooks: ALL_BOOKS });
  const slot0 = card.slots[0];
  assert.equal(slot0.kind, "choice");
  if (slot0.kind !== "choice") return;
  assert.deepEqual(slot0.options[0].entries, [{ kind: "item", name: "Mace", quantity: 1 }]);
});
