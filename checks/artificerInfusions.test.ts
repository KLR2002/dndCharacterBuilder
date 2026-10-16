import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import { makeChar } from "./testUtils.ts";
import {
  artificerInfusionChoices,
  getKnownInfusions,
  getMaxActiveInfusions,
  hasInfusion,
  isInfusionChoiceId,
  pickSubclassRuleChoice,
  subclassRuleChoices,
  availableSubclassRuleChoices,
  ALL_ARTIFICER_INFUSIONS,
} from "../src/rules/ruleChoices.ts";
import { armorClass } from "../src/rules/ac.ts";
import { getWeaponAttacks, checkDualWielding } from "../src/rules/attacks.ts";
import { teardownSubclass } from "../src/rules/characterReconciler.ts";
import type { InventoryItem } from "../src/types/character.ts";

test("Known infusions capacity scales across levels (4 at 2, 6 at 6, 8 at 10, 10 at 14, 12 at 18)", () => {
  // Level 1: 0 choices
  const art1 = makeChar({
    classes: [{ className: "Artificer", level: 1, hitDiceType: "d8" }],
  });
  assert.equal(artificerInfusionChoices(art1).length, 0);

  // Level 2: 1 slot (choose 4) -> total 4
  const art2 = makeChar({
    classes: [{ className: "Artificer", level: 2, hitDiceType: "d8" }],
  });
  const c2 = artificerInfusionChoices(art2);
  assert.equal(c2.length, 1);
  assert.equal(c2[0].id, "TCE__Artificer__Infusions 2");
  assert.equal(c2[0].choose, 4);
  assert.equal(c2[0].traitName, "Infusions Known (2nd Level)");

  // Level 6: 2 slots (choose 4 + choose 2) -> total 6
  const art6 = makeChar({
    classes: [{ className: "Artificer", level: 6, hitDiceType: "d8" }],
  });
  const c6 = artificerInfusionChoices(art6);
  assert.equal(c6.length, 2);
  assert.equal(c6.reduce((acc, cur) => acc + cur.choose, 0), 6);
  assert.equal(c6[1].id, "TCE__Artificer__Infusions 6");
  assert.equal(c6[1].choose, 2);

  // Level 10: 3 slots (4 + 2 + 2) -> total 8
  const art10 = makeChar({
    classes: [{ className: "Artificer", level: 10, hitDiceType: "d8" }],
  });
  const c10 = artificerInfusionChoices(art10);
  assert.equal(c10.length, 3);
  assert.equal(c10.reduce((acc, cur) => acc + cur.choose, 0), 8);
  assert.equal(c10[2].id, "TCE__Artificer__Infusions 10");
  assert.equal(c10[2].choose, 2);

  // Level 14: 4 slots (4 + 2 + 2 + 2) -> total 10
  const art14 = makeChar({
    classes: [{ className: "Artificer", level: 14, hitDiceType: "d8" }],
  });
  const c14 = artificerInfusionChoices(art14);
  assert.equal(c14.length, 4);
  assert.equal(c14.reduce((acc, cur) => acc + cur.choose, 0), 10);
  assert.equal(c14[3].id, "TCE__Artificer__Infusions 14");
  assert.equal(c14[3].choose, 2);

  // Level 18: 5 slots (4 + 2 + 2 + 2 + 2) -> total 12
  const art18 = makeChar({
    classes: [{ className: "Artificer", level: 18, hitDiceType: "d8" }],
  });
  const c18 = artificerInfusionChoices(art18);
  assert.equal(c18.length, 5);
  assert.equal(c18.reduce((acc, cur) => acc + cur.choose, 0), 12);
  assert.equal(c18[4].id, "TCE__Artificer__Infusions 18");
  assert.equal(c18[4].choose, 2);
});

