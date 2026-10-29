import { test } from "node:test";
import assert from "node:assert/strict";
import { teardownSubclass , reconcile } from "../src/rules/characterReconciler.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import { makeChar, inMemoryCompendium, integratedTestCompendium } from "./testUtils.ts";
import { DEFAULT_ACTIVE_BOOK_CODES, ALL_BOOKS } from "../src/constants/books.ts";
import { CUSTOM_BACKGROUND_SKILLS_ID } from "../src/rules/customBackground.ts";
import { effectiveScores } from "../src/rules/abilities.ts";
import {
  setStandardArrayPick,
  setChoiceRacialBonus,
  validateMulticlass,
  addMulticlassLevel,
  confirmLevelUp,
  applyAsiWithHitPoints,
  applyStartingGrants,
  setCustomBackground,
  applyBackgroundGrants,
  clearBackground,
  changeRace,
  changeSubclass,
  removeClassLevel,
  applySoleSubclasses,
  reclaimStartingGrants,
  reclaimBackgroundGrants,
} from "../src/rules/builderTransitions.ts";
import type {
  InventoryItem,
  RuleChoiceEntry,
  SkillChoiceEntry,
} from "../src/types/character.ts";
import type { BackgroundData, ClassData, RaceData } from "../src/types/dnd5e.ts";
import { applyAncestrySelection } from "../src/rules/ancestryEngine.ts";

test("setChoiceRacialBonus updates racialChoiceBonus and racialAbilityBonuses while preserving fixed racial bonuses", () => {
  // Half-Elf style: +2 Charisma fixed, plus 2 choice bonuses of +1
  const initial = makeChar({
    racialAbilityBonuses: { cha: 2 },
  });

  const withPicks = setChoiceRacialBonus(initial, [
    { key: "dex", amount: 1 },
    { key: "con", amount: 1 },
  ]);

  assert.deepEqual(withPicks.racialChoiceBonus, [
    { key: "dex", amount: 1 },
    { key: "con", amount: 1 },
  ]);
  assert.equal(withPicks.racialAbilityBonuses.cha, 2);
  assert.equal(withPicks.racialAbilityBonuses.dex, 1);
  assert.equal(withPicks.racialAbilityBonuses.con, 1);

  // Reassign choices: DEX & CON replaced by WIS & INT
  const reassigned = setChoiceRacialBonus(withPicks, [
    { key: "wis", amount: 1 },
    { key: "int", amount: 1 },
  ]);

  assert.deepEqual(reassigned.racialChoiceBonus, [
    { key: "wis", amount: 1 },
    { key: "int", amount: 1 },
  ]);
  assert.equal(reassigned.racialAbilityBonuses.cha, 2);
  assert.equal(reassigned.racialAbilityBonuses.wis, 1);
  assert.equal(reassigned.racialAbilityBonuses.int, 1);
  assert.equal(reassigned.racialAbilityBonuses.dex, undefined);
  assert.equal(reassigned.racialAbilityBonuses.con, undefined);

  // Original character is not mutated
  assert.equal(initial.racialChoiceBonus, undefined);
  assert.deepEqual(initial.racialAbilityBonuses, { cha: 2 });
});

test("validateMulticlass checks prerequisites for BOTH existing classes and target class", () => {
  // Fighter: STR 13 or DEX 13
  // Wizard: INT 13
  const fighterChar = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
  });

  // Fighter lacks both STR and DEX -> cannot multiclass out even if INT is 18
  const failOut = validateMulticlass(fighterChar, "Wizard", {
    str: 10,
    dex: 10,
    con: 10,
    int: 18,
    wis: 10,
    cha: 10,
  });
  assert.equal(failOut.ok, false);
  assert.match(failOut.reason ?? "", /Fighter/i);

  // Fighter meets DEX 14, but Wizard needs INT 13 (INT is 10) -> cannot multiclass in
  const failIn = validateMulticlass(fighterChar, "Wizard", {
    str: 10,
    dex: 14,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  });
  assert.equal(failIn.ok, false);
  assert.match(failIn.reason ?? "", /Wizard/i);

  // Meets both Fighter (DEX 14) and Wizard (INT 14) -> passes
  const passFighterWizard = validateMulticlass(fighterChar, "Wizard", {
    str: 10,
    dex: 14,
    con: 10,
    int: 14,
    wis: 10,
    cha: 10,
  });
  assert.equal(passFighterWizard.ok, true);

  // Paladin: STR 13 AND CHA 13
  const paladinChar = makeChar({
    classes: [{ className: "Paladin", source: "PHB", level: 1 }],
  });

  // Paladin has STR 14, INT 14, but CHA 10 (needs CHA 13) -> fails
  const paladinFailCha = validateMulticlass(paladinChar, "Wizard", {
    str: 14,
    dex: 10,
    con: 10,
    int: 14,
    wis: 10,
    cha: 10,
  });
  assert.equal(paladinFailCha.ok, false);
  assert.match(paladinFailCha.reason ?? "", /Paladin/i);

  // Paladin with STR 14, CHA 14, INT 14 -> passes
  const paladinPass = validateMulticlass(paladinChar, "Wizard", {
    str: 14,
    dex: 10,
    con: 10,
    int: 14,
    wis: 10,
    cha: 14,
  });
  assert.equal(paladinPass.ok, true);

  // Leveling up existing class is not multiclassing into a new class
  const levelUpExisting = validateMulticlass(fighterChar, "Fighter", {
    str: 8,
    dex: 8,
    con: 8,
    int: 8,
    wis: 8,
    cha: 8,
  });
  assert.equal(levelUpExisting.ok, true);
});

test("addMulticlassLevel increments existing class or adds new class with multiclass proficiencies", () => {
  const wizard = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
  });

  // Level up existing class
  const wizard2 = addMulticlassLevel(wizard, "Wizard", "PHB");
  assert.equal(wizard2.classes.length, 1);
  assert.equal(wizard2.classes[0].level, 2);

  // Multiclass into Rogue: should add Rogue and grant Rogue multiclass proficiencies
  const wizardRogue = addMulticlassLevel(wizard, "Rogue", "PHB");
  assert.equal(wizardRogue.classes.length, 2);
  assert.equal(wizardRogue.classes[1].className, "Rogue");
  assert.equal(wizardRogue.classes[1].level, 1);

  // The Rogue skill pick is a Proficiency Choice on the sheet, not a skill choice entry.
  assert.equal(wizardRogue.skillChoices, undefined);

  // Multiclass proficiencies record
  const rogueProf = wizardRogue.multiclassProficiencies?.find((p) => p.className === "Rogue");
  assert.ok(rogueProf);
  assert.ok(rogueProf?.armor?.includes("Light armor"));
  assert.ok(rogueProf?.tools?.includes("Thieves' tools"));

  // Multiclass into Fighter: should add Fighter with armor/weapon proficiencies
  const wizardFighter = addMulticlassLevel(wizard, "Fighter", "PHB");
  const fighterProf = wizardFighter.multiclassProficiencies?.find((p) => p.className === "Fighter");
  assert.ok(fighterProf);
  assert.ok(fighterProf?.armor?.includes("Medium armor"));
  assert.ok(fighterProf?.armor?.includes("Shields"));
  assert.ok(fighterProf?.weapons?.includes("Martial weapons"));
});

