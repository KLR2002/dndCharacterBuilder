import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import {
  setStandardArrayPick,
  setChoiceRacialBonus,
  validateMulticlass,
  addMulticlassLevel,
  applyStartingGrants,
  setCustomBackground,
  applyBackgroundGrants,
  setLanguages,
} from "../src/rules/builderTransitions.ts";
import type { InventoryItem } from "../src/types/character.ts";

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

  // Rogue grants: Light armor, Thieves' tools, 1 skill from Rogue skill list
  const rogueSkillsChoice = wizardRogue.skillChoices?.find((sc) => sc.id.includes("rogue"));
  assert.ok(rogueSkillsChoice, "Expected Rogue skill choice entry");
  assert.equal(rogueSkillsChoice?.choose, 1);
  assert.ok(rogueSkillsChoice?.from.includes("Stealth"));
  assert.ok(!rogueSkillsChoice?.from.includes("Religion")); // Not a rogue skill

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

test("setCustomBackground sets background to Custom and configures chosen skills", () => {
  const initial = makeChar({
    chosenSkills: ["Athletics"],
  });

  const custom = setCustomBackground(initial, "Gladiator", ["Acrobatics", "Performance"]);
  assert.deepEqual(custom.background, {
    name: "Gladiator",
    source: "Custom",
  });
  assert.ok(custom.chosenSkills.includes("Acrobatics"));
  assert.ok(custom.chosenSkills.includes("Performance"));
  assert.ok(custom.chosenSkills.includes("Athletics")); // Retains existing non-background skills

  // Replacing custom background cleanly replaces prior custom background skills
  const changed = setCustomBackground(custom, "Sage", ["Arcana", "History"]);
  assert.equal(changed.background?.name, "Sage");
  assert.ok(changed.chosenSkills.includes("Arcana"));
  assert.ok(changed.chosenSkills.includes("History"));
  assert.ok(changed.chosenSkills.includes("Athletics"));
  assert.ok(!changed.chosenSkills.includes("Acrobatics"));
  assert.ok(!changed.chosenSkills.includes("Performance"));
});

test("applyBackgroundGrants grants coins, equipment items, and skills from background", () => {
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
  assert.ok(granted.chosenSkills.includes("Insight"));
  assert.ok(granted.chosenSkills.includes("Religion"));
  assert.ok(granted.chosenSkills.includes("Athletics"));

  // Idempotent
  const again = applyBackgroundGrants(granted, bgData as any);
  assert.equal(again.pouch?.gp, 15);
  assert.equal(again.items.length, granted.items.length);
});

test("setLanguages updates character.languages", () => {
  const char = makeChar({});
  const updated = setLanguages(char, ["Common", "Elvish", "Draconic"]);
  assert.deepEqual(updated.languages, ["Common", "Elvish", "Draconic"]);
});