test("Higher-tier infusions are locked at lower levels and unlock at corresponding milestone levels", () => {
  // Level 2: Radiant Weapon (lvl 6), Helm of Awareness (lvl 10), Arcane Propulsion Armor (lvl 14) locked
  const art2 = makeChar({
    classes: [{ className: "Artificer", level: 2, hitDiceType: "d8" }],
  });
  const choices2 = artificerInfusionChoices(art2);
  const options2 = choices2[0].options.map((o) => o.name);

  assert.ok(options2.includes("Enhanced Defense"));
  assert.ok(options2.includes("Enhanced Weapon"));
  assert.ok(options2.includes("Repeating Shot"));
  assert.ok(options2.includes("Replicate Magic Item: Bag of Holding"));
  assert.ok(!options2.includes("Radiant Weapon"), "Radiant Weapon should be locked at level 2");
  assert.ok(!options2.includes("Repulsion Shield"), "Repulsion Shield should be locked at level 2");
  assert.ok(!options2.includes("Helm of Awareness"), "Helm of Awareness should be locked at level 2");
  assert.ok(!options2.includes("Arcane Propulsion Armor"), "Arcane Propulsion Armor should be locked at level 2");
  assert.ok(!options2.includes("Replicate Magic Item: Boots of Elvenkind"), "6th level replicate item locked at level 2");

  // Level 6: Radiant Weapon and Repulsion Shield unlocked; Helm of Awareness and Arcane Propulsion Armor locked
  const art6 = makeChar({
    classes: [{ className: "Artificer", level: 6, hitDiceType: "d8" }],
  });
  const choices6 = artificerInfusionChoices(art6);
  const allOptions6 = choices6.flatMap((c) => c.options.map((o) => o.name));
  assert.ok(allOptions6.includes("Radiant Weapon"), "Radiant Weapon unlocked at level 6");
  assert.ok(allOptions6.includes("Repulsion Shield"), "Repulsion Shield unlocked at level 6");
  assert.ok(allOptions6.includes("Replicate Magic Item: Boots of Elvenkind"), "6th level replicate item unlocked");
  assert.ok(!allOptions6.includes("Helm of Awareness"), "Helm of Awareness locked at level 6");
  assert.ok(!allOptions6.includes("Arcane Propulsion Armor"), "Arcane Propulsion Armor locked at level 6");

  // Level 10: Helm of Awareness unlocked; Arcane Propulsion Armor locked
  const art10 = makeChar({
    classes: [{ className: "Artificer", level: 10, hitDiceType: "d8" }],
  });
  const choices10 = artificerInfusionChoices(art10);
  const allOptions10 = choices10.flatMap((c) => c.options.map((o) => o.name));
  assert.ok(allOptions10.includes("Helm of Awareness"), "Helm of Awareness unlocked at level 10");
  assert.ok(allOptions10.includes("Replicate Magic Item: Boots of Striding and Springing"), "10th level replicate unlocked");
  assert.ok(!allOptions10.includes("Arcane Propulsion Armor"), "Arcane Propulsion Armor locked at level 10");

  // Level 14: Arcane Propulsion Armor unlocked
  const art14 = makeChar({
    classes: [{ className: "Artificer", level: 14, hitDiceType: "d8" }],
  });
  const choices14 = artificerInfusionChoices(art14);
  const allOptions14 = choices14.flatMap((c) => c.options.map((o) => o.name));
  assert.ok(allOptions14.includes("Arcane Propulsion Armor"), "Arcane Propulsion Armor unlocked at level 14");
  assert.ok(allOptions14.includes("Replicate Magic Item: Amulet of Health"), "14th level replicate unlocked");
});