// Con 14 gives +2. Fighter hit die d10, Wizard d6. The first level takes the full die; every other level takes (die / 2 rounded down) + 1, plus Con.
const CON_14 = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 };

test("confirmLevelUp with full heal on fills current HP to the levelled max, clears death saves, keeps temp HP and hit dice", () => {
  // Fighter 1 -> 2: 10 + 2 = 12, then 6 + 2 = 8. Max 20.
  const fighter = makeChar({
    baseAbilityScores: CON_14,
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    currentHp: 0,
    tempHp: 4,
    usedHitDice: { d10: 1 },
    deathSaves: { successes: 1, failures: 2 },
  });
  const levelled = confirmLevelUp(fighter, "Fighter", "PHB", true);
  assert.equal(levelled.classes[0].level, 2);
  assert.equal(levelled.currentHp, 20);
  assert.deepEqual(levelled.deathSaves, { successes: 0, failures: 0 });
  assert.equal(levelled.tempHp, 4);
  assert.deepEqual(levelled.usedHitDice, { d10: 1 });
});

test("confirmLevelUp with full heal on fills current HP to the max after a multiclass level", () => {
  // Fighter 1 gives 12. The new Wizard 1 is not a first level, so it takes 4 (d6 average plus one) + 2 = 6. Max 18.
  const fighter = makeChar({
    baseAbilityScores: CON_14,
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    currentHp: 7,
  });
  const multiclassed = confirmLevelUp(fighter, "Wizard", "PHB", true);
  assert.equal(multiclassed.classes.length, 2);
  assert.equal(multiclassed.currentHp, 18);
});

test("confirmLevelUp with full heal off leaves current HP, temp HP and death saves as they were", () => {
  const fighter = makeChar({
    baseAbilityScores: CON_14,
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    currentHp: 5,
    tempHp: 4,
    deathSaves: { successes: 1, failures: 0 },
  });
  const levelled = confirmLevelUp(fighter, "Fighter", "PHB", false);
  assert.equal(levelled.classes[0].level, 2);
  assert.equal(levelled.currentHp, 5);
  assert.equal(levelled.tempHp, 4);
  assert.deepEqual(levelled.deathSaves, { successes: 1, failures: 0 });
});

// Fighter 4 with Con 14 (+2): 10 + 2 = 12, then three levels of 6 + 2 = 24. Max 36.
// Con 16 (+3) at the same level: 13, then three levels of 6 + 3 = 27. Max 40.
const FIGHTER_4 = {
  baseAbilityScores: CON_14,
  classes: [{ className: "Fighter", source: "PHB", level: 4 }],
};

test("applyAsiWithHitPoints: a Constitution raise at full HP lifts current HP to the new max, keeping temp HP, death saves and hit dice", () => {
  const fighter = makeChar({
    ...FIGHTER_4,
    currentHp: 36,
    tempHp: 5,
    deathSaves: { successes: 1, failures: 0 },
    usedHitDice: { d10: 2 },
  });
  const picked = applyAsiWithHitPoints(
    fighter,
    { className: "Fighter", classLevel: 4, level: 4, type: "asi", asi: { con: 2 } },
    true,
    inMemoryCompendium(), ALL_BOOKS
  );
  assert.equal(effectiveScores(picked).modifiers.con, 3);
  assert.equal(picked.currentHp, 40);
  assert.equal(picked.tempHp, 5);
  assert.deepEqual(picked.deathSaves, { successes: 1, failures: 0 });
  assert.deepEqual(picked.usedHitDice, { d10: 2 });
});

test("applyAsiWithHitPoints: a Tough feat at full HP lifts current HP by 2 per level", () => {
  // Tough adds 2 per total level: 4 levels give +8, so 36 becomes 44.
  const fighter = makeChar({ ...FIGHTER_4, currentHp: 36, tempHp: 0 });
  const picked = applyAsiWithHitPoints(
    fighter,
    { className: "Fighter", classLevel: 4, level: 4, type: "feat", featName: "Tough", featSource: "PHB" },
    true,
    inMemoryCompendium(), ALL_BOOKS
  );
  assert.equal(picked.currentHp, 44);
});

test("applyAsiWithHitPoints: below full HP, a raised max leaves current HP where it is", () => {
  const fighter = makeChar({ ...FIGHTER_4, currentHp: 20, tempHp: 0 });
  const picked = applyAsiWithHitPoints(
    fighter,
    { className: "Fighter", classLevel: 4, level: 4, type: "asi", asi: { con: 2 } },
    true,
    inMemoryCompendium(), ALL_BOOKS
  );
  assert.equal(picked.currentHp, 20);
});

test("applyAsiWithHitPoints: with full heal off, a raised max leaves current HP unchanged", () => {
  const fighter = makeChar({ ...FIGHTER_4, currentHp: 36, tempHp: 0 });
  const picked = applyAsiWithHitPoints(
    fighter,
    { className: "Fighter", classLevel: 4, level: 4, type: "asi", asi: { con: 2 } },
    false,
    inMemoryCompendium(), ALL_BOOKS
  );
  assert.equal(effectiveScores(picked).modifiers.con, 3);
  assert.equal(picked.currentHp, 36);
});

test("applyStartingGrants grants gold or equipment and is idempotent", () => {
  const char = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    pouch: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 },
    items: [],
  });

  // Grant gold mode
  const withGold = applyStartingGrants(char, "gold", { goldAmount: 125 });
  assert.equal(withGold.startingGrantsApplied, true);
  assert.equal(withGold.startingOption, "gold");
  assert.equal(withGold.pouch.gp, 135);

  // Idempotent: calling again does not add more gold
  const withGoldAgain = applyStartingGrants(withGold, "gold", { goldAmount: 125 });
  assert.equal(withGoldAgain.pouch.gp, 135);

  // Grant equipment mode
  const gearItem: InventoryItem = {
    id: "item_sword_1",
    name: "Longsword",
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
  };

  const withGear = applyStartingGrants(char, "equipment", { equipmentItems: [gearItem] });
  assert.equal(withGear.startingGrantsApplied, true);
  assert.equal(withGear.startingOption, "equipment");
  assert.equal(withGear.items.length, 1);
  assert.equal(withGear.items[0].name, "Longsword");

  // Idempotent: calling again does not duplicate items
  const withGearAgain = applyStartingGrants(withGear, "equipment", { equipmentItems: [gearItem] });
  assert.equal(withGearAgain.items.length, 1);
});