test("Replicate Magic Item multi-instance selection (can pick Bag of Holding AND Goggles of Night)", () => {
  let char = makeChar({
    classes: [{ className: "Artificer", level: 2, hitDiceType: "d8" }],
  });

  const choice = artificerInfusionChoices(char)[0];
  // Pick Bag of Holding
  char = pickSubclassRuleChoice(char, choice, "Replicate Magic Item: Bag of Holding");
  // Pick Goggles of Night
  char = pickSubclassRuleChoice(char, choice, "Replicate Magic Item: Goggles of Night");
  // Pick Enhanced Defense
  char = pickSubclassRuleChoice(char, choice, "Enhanced Defense");

  const known = getKnownInfusions(char);
  assert.ok(known.includes("Replicate Magic Item: Bag of Holding"));
  assert.ok(known.includes("Replicate Magic Item: Goggles of Night"));
  assert.ok(known.includes("Enhanced Defense"));
  assert.equal(known.length, 3);

  // Dynamic cross-slot deduplication:
  // If character levels to 6, milestone slot 6 excludes items already picked in slot 2
  char = {
    ...char,
    classes: [{ className: "Artificer", level: 6, hitDiceType: "d8" }],
  };
  const choices6 = artificerInfusionChoices(char);
  const slot6 = choices6.find((c) => c.id === "TCE__Artificer__Infusions 6")!;
  const slot6OptionNames = slot6.options.map((o) => o.name);

  assert.ok(!slot6OptionNames.includes("Replicate Magic Item: Bag of Holding"), "Already picked Bag of Holding excluded from slot 6");
  assert.ok(!slot6OptionNames.includes("Replicate Magic Item: Goggles of Night"), "Already picked Goggles of Night excluded from slot 6");
  assert.ok(!slot6OptionNames.includes("Enhanced Defense"), "Already picked Enhanced Defense excluded from slot 6");
  assert.ok(slot6OptionNames.includes("Replicate Magic Item: Alchemy Jug"), "Unpicked Alchemy Jug available in slot 6");
});

test("Max active infusions limit (2 at 2, 3 at 6, 4 at 10, 5 at 14, 6 at 18; +2 for Armorer 9)", () => {
  // Non-artificer
  const nonArt = makeChar({ classes: [{ className: "Fighter", level: 5 }] });
  assert.equal(getMaxActiveInfusions(nonArt), 0);

  // Artificer Level 1
  const art1 = makeChar({ classes: [{ className: "Artificer", level: 1 }] });
  assert.equal(getMaxActiveInfusions(art1), 0);

  // Artificer Level 2
  const art2 = makeChar({ classes: [{ className: "Artificer", level: 2 }] });
  assert.equal(getMaxActiveInfusions(art2), 2);

  // Artificer Level 6
  const art6 = makeChar({ classes: [{ className: "Artificer", level: 6 }] });
  assert.equal(getMaxActiveInfusions(art6), 3);

  // Artificer Level 8
  const art8 = makeChar({ classes: [{ className: "Artificer", level: 8 }] });
  assert.equal(getMaxActiveInfusions(art8), 3);

  // Artificer Level 9 (Non-Armorer)
  const art9Alchemist = makeChar({
    classes: [{ className: "Artificer", level: 9, subclassName: "Alchemist" }],
  });
  assert.equal(getMaxActiveInfusions(art9Alchemist), 3);

  // Artificer Level 9 (Armorer gets +2)
  const art9Armorer = makeChar({
    classes: [{ className: "Artificer", level: 9, subclassName: "Armorer" }],
  });
  assert.equal(getMaxActiveInfusions(art9Armorer), 5); // 3 + 2 = 5

  // Artificer Level 10 (Non-Armorer)
  const art10 = makeChar({ classes: [{ className: "Artificer", level: 10 }] });
  assert.equal(getMaxActiveInfusions(art10), 4);

  // Artificer Level 10 (Armorer gets +2)
  const art10Armorer = makeChar({
    classes: [{ className: "Artificer", level: 10, subclassName: "Armorer" }],
  });
  assert.equal(getMaxActiveInfusions(art10Armorer), 6); // 4 + 2 = 6

  // Artificer Level 14
  const art14 = makeChar({ classes: [{ className: "Artificer", level: 14 }] });
  assert.equal(getMaxActiveInfusions(art14), 5);

  // Artificer Level 14 Armorer
  const art14Armorer = makeChar({
    classes: [{ className: "Artificer", level: 14, subclassName: "Armorer" }],
  });
  assert.equal(getMaxActiveInfusions(art14Armorer), 7); // 5 + 2 = 7

  // Artificer Level 18
  const art18 = makeChar({ classes: [{ className: "Artificer", level: 18 }] });
  assert.equal(getMaxActiveInfusions(art18), 6);

  // Artificer Level 18 Armorer
  const art18Armorer = makeChar({
    classes: [{ className: "Artificer", level: 18, subclassName: "Armorer" }],
  });
  assert.equal(getMaxActiveInfusions(art18Armorer), 8); // 6 + 2 = 8
});

test("Enhanced Defense grants +1 AC at levels 2-9 and +2 AC at level 10+", () => {
  const chainMail: InventoryItem = {
    id: "armor_1",
    name: "Chain Mail",
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
    ac: 16,
    weight: 55,
  };

  // Level 2 Artificer with Enhanced Defense on armor
  const art2 = makeChar({
    classes: [{ className: "Artificer", level: 2 }],
    items: [chainMail],
    activeInfusions: [{ infusionName: "Enhanced Defense", targetItemId: "armor_1" }],
  });

  const ac2 = armorClass(art2);
  assert.equal(ac2.ac, 17); // 16 + 1
  assert.ok(ac2.breakdown.includes("+ 1 (Enhanced Defense)"));

  // Level 10 Artificer with Enhanced Defense on armor (+2 AC)
  const art10 = makeChar({
    classes: [{ className: "Artificer", level: 10 }],
    items: [chainMail],
    activeInfusions: [{ infusionName: "Enhanced Defense", targetItemId: "armor_1" }],
  });

  const ac10 = armorClass(art10);
  assert.equal(ac10.ac, 18); // 16 + 2
  assert.ok(ac10.breakdown.includes("+ 2 (Enhanced Defense)"));

  // Enhanced Defense via item.infusedWith
  const artDirectItem = makeChar({
    classes: [{ className: "Artificer", level: 10 }],
    items: [{ ...chainMail, infusedWith: "Enhanced Defense" }],
  });
  const acDirect = armorClass(artDirectItem);
  assert.equal(acDirect.ac, 18);
  assert.ok(acDirect.breakdown.includes("+ 2 (Enhanced Defense)"));
});