test("applyStartingGrants reconciles cleanly when switching between gold and equipment", () => {
  const initial = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    pouch: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 },
    items: [
      { id: "custom_torch", name: "Torch", source: "PHB", quantity: 2, isEquipped: false, section: "carried" },
    ],
  });

  const startingSword: InventoryItem = {
    id: "start_fighter_0_longsword",
    name: "Longsword",
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
  };

  // 1. Claim equipment
  const withGear = applyStartingGrants(initial, "equipment", { equipmentItems: [startingSword] });
  assert.equal(withGear.startingOption, "equipment");
  assert.equal(withGear.items.length, 2);
  assert.equal(withGear.pouch.gp, 10);

  // 2. Switch to gold mode
  const switchedToGold = applyStartingGrants(withGear, "gold", { goldAmount: 125 });
  assert.equal(switchedToGold.startingOption, "gold");
  assert.equal(switchedToGold.pouch.gp, 135); // 10 initial + 125
  assert.equal(switchedToGold.items.length, 1); // starting sword removed, custom torch preserved
  assert.equal(switchedToGold.items[0].id, "custom_torch");

  // 3. Switch back to equipment mode
  const switchedBackToGear = applyStartingGrants(switchedToGold, "equipment", { equipmentItems: [startingSword] });
  assert.equal(switchedBackToGear.startingOption, "equipment");
  assert.equal(switchedBackToGear.pouch.gp, 10); // 125 gold grant cleanly revoked
  assert.equal(switchedBackToGear.items.length, 2); // starting sword restored, custom torch preserved
});

test("setCustomBackground sets background to Custom and records its skill picks as its Proficiency Choice", () => {
  const initial = makeChar({
    chosenSkills: ["Athletics"],
  });

  const custom = setCustomBackground(initial, "Gladiator", ["Acrobatics", "Performance"], undefined, undefined, ALL_BOOKS);
  assert.deepEqual(custom.background, {
    name: "Gladiator",
    source: "Custom",
  });
  assert.deepEqual(custom.proficiencyPicks?.[CUSTOM_BACKGROUND_SKILLS_ID], ["Acrobatics", "Performance"]);
  assert.deepEqual(custom.chosenSkills, ["Athletics"], "the old skill bucket is not written; other skills stay");

  // Replacing the custom background replaces its picks.
  const changed = setCustomBackground(custom, "Sage", ["Arcana", "History"], undefined, undefined, ALL_BOOKS);
  assert.equal(changed.background?.name, "Sage");
  assert.deepEqual(changed.proficiencyPicks?.[CUSTOM_BACKGROUND_SKILLS_ID], ["Arcana", "History"]);
  assert.deepEqual(changed.chosenSkills, ["Athletics"]);
});

test("applyBackgroundGrants grants coins and equipment items, and writes no skill (its skills are its grants)", () => {
  const char = makeChar({
    background: { name: "Acolyte", source: "PHB" },
    pouch: { gp: 0 },
    items: [],
    chosenSkills: ["Athletics"],
  });

  const bgData = {
    name: "Acolyte",
    source: "PHB",
    skillProficiencies: ["Insight", "Religion"],
    toolProficiencies: [],
    languages: ["2 of your choice"],
    startingEquipment: [
      "holy symbol",
      "5 sticks of incense",
      "vestments",
      "common clothes",
      "pouch containing 15 gp",
    ],
    feature: null,
    characteristics: {},
    description: "",
  };

  const granted = applyBackgroundGrants(char, bgData as any);
  assert.equal(granted.backgroundGrantsApplied, true);
  assert.equal(granted.pouch?.gp, 15);
  assert.ok(granted.items.some((it) => it.name === "Holy symbol"));
  assert.ok(granted.items.some((it) => it.name === "Sticks of incense" && it.quantity === 5));
  assert.deepEqual(granted.chosenSkills, ["Athletics"], "the background's skills are not copied into the skill bucket");

  // Idempotent
  const again = applyBackgroundGrants(granted, bgData as any);
  assert.equal(again.pouch?.gp, 15);
  assert.equal(again.items.length, granted.items.length);
});

test("reclaimStartingGrants adds equipment on top of an earlier claim and keeps unique item ids", () => {
  const longsword: InventoryItem = { id: "start_fighter_0", name: "Longsword", source: "PHB", quantity: 1, isEquipped: true, section: "equipped" };
  const shield: InventoryItem = { id: "start_fighter_1", name: "Shield", source: "PHB", quantity: 1, isEquipped: true, section: "equipped" };
  const claimed = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    startingOption: "equipment",
    startingGrantsApplied: true,
    items: [longsword],
  });

  const reclaimed = reclaimStartingGrants(claimed, "equipment", { equipmentItems: [longsword, shield] });
  assert.equal(reclaimed.startingGrantsApplied, true);
  assert.equal(reclaimed.startingOption, "equipment");
  assert.deepEqual(reclaimed.items.map((it) => it.id), ["start_fighter_0", "start_fighter_0_2", "start_fighter_1"]);
  assert.deepEqual(reclaimed.items[0], longsword, "the earlier claim is kept as it was");
});

test("reclaimStartingGrants adds gold each time and the granted sum is removed when switching to equipment", () => {
  const initial = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    pouch: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 },
  });

  const firstClaim = applyStartingGrants(initial, "gold", { goldAmount: 125 });
  const secondClaim = reclaimStartingGrants(firstClaim, "gold", { goldAmount: 125 });
  assert.equal(secondClaim.pouch.gp, 260, "gold is added on top of the earlier claim");
  assert.equal(secondClaim.startingGrantedGold, 250, "granted gold accumulates");
  assert.equal(secondClaim.startingOption, "gold");

  const twiceFromScratch = reclaimStartingGrants(reclaimStartingGrants(initial, "gold", { goldAmount: 125 }), "gold", { goldAmount: 125 });
  assert.equal(twiceFromScratch.pouch.gp, 260);
  assert.equal(twiceFromScratch.startingGrantedGold, 250);

  const switched = applyStartingGrants(secondClaim, "equipment", { equipmentItems: [] });
  assert.equal(switched.pouch.gp, 10, "the whole granted sum is removed from the pouch");
});

test("reclaimStartingGrants from gold to equipment is a plain add that keeps the gold", () => {
  const goldClaim = applyStartingGrants(
    makeChar({ classes: [{ className: "Fighter", source: "PHB", level: 1 }], pouch: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } }),
    "gold",
    { goldAmount: 125 },
  );
  const gear: InventoryItem = { id: "start_fighter_0", name: "Longsword", source: "PHB", quantity: 1, isEquipped: true, section: "equipped" };

  const reclaimed = reclaimStartingGrants(goldClaim, "equipment", { equipmentItems: [gear] });
  assert.equal(reclaimed.pouch.gp, 125);
  assert.equal(reclaimed.items.length, 1);
  assert.equal(reclaimed.startingOption, "equipment");
});

test("starting gold reclaimed as equipment and then claimed as gold again replaces the earlier gold", () => {
  const initial = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    pouch: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    items: [],
  });

  const goldClaim = applyStartingGrants(initial, "gold", { goldAmount: 100 });
  const asEquipment = reclaimStartingGrants(goldClaim, "equipment", { equipmentItems: [] });
  assert.equal(asEquipment.pouch.gp, 100, "reclaiming as equipment keeps the gold in the pouch");
  assert.equal(asEquipment.startingGrantedGold, 100);
  assert.equal(asEquipment.startingOption, "equipment");

  const goldAgain = applyStartingGrants(asEquipment, "gold", { goldAmount: 100 });
  assert.equal(goldAgain.pouch.gp, 100, "the earlier 100 is removed before the new 100 is added");
  assert.equal(goldAgain.startingGrantedGold, 100);
  assert.equal(goldAgain.startingOption, "gold");

  const backToEquipment = applyStartingGrants(goldAgain, "equipment", { equipmentItems: [] });
  assert.equal(backToEquipment.pouch.gp, 0, "all of the starting gold is removed");
  assert.equal(backToEquipment.startingGrantedGold, undefined);
});

test("equipment, then gold, then equipment leaves the pouch as it was and swaps the starting items", () => {
  const initial = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    pouch: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 },
    items: [],
  });
  const longsword: InventoryItem = { id: "start_fighter_0", name: "Longsword", source: "PHB", quantity: 1, isEquipped: true, section: "equipped" };

  const equipmentFirst = applyStartingGrants(initial, "equipment", { equipmentItems: [longsword] });
  const goldSecond = applyStartingGrants(equipmentFirst, "gold", { goldAmount: 125 });
  assert.equal(goldSecond.pouch.gp, 135);
  assert.equal(goldSecond.startingGrantedGold, 125);
  assert.deepEqual(goldSecond.items, []);

  const equipmentThird = applyStartingGrants(goldSecond, "equipment", { equipmentItems: [longsword] });
  assert.equal(equipmentThird.pouch.gp, 10, "the 125 gold grant is removed");
  assert.equal(equipmentThird.startingGrantedGold, undefined);
  assert.deepEqual(equipmentThird.items, [longsword]);
});

test("reclaimBackgroundGrants adds the coins and items again with unique ids and writes no skills", () => {
  const bgData = {
    name: "Acolyte",
    source: "PHB",
    skillProficiencies: ["Insight", "Religion"],
    toolProficiencies: [],
    languages: [],
    startingEquipment: ["holy symbol", "pouch containing 15 gp"],
    feature: null,
    characteristics: {},
    description: "",
  } as unknown as BackgroundData;
  const claimed = applyBackgroundGrants(
    makeChar({ background: { name: "Acolyte", source: "PHB" }, pouch: { gp: 0 }, items: [], chosenSkills: ["Athletics"] }),
    bgData,
  );

  const again = reclaimBackgroundGrants(claimed, bgData);
  assert.equal(again.backgroundGrantsApplied, true);
  assert.equal(again.pouch?.gp, 30, "coins are added again");
  assert.deepEqual(again.items.map((it) => it.id), ["bg_item_0", "bg_item_1", "bg_item_0_2", "bg_item_1_2"]);
  assert.equal(new Set(again.items.map((it) => it.id)).size, again.items.length, "item ids are unique");
  assert.deepEqual(again.chosenSkills, ["Athletics"], "skills are not written to the bucket");
});

test("reclaimBackgroundGrants after a background change gives the new background's equipment", () => {
  const acolyte = {
    name: "Acolyte",
    source: "PHB",
    skillProficiencies: ["Insight"],
    startingEquipment: ["holy symbol"],
  } as unknown as BackgroundData;
  const soldier = {
    name: "Soldier",
    source: "PHB",
    skillProficiencies: ["Athletics"],
    startingEquipment: ["insignia of rank"],
  } as unknown as BackgroundData;
  const claimed = applyBackgroundGrants(makeChar({ background: { name: "Acolyte", source: "PHB" } }), acolyte);
  const switched = { ...claimed, background: { name: "Soldier", source: "PHB" } };

  const reclaimed = reclaimBackgroundGrants(switched, soldier);
  assert.equal(reclaimed.backgroundGrantsApplied, true, "the marker stays true");
  assert.ok(reclaimed.items.some((it) => it.name === "Insignia of rank"), "the new background's item is granted");
  assert.ok(reclaimed.items.some((it) => it.name === "Holy symbol"), "the earlier item is kept");
  assert.equal(reclaimed.chosenSkills.includes("Athletics"), false, "the new background's skill is its grant, not a bucket entry");
});

test("applyStartingGrants and applyBackgroundGrants return the same reference once already applied", () => {
  const claimedGear = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    startingOption: "equipment",
    startingGrantsApplied: true,
  });
  assert.equal(applyStartingGrants(claimedGear, "equipment", { equipmentItems: [] }), claimedGear);

  const claimedBackground = makeChar({ backgroundGrantsApplied: true });
  assert.equal(applyBackgroundGrants(claimedBackground, undefined), claimedBackground);
});