test("Enhanced Defense and Repulsion Shield on shield", () => {
  const shield: InventoryItem = {
    id: "shield_1",
    name: "Shield",
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
    ac: 2,
    weight: 6,
  };

  // Enhanced Defense on shield (unarmored character)
  const art2 = makeChar({
    baseAbilityScores: { str: 10, dex: 14, con: 10, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Artificer", level: 2 }],
    items: [shield],
    activeInfusions: [{ infusionName: "Enhanced Defense", targetItemId: "shield_1" }],
  });

  const ac2 = armorClass(art2);
  // Base 10 + Dex 2 + Shield 2 + Enhanced Defense 1 = 15
  assert.equal(ac2.ac, 15);
  assert.ok(ac2.breakdown.includes("+ 1 (Enhanced Defense)"));

  // Repulsion Shield on shield
  const artRepulsion = makeChar({
    baseAbilityScores: { str: 10, dex: 14, con: 10, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Artificer", level: 6 }],
    items: [shield],
    activeInfusions: [{ infusionName: "Repulsion Shield", targetItemId: "shield_1" }],
  });

  const acRep = armorClass(artRepulsion);
  // Base 10 + Dex 2 + Shield 2 + Repulsion Shield 1 = 15
  assert.equal(acRep.ac, 15);
  assert.ok(acRep.breakdown.includes("+ 1 (Repulsion Shield)"));

  // Enhanced Defense on armor AND Repulsion Shield on shield
  const chainMail: InventoryItem = {
    id: "armor_1",
    name: "Chain Mail",
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
    ac: 16,
    weight: 55,
  };

  const artBoth = makeChar({
    classes: [{ className: "Artificer", level: 10 }],
    items: [chainMail, shield],
    activeInfusions: [
      { infusionName: "Enhanced Defense", targetItemId: "armor_1" },
      { infusionName: "Repulsion Shield", targetItemId: "shield_1" },
    ],
  });

  const acBoth = armorClass(artBoth);
  // 16 (armor) + 2 (shield) + 2 (ED lvl 10) + 1 (Repulsion Shield) = 21
  assert.equal(acBoth.ac, 21);
  assert.ok(acBoth.breakdown.includes("+ 2 (Enhanced Defense)"));
  assert.ok(acBoth.breakdown.includes("+ 1 (Repulsion Shield)"));
});

test("Enhanced Weapon grants +1 to attack/damage at levels 2-9 and +2 at level 10+", () => {
  const longsword: InventoryItem = {
    id: "sword_1",
    name: "Longsword",
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
    damage: "1d8",
    damageType: "slashing",
  };

  // Level 2 Artificer with Str 16 (+3), PB +2
  const art2 = makeChar({
    baseAbilityScores: { str: 16, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
    classes: [{ className: "Artificer", level: 2 }],
    items: [longsword],
    activeInfusions: [{ infusionName: "Enhanced Weapon", targetItemId: "sword_1" }],
  });

  const attacks2 = getWeaponAttacks(art2);
  assert.equal(attacks2.length, 1);
  // Str +3, Enhanced Weapon +1 -> attack bonus without prof = 4, with prof = 6
  // (Artificer is proficient with simple weapons; if proficient with longsword or test checks toHit):
  assert.equal(attacks2[0].damageString, "1d8 + 4"); // 3 (Str) + 1 (Enhanced Weapon) = 4
  assert.deepEqual(attacks2[0].calculationBadges, ["Infused +1"]);
  assert.equal(attacks2[0].infusionBonus, 1);

  // Level 10 Artificer with Str 16 (+3), PB +4 -> +2 attack and damage
  const art10 = makeChar({
    baseAbilityScores: { str: 16, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
    classes: [{ className: "Artificer", level: 10 }],
    items: [longsword],
    activeInfusions: [{ infusionName: "Enhanced Weapon", targetItemId: "sword_1" }],
  });

  const attacks10 = getWeaponAttacks(art10);
  assert.equal(attacks10.length, 1);
  assert.equal(attacks10[0].damageString, "1d8 + 5"); // 3 (Str) + 2 (Enhanced Weapon lvl 10) = 5
  assert.deepEqual(attacks10[0].calculationBadges, ["Infused +2"]);
  assert.equal(attacks10[0].infusionBonus, 2);
});

test("Repeating Shot and Radiant Weapon grant +1 to attack and damage", () => {
  const heavyCrossbow: InventoryItem = {
    id: "xbow_1",
    name: "Heavy Crossbow",
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
    damage: "1d10",
    damageType: "piercing",
    range: "100/400",
  };

  const artRepeating = makeChar({
    baseAbilityScores: { str: 10, dex: 16, con: 10, int: 14, wis: 10, cha: 10 },
    classes: [{ className: "Artificer", level: 2 }],
    items: [heavyCrossbow],
    activeInfusions: [{ infusionName: "Repeating Shot", targetItemId: "xbow_1" }],
  });

  const attacksRep = getWeaponAttacks(artRepeating);
  assert.equal(attacksRep.length, 1);
  assert.equal(attacksRep[0].damageString, "1d10 + 4"); // Dex +3 + 1

  const mace: InventoryItem = {
    id: "mace_1",
    name: "Mace",
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
    damage: "1d6",
    damageType: "bludgeoning",
  };

  const artRadiant = makeChar({
    baseAbilityScores: { str: 14, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
    classes: [{ className: "Artificer", level: 6 }],
    items: [mace],
    activeInfusions: [{ infusionName: "Radiant Weapon", targetItemId: "mace_1" }],
  });

  const attacksRad = getWeaponAttacks(artRadiant);
  assert.equal(attacksRad.length, 1);
  assert.equal(attacksRad[0].damageString, "1d6 + 3"); // Str +2 + 1
});

test("Dual wielding with an infused off-hand weapon", () => {
  const shortsword1: InventoryItem = {
    id: "sw_1",
    name: "Shortsword",
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
    damage: "1d6",
    damageType: "piercing",
  };
  const shortsword2: InventoryItem = {
    id: "sw_2",
    name: "Shortsword",
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
    damage: "1d6",
    damageType: "piercing",
  };

  const char = makeChar({
    baseAbilityScores: { str: 10, dex: 16, con: 10, int: 14, wis: 10, cha: 10 },
    classes: [{ className: "Artificer", level: 2 }],
    items: [shortsword1, shortsword2],
    activeInfusions: [{ infusionName: "Enhanced Weapon", targetItemId: "sw_2" }],
  });

  const dual = checkDualWielding(char);
  assert.ok(dual.isDualWielding);
  assert.ok(dual.offHand);
  // Off-hand has ability penalty (no TWF style), but gets +1 from Enhanced Weapon
  assert.equal(dual.offHand.damageString, "1d6 + 1");
});

test("Pruning on de-leveling cleans up invalid known and active infusions", () => {
  // Start with level 14 Artificer having multiple slots and active infusions
  let char = makeChar({
    classes: [{ className: "Artificer", level: 14 }],
    ruleChoices: [
      {
        id: "TCE__Artificer__Infusions 2",
        trait: "Infusions Known (2nd Level)",
        choose: 4,
        from: [],
        picked: [
          "Enhanced Defense",
          "Enhanced Weapon",
          "Replicate Magic Item: Bag of Holding",
          "Mind Sharpener",
        ],
      },
      {
        id: "TCE__Artificer__Infusions 6",
        trait: "Infusions Known (6th Level)",
        choose: 2,
        from: [],
        picked: ["Radiant Weapon", "Repulsion Shield"],
      },
      {
        id: "TCE__Artificer__Infusions 10",
        trait: "Infusions Known (10th Level)",
        choose: 2,
        from: [],
        picked: ["Helm of Awareness", "Replicate Magic Item: Winged Boots"],
      },
      {
        id: "TCE__Artificer__Infusions 14",
        trait: "Infusions Known (14th Level)",
        choose: 2,
        from: [],
        picked: ["Arcane Propulsion Armor", "Replicate Magic Item: Amulet of Health"],
      },
    ],
    activeInfusions: [
      { infusionName: "Enhanced Defense", targetItemId: "armor_1" },
      { infusionName: "Enhanced Weapon", targetItemId: "sword_1" },
      { infusionName: "Radiant Weapon", targetItemId: "sword_2" },
      { infusionName: "Helm of Awareness", targetItemId: "helm_1" },
      { infusionName: "Arcane Propulsion Armor", targetItemId: "armor_2" },
    ],
    items: [
      { id: "armor_1", name: "Plate Armor", source: "PHB", quantity: 1, isEquipped: true, section: "equipped", infusedWith: "Enhanced Defense", isInfused: true },
      { id: "sword_1", name: "Longsword", source: "PHB", quantity: 1, isEquipped: true, section: "equipped", infusedWith: "Enhanced Weapon", isInfused: true },
      { id: "sword_2", name: "Dagger", source: "PHB", quantity: 1, isEquipped: true, section: "equipped", infusedWith: "Radiant Weapon", isInfused: true },
      { id: "helm_1", name: "Helmet", source: "PHB", quantity: 1, isEquipped: true, section: "equipped", infusedWith: "Helm of Awareness", isInfused: true },
      { id: "rep_bag", name: "Bag of Holding", source: "TCE", quantity: 1, isEquipped: false, section: "carried", infusedWith: "Replicate Magic Item: Bag of Holding", isInfused: true },
    ],
  });

  // Delevel Artificer from 14 to 5
  char = {
    ...char,
    classes: [{ className: "Artificer", level: 5 }],
  };

  const pruned = reconcile(char, currentCompendium());

  // Slots 6, 10, 14 are removed; only slot 2 remains
  const remainingIds = (pruned.ruleChoices || []).map((rc) => rc.id);
  assert.ok(remainingIds.includes("TCE__Artificer__Infusions 2"));
  assert.ok(!remainingIds.includes("TCE__Artificer__Infusions 6"));
  assert.ok(!remainingIds.includes("TCE__Artificer__Infusions 10"));
  assert.ok(!remainingIds.includes("TCE__Artificer__Infusions 14"));

  // Max active infusions at level 5 is 2
  assert.ok(pruned.activeInfusions);
  assert.equal(pruned.activeInfusions.length, 2);

  // Active infusions only keep known ones
  const known = getKnownInfusions(pruned);
  for (const act of pruned.activeInfusions) {
    assert.ok(known.includes(act.infusionName));
  }

  // Needs review has notices
  assert.ok(pruned.needsReview && pruned.needsReview.length > 0);

  // Deleveling completely to level 1 drops all infusions
  const zeroArt = reconcile({
    ...pruned,
    classes: [{ className: "Artificer", level: 1 }],
  }, currentCompendium());
  assert.equal((zeroArt.ruleChoices || []).filter((rc) => isInfusionChoiceId(rc.id)).length, 0);
  assert.equal(zeroArt.activeInfusions, undefined);
});

test("Active books gating for Artificer infusions", () => {
  const art = makeChar({
    classes: [{ className: "Artificer", level: 6 }],
  });

  // When TCE is active (or default undefined)
  assert.ok(artificerInfusionChoices(art).length > 0);
  assert.ok(artificerInfusionChoices(art, ["PHB", "TCE"]).length > 0);

  // When only PHB is active (TCE missing)
  assert.equal(artificerInfusionChoices(art, ["PHB"]).length, 0);
});

test("Integration with subclassRuleChoices and availableSubclassRuleChoices", () => {
  const art2 = makeChar({
    classes: [{ className: "Artificer", level: 2 }],
  });

  const subChoices = subclassRuleChoices(art2);
  assert.ok(subChoices.some((c) => c.id === "TCE__Artificer__Infusions 2"));

  const avail = availableSubclassRuleChoices(art2, ["PHB", "TCE"]);
  assert.ok(avail.some((c) => c.id === "TCE__Artificer__Infusions 2"));

  const availNoTce = availableSubclassRuleChoices(art2, ["PHB"]);
  assert.ok(!availNoTce.some((c) => c.id === "TCE__Artificer__Infusions 2"));
});

test("teardownSubclass cleans up infusions when losing Artificer levels", () => {
  const char = makeChar({
    classes: [{ className: "Artificer", level: 1, subclassName: "Armorer" }],
    ruleChoices: [
      {
        id: "TCE__Artificer__Infusions 2",
        trait: "Infusions Known (2nd Level)",
        choose: 4,
        from: [],
        picked: ["Enhanced Defense"],
      },
    ],
    activeInfusions: [{ infusionName: "Enhanced Defense" }],
  });

  const tornDown = teardownSubclass(char, "Artificer", "Armorer");
  assert.equal((tornDown.ruleChoices || []).filter((rc) => isInfusionChoiceId(rc.id)).length, 0);
  assert.equal(tornDown.activeInfusions, undefined);
});

test("Canonical unified ID TCE__Artificer__Infusions Known capacity scaling and backward compatibility", () => {
  const levels = [2, 6, 10, 14, 18];
  const expectedCapacities = [4, 6, 8, 10, 12];

  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i];
    const expected = expectedCapacities[i];
    const char = makeChar({
      classes: [{ className: "Artificer", level: lvl, hitDiceType: "d8" }],
    });

    const unified = artificerInfusionChoices(char, undefined, true);
    assert.equal(unified.length, 1);
    assert.equal(unified[0].id, "TCE__Artificer__Infusions Known");
    assert.equal(unified[0].choose, expected);
    assert.equal(unified[0].traitName, "Infusions Known");
  }

  // Pre-level 2 yields 0 choices even when requesting unified
  const char1 = makeChar({
    classes: [{ className: "Artificer", level: 1, hitDiceType: "d8" }],
  });
  assert.equal(artificerInfusionChoices(char1, undefined, true).length, 0);

  // Character already having TCE__Artificer__Infusions Known automatically returns it
  const charWithUnified = makeChar({
    classes: [{ className: "Artificer", level: 6, hitDiceType: "d8" }],
    ruleChoices: [
      {
        id: "TCE__Artificer__Infusions Known",
        trait: "Infusions Known",
        choose: 6,
        options: [],
        picked: ["Enhanced Defense", "Enhanced Weapon", "Radiant Weapon"],
        origin: "class",
      },
    ],
  });

  const choices = artificerInfusionChoices(charWithUnified);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].id, "TCE__Artificer__Infusions Known");
  assert.equal(choices[0].choose, 6);

  // Deleveling from 6 to 2 prunes Radiant Weapon (requires level 6) and caps at 4
  const deleveled = makeChar({
    ...charWithUnified,
    classes: [{ className: "Artificer", level: 2, hitDiceType: "d8" }],
  });
  const pruned = reconcile(deleveled, currentCompendium());
  const entry = pruned.ruleChoices?.find((rc) => rc.id === "TCE__Artificer__Infusions Known");
  assert.ok(entry);
  assert.equal(entry.choose, 4);
  assert.deepEqual(entry.picked, ["Enhanced Defense", "Enhanced Weapon"]);
  assert.ok(!entry.picked.includes("Radiant Weapon"));
});