test("teardownSubclass cleans up ruleChoices, swaps, and counters", () => {
  const initial = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 3, subclassName: "Circle of the Land" }],
    ruleChoices: [
      {
        id: "PHB__Druid__Circle of the Land__Biome",
        trait: "Circle of the Land: Biome",
        origin: "subclass",
        choose: 1,
        from: ["Coast"],
        picked: ["Coast"],
      },
      {
        id: "MPMM__Aasimar__null__Celestial Revelation",
        trait: "Celestial Revelation",
        origin: "race",
        choose: 1,
        from: ["Radiant Soul"],
        picked: ["Radiant Soul"],
      },
    ],
    subclassSpellSwaps: { Alarm: "Shield" },
    resourceCounters: {
      bladesong: { id: "bladesong", name: "Bladesong", current: 2, max: 2, resetOn: "short" },
      wild_shape: { id: "wild_shape", name: "Wild Shape", current: 2, max: 2, resetOn: "short" },
    },
  });

  // Teardown Circle of the Land
  const tornDown = teardownSubclass(initial, "Druid", "Circle of the Land", undefined, ALL_BOOKS);
  assert.equal(tornDown.ruleChoices?.length, 1);
  assert.equal(tornDown.ruleChoices[0].id, "MPMM__Aasimar__null__Celestial Revelation");
  // Druid does not wipe sorcerer swaps
  assert.deepEqual(tornDown.subclassSpellSwaps, { Alarm: "Shield" });
  assert.ok(tornDown.resourceCounters.wild_shape);

  // Teardown Sorcerer
  const sorcInitial = makeChar({
    classes: [{ className: "Sorcerer", source: "TCE", level: 3, subclassName: "Clockwork Soul" }],
    subclassSpellSwaps: { Alarm: "Shield" },
  });
  const tornDownSorc = teardownSubclass(sorcInitial, "Sorcerer", "Clockwork Soul", undefined, ALL_BOOKS);
  assert.equal(tornDownSorc.subclassSpellSwaps, undefined);

  // Teardown Wizard with Bladesong counter
  const wizInitial = makeChar({
    classes: [{ className: "Wizard", source: "TCE", level: 3, subclassName: "Bladesinging" }],
    resourceCounters: {
      bladesong: { id: "bladesong", name: "Bladesong", current: 2, max: 2, resetOn: "short" },
      arcane_recovery: { id: "arcane_recovery", name: "Arcane Recovery", current: 1, max: 1, resetOn: "long" },
    },
  });
  const tornDownWiz = teardownSubclass(wizInitial, "Wizard", "Bladesinging", undefined, ALL_BOOKS);
  assert.equal(tornDownWiz.resourceCounters.bladesong, undefined);
  // Teardown without new subclass (e.g. on deleveling below requirement)
  const delevelDruid = teardownSubclass(initial, "Druid", "Circle of the Land", undefined, ALL_BOOKS);
  assert.equal(delevelDruid.ruleChoices?.length, 1);
  assert.equal(delevelDruid.ruleChoices[0].id, "MPMM__Aasimar__null__Celestial Revelation");
});

test("teardownSubclass keeps a class-owned Fighting Style even when previousSubclassName is empty string", () => {
  const initial = makeChar({
    classes: [{ className: "Fighter", level: 1 }],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        picked: ["Archery"],
        choose: 1,
        options: [],
        origin: "subclass",
      },
    ],
  });

  // The Fighting Style is owned by the Fighter class, not by a subclass, so subclass teardown keeps it.
  const tornDown = teardownSubclass(initial, "Fighter", "", undefined, ALL_BOOKS);
  assert.deepEqual(tornDown.ruleChoices?.map((rc) => rc.id), ["PHB__Fighter__Fighting Style"]);
});

test("reconcile cleanses orphaned fighting styles, maneuvers, invocations, infusions, and arcanum in a single pass", () => {
  // Multiclass character with features from Fighter, Battle Master, Warlock, Artificer
  const initial = makeChar({
    classes: [
      { className: "Fighter", source: "PHB", level: 3, subclassName: "Battle Master" },
      { className: "Warlock", source: "PHB", level: 11 },
      { className: "Artificer", source: "TCE", level: 2 },
    ],
    ruleChoices: [
      { id: "PHB__Fighter__Fighting Style", trait: "Fighting Style", picked: ["Archery"], choose: 1, options: [], origin: "class" },
      { id: "PHB__Fighter__Battle Master__Maneuvers 3", trait: "Combat Superiority", picked: ["Parry", "Riposte", "Trip Attack"], choose: 3, options: [], origin: "class" },
      { id: "PHB__Warlock__Pact Boon", trait: "Pact Boon", picked: ["Pact of the Tome"], choose: 1, options: [], origin: "class" },
      { id: "Warlock__Pact of the Tome__Cantrips", trait: "Pact of the Tome Cantrips", picked: ["Guidance", "Shillelagh", "Vicious Mockery"], choose: 3, options: [], origin: "class" },
      { id: "PHB__Warlock__Invocations 2", trait: "Eldritch Invocations (2nd Level)", picked: ["Agonizing Blast", "Armor of Shadows"], choose: 2, options: [], origin: "class" },
      { id: "Warlock__Mystic Arcanum 11", trait: "Mystic Arcanum (6th Level)", picked: ["Circle of Death"], choose: 1, options: [], origin: "class" },
      { id: "TCE__Artificer__Infusions 2", trait: "Infusions Known (2nd Level)", picked: ["Enhanced Defense", "Replicate Magic Item: Bag of Holding"], choose: 4, options: [], origin: "class" },
    ],
    knownSpells: [
      { name: "Guidance", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock", source: "PHB" },
      { name: "Shillelagh", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock", source: "PHB" },
      { name: "Vicious Mockery", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock", source: "PHB" },
    ],
  });

  // 1. Idempotency check: running reconcile on valid character changes nothing
  const unchanged = reconcile(initial, currentCompendium(), { activeBooks: ALL_BOOKS });
  assert.equal(unchanged.ruleChoices?.length, 7);
  assert.equal(unchanged.knownSpells?.length, 3);

  // 2. De-leveling Fighter to level 0 (removed), Warlock to 2, and Artificer to 1
  const delevelled: typeof initial = {
    ...initial,
    classes: [
      { className: "Warlock", source: "PHB", level: 2 },
    ],
  };

  const reconciled = reconcile(delevelled, currentCompendium(), { activeBooks: ALL_BOOKS });

  // Fighter styles and Battle Master maneuvers must be removed
  assert.ok(!reconciled.ruleChoices?.some((rc) => rc.id.includes("Fighter")));
  assert.ok(!reconciled.ruleChoices?.some((rc) => rc.id.includes("Battle Master")));

  // Mystic Arcanum (level 11 requirement) and Artificer infusions must be removed
  assert.ok(!reconciled.ruleChoices?.some((rc) => rc.id.includes("Mystic Arcanum")));
  assert.ok(!reconciled.ruleChoices?.some((rc) => rc.id.includes("Artificer")));

  // Warlock 2 has no Pact Boon (requires lvl 3), so Pact of the Tome cantrips and Boon are removed
  assert.ok(!reconciled.ruleChoices?.some((rc) => rc.id.includes("Pact Boon")));
  assert.ok(!reconciled.ruleChoices?.some((rc) => rc.id.includes("Pact of the Tome")));
  assert.ok(!reconciled.knownSpells?.some((k) => k.ownerKey === "Warlock__Tome"));

  // Level 2 Warlock invocations should be preserved
  assert.ok(reconciled.ruleChoices?.some((rc) => rc.id === "PHB__Warlock__Invocations 2"));
});





const SOLDIER: BackgroundData = {
  name: "Soldier",
  source: "PHB",
  skillProficiencies: ["Athletics", "Intimidation"],
  toolProficiencies: ["Gaming set"],
  languages: [],
  startingEquipment: [],
  feature: null,
  characteristics: {},
  description: "",
};
const soldierCompendium = inMemoryCompendium({ backgrounds: [SOLDIER] });

const fighterStyle: RuleChoiceEntry = {
  id: "PHB__Fighter__Fighting Style",
  trait: "Fighting Style",
  origin: "class",
  choose: 1,
  from: [],
  picked: ["Dueling"],
};
const initiateStyle: RuleChoiceEntry = {
  id: "TCE__Feat__Fighting Initiate__Style",
  trait: "Fighting Initiate Style",
  origin: "class",
  choose: 1,
  from: [],
  picked: ["Archery"],
};

test("clearing a background removes the feat it granted and the choices that depended on that feat", () => {
  const char = makeChar({
    background: { name: "Soldier", source: "PHB" },
    classes: [{ className: "Fighter", source: "PHB", level: 4 }],
    originFeats: [
      { level: 1, type: "feat", featName: "Fighting Initiate", featSource: "Background" },
      { level: 1, type: "feat", featName: "Alert", featSource: "PHB" },
    ],
    ruleChoices: [fighterStyle, initiateStyle],
  });

  const updated = clearBackground(char, { compendium: soldierCompendium, activeBooks: ALL_BOOKS });

  assert.equal(updated.background, null);
  assert.deepEqual(updated.originFeats, [
    { level: 1, type: "feat", featName: "Alert", featSource: "PHB" },
  ]);
  assert.deepEqual(updated.ruleChoices, [fighterStyle]);
  assert.deepEqual(updated.needsReview, [
    "Fighting Initiate removed: granted by the Soldier background",
    "Fighting Initiate Style removed: prerequisite no longer satisfied",
  ]);
});

test("clearing a background removes its skill, language and tool grants and keeps a skill another source grants", () => {
  const raceSkills: SkillChoiceEntry = {
    id: "race_skills",
    origin: "race",
    choose: 1,
    from: [],
    picked: ["Athletics"],
  };
  const char = makeChar({
    background: { name: "Soldier", source: "PHB" },
    chosenSkills: ["Athletics", "Intimidation"],
    skillChoices: [raceSkills],
    chosenLanguages: { race: ["Elvish"], background: ["Dwarvish"] },
    chosenTools: { background: ["Gaming set"] },
  });

  const updated = clearBackground(char, { compendium: soldierCompendium, activeBooks: ALL_BOOKS });

  assert.equal(updated.background, null);
  assert.deepEqual(updated.chosenSkills, ["Athletics"]);
  assert.deepEqual(updated.skillChoices, [raceSkills]);
  assert.deepEqual(updated.chosenLanguages?.race, ["Elvish"]);
  assert.deepEqual(updated.chosenLanguages?.background, []);
  assert.deepEqual(updated.chosenTools?.background, []);
  assert.deepEqual(updated.needsReview, [
    "Soldier background removed: granted skills, languages and tools cleared",
  ]);
});

// Invented background records, in the sources the two catalogs hold them under.
const SCHOLAR: BackgroundData = {
  name: "Sample Scholar",
  source: "TST",
  skillProficiencies: ["Insight", "Religion"],
  toolProficiencies: [],
  languages: [],
  startingEquipment: [],
  feature: null,
  characteristics: {},
  description: "",
};
const SCHOLAR_NOTICE = "Sample Scholar background removed: granted skills, languages and tools cleared";

test("clearing a background saved on the SRD Baseline clears its legacy skills on the integrated catalog, which holds it under another source", () => {
  const integrated = inMemoryCompendium({ backgrounds: [SCHOLAR] }, { integrated: true });
  const char = makeChar({ background: { name: "Sample Scholar", source: "SRD" }, chosenSkills: ["Insight", "Religion"] });
  const updated = clearBackground(char, { compendium: integrated, activeBooks: ["TST"] });
  assert.deepEqual(updated.chosenSkills, []);
  assert.deepEqual(updated.needsReview, [SCHOLAR_NOTICE]);
});

test("clearing a background saved on the integrated catalog clears its legacy skills on the SRD Baseline alone, which holds it under SRD", () => {
  const srdOnly = inMemoryCompendium({ backgrounds: [{ ...SCHOLAR, source: "SRD" }] });
  const char = makeChar({ background: { name: "Sample Scholar", source: "TST" }, chosenSkills: ["Insight", "Religion"] });
  const updated = clearBackground(char, { compendium: srdOnly, activeBooks: ["SRD"] });
  assert.deepEqual(updated.chosenSkills, []);
  assert.deepEqual(updated.needsReview, [SCHOLAR_NOTICE]);
});

test("clearing the Acolyte saved on the SRD Baseline clears its legacy skills on the real integrated catalog", () => {
  const char = makeChar({ background: { name: "Acolyte", source: "SRD" }, chosenSkills: ["Insight"] });
  const updated = clearBackground(char, { compendium: integratedTestCompendium(), activeBooks: [...DEFAULT_ACTIVE_BOOK_CODES] });
  assert.deepEqual(updated.chosenSkills, []);
  assert.deepEqual(updated.needsReview, ["Acolyte background removed: granted skills, languages and tools cleared"]);
});

// Invented records of one name in two books, each with a skill choice of its own. The saved source is in neither book.
const skillChoiceRecord = <T extends { name: string; source: string }>(record: T, skills: string[]): T => ({
  ...record,
  grants: [{ id: `${record.source}/${record.name}@0#skills:choice:from`, kind: "choice", category: "skills", count: 1, pool: { kind: "names", names: skills } }],
});
const scholarBooks = inMemoryCompendium(
  {
    backgrounds: [
      skillChoiceRecord({ ...SCHOLAR, source: "OLD" }, ["Insight", "Religion"]),
      skillChoiceRecord({ ...SCHOLAR, source: "ALT" }, ["Survival", "Perception"]),
    ],
  },
  { integrated: true },
);
const legacyBackgroundPick: SkillChoiceEntry = { id: "legacy_background", origin: "background", choose: 1, from: [], picked: ["Survival"] };

/** An invented race, held in the given book, with a skill choice of its own: the first book's pool lacks Survival. */
const folkIn = (source: string): RaceData => ({
  name: "Sample Folk",
  source,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [],
  description: "",
  grants: [
    {
      id: `${source}/Sample Folk@0#skills:choice:from`,
      kind: "choice",
      category: "skills",
      count: 1,
      pool: { kind: "names", names: source === "OLD" ? ["Insight", "Religion"] : ["Survival", "Perception"] },
    },
  ],
});

test("clearing a background judges a legacy skill pick against the active book's record, not the first listed", () => {
  const char = makeChar({ background: { name: "Sample Scholar", source: "GONE" }, skillChoices: [legacyBackgroundPick] });
  const updated = clearBackground(char, { compendium: scholarBooks, activeBooks: ["ALT"] });
  assert.ok(updated.needsReview?.some((notice) => notice.startsWith("Survival removed")), `needsReview: ${updated.needsReview}`);
});

test("changing race judges a legacy skill pick against the active book's record, not the first listed", () => {
  const compendium = inMemoryCompendium({ races: [folkIn("OLD"), folkIn("ALT")] }, { integrated: true });
  const char = makeChar({
    race: { name: "Sample Folk", source: "GONE" },
    skillChoices: [{ id: "legacy_race", origin: "race", choose: 1, from: [], picked: ["Survival"] }],
  });
  const updated = changeRace(char, compendium, ["ALT"]);
  assert.ok(updated.needsReview?.some((notice) => notice.startsWith("Survival removed")), `needsReview: ${updated.needsReview}`);
});

test("applying an ancestry keeps a legacy skill pick judged against the active book's record, not the first listed", () => {
  const compendium = inMemoryCompendium({ races: [folkIn("OLD"), folkIn("ALT")] }, { integrated: true });
  const char = makeChar({
    race: { name: "Sample Folk", source: "GONE" },
    skillChoices: [{ id: "legacy_race", origin: "race", choose: 1, from: [], picked: ["Survival"] }],
  });
  const updated = applyAncestrySelection(char, folkIn("ALT"), undefined, { compendium, activeBooks: ["ALT"] });
  assert.ok(
    Object.values(updated.proficiencyPicks ?? {}).some((picks) => picks.includes("Survival")),
    `the pick moves into the active book's choice: ${JSON.stringify(updated.proficiencyPicks)}`,
  );
  assert.ok(!updated.needsReview?.some((notice) => notice.includes("Survival")), "and is not released");
});

test("clearing a custom background removes the skills it chose and keeps class skills", () => {
  const classSkills: SkillChoiceEntry = {
    id: "class_skills",
    origin: "class",
    choose: 1,
    from: [],
    picked: ["Athletics"],
  };
  const custom = setCustomBackground(
    makeChar({ chosenSkills: ["Athletics"], skillChoices: [classSkills] }),
    "Sage",
    ["Arcana", "History"], undefined, undefined, ALL_BOOKS
  );

  const updated = clearBackground(custom, { compendium: inMemoryCompendium({}), activeBooks: ALL_BOOKS });

  assert.equal(updated.background, null);
  assert.deepEqual(updated.chosenSkills, ["Athletics"]);
  assert.deepEqual(updated.skillChoices, [classSkills]);
  assert.deepEqual(updated.needsReview, [
    "Arcana, History removed from Custom Background: no longer granted",
  ]);
});

test("clearing a background with no recorded grants keeps unrelated choices and records nothing", () => {
  const char = makeChar({
    background: { name: "Hermit", source: "PHB" },
    classes: [{ className: "Fighter", source: "PHB", level: 4 }],
    chosenSkills: ["Athletics"],
    ruleChoices: [fighterStyle],
  });

  const updated = clearBackground(char, { compendium: inMemoryCompendium({}), activeBooks: ALL_BOOKS });

  assert.equal(updated.background, null);
  assert.deepEqual(updated.chosenSkills, ["Athletics"]);
  assert.deepEqual(updated.ruleChoices, [fighterStyle]);
  assert.deepEqual(updated.needsReview ?? [], []);
});

test("changeRace clears race-origin rule choices and skill picks but keeps class-origin choices", () => {
  const initial = makeChar({
    race: { name: "Human", source: "PHB" },
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    racialAbilityBonuses: { str: 1 },
    racialChoiceBonus: [{ key: "dex", amount: 1 }],
    chosenSkills: ["Athletics", "Perception", "Insight"],
    skillChoices: [
      { id: "Race: Human", origin: "race", choose: 1, from: ["Athletics", "Perception"], picked: ["Athletics"] },
      { id: "Class: Fighter", origin: "class", choose: 2, from: ["Perception", "Insight"], picked: ["Perception", "Insight"] },
    ],
    ruleChoices: [
      { id: "PHB__Human__Feat", trait: "Human Feat", origin: "race", choose: 1, from: ["Alert"], picked: ["Alert"] },
      { id: "PHB__Fighter__Fighting Style", trait: "Fighting Style", origin: "class", choose: 1, from: ["Archery"], picked: ["Archery"] },
    ],
  });

  const changed = changeRace(initial, inMemoryCompendium(), ALL_BOOKS);

  assert.equal(changed.race, null);
  assert.deepEqual(changed.racialAbilityBonuses, {});
  assert.deepEqual(changed.racialChoiceBonus, []);
  assert.deepEqual(changed.ruleChoices?.map((rc) => rc.id), ["PHB__Fighter__Fighting Style"]);
  assert.deepEqual(changed.skillChoices?.map((sc) => sc.id), ["Class: Fighter"]);
  // Race-origin pick (Athletics) is removed; class-origin picks and unrelated skills stay.
  assert.deepEqual(changed.chosenSkills, ["Perception", "Insight"]);
});

test("changeSubclass tears down the old subclass, sets the new one, and unlearns only the orphaned spells", () => {
  const initial = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 3, subclassName: "Circle of the Land", subclassSource: "PHB" }],
    ruleChoices: [
      {
        id: "PHB__Druid__Circle of the Land__Biome",
        trait: "Circle of the Land: Biome",
        origin: "subclass",
        choose: 1,
        from: ["Coast"],
        picked: ["Coast"],
      },
    ],
    knownSpells: [
      { name: "Moonbeam", ownerKey: "Druid__Land", ability: "wis", className: "Druid", source: "PHB" },
      { name: "Cure Wounds", ownerKey: "Druid", ability: "wis", className: "Druid", source: "PHB" },
    ],
  });

  const changed = changeSubclass(initial, "Druid", "Circle of the Moon", "PHB", ["Moonbeam"], inMemoryCompendium(), ALL_BOOKS);

  assert.equal(changed.classes[0].subclassName, "Circle of the Moon");
  assert.equal(changed.classes[0].subclass, "Circle of the Moon");
  assert.equal(changed.classes[0].subclassSource, "PHB");
  assert.equal(changed.ruleChoices?.length, 0, "old subclass Rule Choice is cleared");
  assert.deepEqual(changed.knownSpells?.map((k) => k.name), ["Cure Wounds"]);
});

test("removeClassLevel on a class's last level removes the class and prunes its skill picks", () => {
  const initial = makeChar({
    classes: [
      { className: "Rogue", source: "PHB", level: 1 },
      { className: "Fighter", source: "PHB", level: 1 },
    ],
    chosenSkills: ["Athletics", "Stealth", "Perception"],
    skillChoices: [
      { id: "Class: Rogue", origin: "class", choose: 1, from: ["Stealth", "Perception"], picked: ["Perception"] },
      { id: "Class: Fighter", origin: "class", choose: 2, from: ["Athletics", "Acrobatics"], picked: ["Athletics"] },
      { id: "multiclass_skill_fighter", origin: "class", choose: 1, from: ["Stealth", "Insight"], picked: ["Stealth"] },
    ],
  });

  const removed = removeClassLevel(initial, "Fighter", inMemoryCompendium(), ALL_BOOKS);

  assert.deepEqual(removed.classes.map((c) => c.className), ["Rogue"]);
  assert.deepEqual(removed.skillChoices?.map((sc) => sc.id), ["Class: Rogue"]);
  // Only the removed class's picks go; Rogue's Perception and the unrelated skill stay.
  assert.deepEqual(removed.chosenSkills, ["Perception"]);
});

test("removeClassLevel above level 1 keeps the class and drops the subclass only when it falls below the requirement", () => {
  const fighter3 = makeChar({
    classes: [
      { className: "Fighter", source: "PHB", level: 3, subclassName: "Battle Master", subclass: "Battle Master", subclassSource: "PHB" },
    ],
  });

  // Level 3 -> 2: below the subclass requirement, so the class stays but loses its subclass
  const droppedToTwo = removeClassLevel(fighter3, "Fighter", inMemoryCompendium(), ALL_BOOKS);
  assert.equal(droppedToTwo.classes.length, 1);
  assert.equal(droppedToTwo.classes[0].className, "Fighter");
  assert.equal(droppedToTwo.classes[0].level, 2);
  assert.equal(droppedToTwo.classes[0].subclassName, undefined);

  // Level 4 -> 3: still meets the requirement, so the subclass is kept
  const fighter4 = makeChar({
    classes: [
      { className: "Fighter", source: "PHB", level: 4, subclassName: "Battle Master", subclass: "Battle Master", subclassSource: "PHB" },
    ],
  });
  const droppedToThree = removeClassLevel(fighter4, "Fighter", inMemoryCompendium(), ALL_BOOKS);
  assert.equal(droppedToThree.classes[0].level, 3);
  assert.equal(droppedToThree.classes[0].subclassName, "Battle Master");
});

test("removeClassLevel from level 4 to 2 keeps the subclass at 3 and clears it once the level drops below 3", () => {
  // Lowercase entry: the class lookup matches the class name exactly, so the call uses the same case.
  const fighter4 = makeChar({
    classes: [
      { className: "fighter", source: "PHB", level: 4, subclassName: "Battle Master", subclass: "Battle Master", subclassSource: "PHB" },
    ],
  });

  const atThree = removeClassLevel(fighter4, "fighter", inMemoryCompendium(), ALL_BOOKS);
  assert.equal(atThree.classes[0].level, 3);
  assert.equal(atThree.classes[0].subclassName, "Battle Master");

  const atTwo = removeClassLevel(atThree, "fighter", inMemoryCompendium(), ALL_BOOKS);
  assert.equal(atTwo.classes[0].className, "fighter");
  assert.equal(atTwo.classes[0].level, 2);
  assert.equal(atTwo.classes[0].subclassName, undefined);
  assert.equal(atTwo.classes[0].subclass, undefined);
  assert.equal(atTwo.classes[0].subclassSource, undefined);
});

const classWithSubclasses = (name: string, source: string, subclassNames: string[]) =>
  ({
    name,
    source,
    subclasses: subclassNames.map((sub) => ({ name: sub, source })),
  }) as unknown as ClassData;

test("applySoleSubclasses applies the lone SRD subclass once the class reaches its subclass level", () => {
  const srd = inMemoryCompendium({
    classes: [classWithSubclasses("Fighter", "SRD", ["Champion"]), classWithSubclasses("Cleric", "SRD", ["Life Domain"])],
  });

  const fighter3 = makeChar({ classes: [{ className: "Fighter", source: "SRD", level: 3 }] });
  const appliedFighter = applySoleSubclasses(fighter3, srd, ALL_BOOKS);
  assert.equal(appliedFighter.classes[0].subclassName, "Champion");
  assert.equal(appliedFighter.classes[0].subclassSource, "SRD");

  const cleric1 = makeChar({ classes: [{ className: "Cleric", source: "SRD", level: 1 }] });
  assert.equal(applySoleSubclasses(cleric1, srd, ALL_BOOKS).classes[0].subclassName, "Life Domain");
});

test("applySoleSubclasses leaves a class below its subclass level unchanged", () => {
  const srd = inMemoryCompendium({ classes: [classWithSubclasses("Fighter", "SRD", ["Champion"])] });
  const fighter2 = makeChar({ classes: [{ className: "Fighter", source: "SRD", level: 2 }] });

  assert.equal(applySoleSubclasses(fighter2, srd, ALL_BOOKS), fighter2);
});

test("applySoleSubclasses keeps a subclass the character already has and never picks between several", () => {
  const srd = inMemoryCompendium({
    classes: [
      classWithSubclasses("Fighter", "SRD", ["Champion"]),
      classWithSubclasses("Rogue", "SRD", ["Thief", "Assassin"]),
    ],
  });
  const fighterWithSub = makeChar({
    classes: [{ className: "Fighter", source: "SRD", level: 3, subclassName: "Battle Master", subclassSource: "PHB" }],
  });
  const rogueChoice = makeChar({ classes: [{ className: "Rogue", source: "SRD", level: 3 }] });

  assert.equal(applySoleSubclasses(fighterWithSub, srd, ALL_BOOKS), fighterWithSub);
  assert.equal(applySoleSubclasses(rogueChoice, srd, ALL_BOOKS), rogueChoice);
});

test("applySoleSubclasses never changes a character in an integrated compendium", () => {
  const integrated = inMemoryCompendium(
    { classes: [classWithSubclasses("Fighter", "PHB", ["Champion"])] },
    { integrated: true },
  );
  const fighter3 = makeChar({ classes: [{ className: "Fighter", source: "PHB", level: 3 }] });

  assert.equal(applySoleSubclasses(fighter3, integrated, ALL_BOOKS), fighter3);
});
