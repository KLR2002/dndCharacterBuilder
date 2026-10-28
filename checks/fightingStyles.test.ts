import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import {
  availableSubclassRuleChoices,
  hasFightingStyle,
  fightingStyleRuleChoices,
  pickFightingStyleChoice,
} from "../src/rules/ruleChoices.ts";
import type { ClassData, OptionFeatureData } from "../src/types/dnd5e.ts";
import { getWeaponAttacks, checkDualWielding } from "../src/rules/attacks.ts";
import { armorClass } from "../src/rules/ac.ts";
import type { InventoryItem } from "../src/types/character.ts";

function weapon(id: string, name: string, overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id,
    name,
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
    ...overrides,
  };
}

function armor(id: string, name: string, ac: number, overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id,
    name,
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
    ac,
    ...overrides,
  };
}

test("Fighter 1, Paladin 2, Ranger 2 style option lists match 2014 RAW (PHB only)", () => {
  const f1 = makeChar({ classes: [{ className: "Fighter", level: 1, hitDiceType: "d10" }] });
  const fChoices = fightingStyleRuleChoices(f1, ["PHB"]);
  assert.equal(fChoices.length, 1);
  assert.equal(fChoices[0].id, "PHB__Fighter__Fighting Style");
  assert.equal(fChoices[0].choose, 1);
  assert.deepEqual(
    fChoices[0].options.map((o) => o.name),
    ["Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting"]
  );

  const pal2 = makeChar({ classes: [{ className: "Paladin", level: 2, hitDiceType: "d10" }] });
  const palChoices = fightingStyleRuleChoices(pal2, ["PHB"]);
  assert.equal(palChoices.length, 1);
  assert.equal(palChoices[0].id, "PHB__Paladin__Fighting Style");
  assert.deepEqual(
    palChoices[0].options.map((o) => o.name),
    ["Defense", "Dueling", "Great Weapon Fighting", "Protection"]
  );

  const r2 = makeChar({ classes: [{ className: "Ranger", level: 2, hitDiceType: "d10" }] });
  const rChoices = fightingStyleRuleChoices(r2, ["PHB"]);
  assert.equal(rChoices.length, 1);
  assert.equal(rChoices[0].id, "PHB__Ranger__Fighting Style");
  assert.deepEqual(
    rChoices[0].options.map((o) => o.name),
    ["Archery", "Defense", "Dueling", "Two-Weapon Fighting"]
  );

  const b3 = makeChar({
    classes: [{ className: "Bard", level: 3, hitDiceType: "d8", subclassName: "College of Swords" }],
  });
  const bChoices = fightingStyleRuleChoices(b3, ["PHB", "XGE"]);
  assert.equal(bChoices.length, 1);
  assert.equal(bChoices[0].id, "XGE__Bard__College of Swords__Fighting Style");
  assert.deepEqual(
    bChoices[0].options.map((o) => o.name),
    ["Dueling", "Two-Weapon Fighting"]
  );

  // Level gating
  const f0 = makeChar({ classes: [{ className: "Fighter", level: 0, hitDiceType: "d10" }] });
  assert.equal(fightingStyleRuleChoices(f0).length, 0);

  const pal1 = makeChar({ classes: [{ className: "Paladin", level: 1, hitDiceType: "d10" }] });
  assert.equal(fightingStyleRuleChoices(pal1).length, 0);

  const r1 = makeChar({ classes: [{ className: "Ranger", level: 1, hitDiceType: "d10" }] });
  assert.equal(fightingStyleRuleChoices(r1).length, 0);

  const b2 = makeChar({
    classes: [{ className: "Bard", level: 2, hitDiceType: "d8", subclassName: "College of Swords" }],
  });
  assert.equal(fightingStyleRuleChoices(b2).length, 0);
});

test("Fighter, Paladin, Ranger style options with TCoE enabled include expanded styles", () => {
  const f1 = makeChar({ classes: [{ className: "Fighter", level: 1, hitDiceType: "d10" }] });
  const fStyles = fightingStyleRuleChoices(f1, ["PHB", "TCE"])[0].options.map((o) => o.name);
  assert.ok(fStyles.includes("Blind Fighting"));
  assert.ok(fStyles.includes("Interception"));
  assert.ok(fStyles.includes("Superior Technique"));
  assert.ok(fStyles.includes("Thrown Weapon Fighting"));
  assert.ok(fStyles.includes("Unarmed Fighting"));
  assert.equal(fStyles.length, 11);

  const pal2 = makeChar({ classes: [{ className: "Paladin", level: 2, hitDiceType: "d10" }] });
  const palStyles = fightingStyleRuleChoices(pal2, ["PHB", "TCE"])[0].options.map((o) => o.name);
  assert.ok(palStyles.includes("Blessed Warrior"));
  assert.ok(palStyles.includes("Blind Fighting"));
  assert.ok(palStyles.includes("Interception"));
  assert.equal(palStyles.length, 7);

  const r2 = makeChar({ classes: [{ className: "Ranger", level: 2, hitDiceType: "d10" }] });
  const rStyles = fightingStyleRuleChoices(r2, ["PHB", "TCE"])[0].options.map((o) => o.name);
  assert.ok(rStyles.includes("Druidic Warrior"));
  assert.ok(rStyles.includes("Blind Fighting"));
  assert.ok(rStyles.includes("Thrown Weapon Fighting"));
  assert.equal(rStyles.length, 7);
});

test("Multiclass Fighter 1 / Paladin 2 deduplication: Defense chosen at Fighter 1 is not offered at Paladin 2", () => {
  const mcChar = makeChar({
    classes: [
      { className: "Fighter", level: 1, hitDiceType: "d10" },
      { className: "Paladin", level: 2, hitDiceType: "d10" },
    ],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting"],
        picked: ["Defense"],
      },
    ],
  });

  const choices = fightingStyleRuleChoices(mcChar, ["PHB"]);
  assert.equal(choices.length, 2);

  const fighterChoice = choices.find((c) => c.id === "PHB__Fighter__Fighting Style")!;
  const paladinChoice = choices.find((c) => c.id === "PHB__Paladin__Fighting Style")!;

  // Defense is present in Fighter's own options (since it is Fighter's own pick)
  assert.ok(fighterChoice.options.some((o) => o.name === "Defense"));

  // Defense is EXCLUDED from Paladin's options
  assert.ok(!paladinChoice.options.some((o) => o.name === "Defense"));
  assert.deepEqual(
    paladinChoice.options.map((o) => o.name),
    ["Dueling", "Great Weapon Fighting", "Protection"]
  );

  assert.equal(hasFightingStyle(mcChar, "Defense"), true);
  assert.equal(hasFightingStyle(mcChar, "Dueling"), false);
});

test("Champion 10 Additional Fighting Style excludes 1st-level choice", () => {
  const champ = makeChar({
    classes: [
      { className: "Fighter", level: 10, hitDiceType: "d10", subclassName: "Champion" },
    ],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting"],
        picked: ["Archery"],
      },
    ],
  });

  const choices = fightingStyleRuleChoices(champ, ["PHB"]);
  assert.equal(choices.length, 2);

  const lvl10Choice = choices.find((c) => c.id === "PHB__Fighter__Additional Fighting Style 10")!;
  assert.equal(lvl10Choice.traitName, "Additional Fighting Style");
  assert.ok(!lvl10Choice.options.some((o) => o.name === "Archery"));
  assert.deepEqual(
    lvl10Choice.options.map((o) => o.name),
    ["Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting"]
  );
});

test("Blessed Warrior grants 2 cantrips and synchronizes into knownSpells with Charisma and Paladin__TCE", () => {
  let char = makeChar({
    classes: [{ className: "Paladin", level: 2, hitDiceType: "d10" }],
    ruleChoices: [
      {
        id: "PHB__Paladin__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Blessed Warrior", "Defense", "Dueling"],
        picked: ["Blessed Warrior"],
      },
    ],
  });

  const choices = fightingStyleRuleChoices(char);
  const bwCantripsChoice = choices.find((c) => c.id === "TCE__Paladin__Blessed Warrior Cantrips");
  assert.ok(bwCantripsChoice);
  assert.equal(bwCantripsChoice.choose, 2);
  assert.ok(bwCantripsChoice.options.some((o) => o.name === "Guidance"));
  assert.ok(bwCantripsChoice.options.some((o) => o.name === "Sacred Flame"));

  // Pick 2 cantrips: Guidance and Sacred Flame
  char = pickFightingStyleChoice(char, bwCantripsChoice, "Guidance");
  char = pickFightingStyleChoice(char, bwCantripsChoice, "Sacred Flame");

  const bwSpells = (char.knownSpells || []).filter((k) => k.ownerKey === "Paladin__TCE");
  assert.equal(bwSpells.length, 2);
  assert.equal(bwSpells[0].name, "Guidance");
  assert.equal(bwSpells[0].ability, "cha");
  assert.equal(bwSpells[0].className, "Paladin");
  assert.equal(bwSpells[1].name, "Sacred Flame");
  assert.equal(bwSpells[1].ability, "cha");
  assert.equal(bwSpells[1].className, "Paladin");

  // When Blessed Warrior style is changed to Defense, cantrips and sub-choice are cleaned up
  const palStyleChoice = choices.find((c) => c.id === "PHB__Paladin__Fighting Style")!;
  char = pickFightingStyleChoice(char, palStyleChoice, "Defense");

  assert.equal(hasFightingStyle(char, "Blessed Warrior"), false);
  assert.equal(hasFightingStyle(char, "Defense"), true);
  assert.ok(!char.ruleChoices?.some((rc) => rc.id === "TCE__Paladin__Blessed Warrior Cantrips"));
  assert.equal((char.knownSpells || []).filter((k) => k.ownerKey === "Paladin__TCE").length, 0);
});

test("Druidic Warrior grants 2 cantrips and synchronizes into knownSpells with Wisdom and Ranger__TCE", () => {
  let char = makeChar({
    classes: [{ className: "Ranger", level: 2, hitDiceType: "d10" }],
    ruleChoices: [
      {
        id: "PHB__Ranger__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Druidic Warrior", "Defense", "Archery"],
        picked: ["Druidic Warrior"],
      },
    ],
  });

  const choices = fightingStyleRuleChoices(char);
  const dwCantripsChoice = choices.find((c) => c.id === "TCE__Ranger__Druidic Warrior Cantrips");
  assert.ok(dwCantripsChoice);
  assert.equal(dwCantripsChoice.choose, 2);
  assert.ok(dwCantripsChoice.options.some((o) => o.name === "Druidcraft"));
  assert.ok(dwCantripsChoice.options.some((o) => o.name === "Shillelagh"));

  // Pick 2 cantrips: Druidcraft and Shillelagh
  char = pickFightingStyleChoice(char, dwCantripsChoice, "Druidcraft");
  char = pickFightingStyleChoice(char, dwCantripsChoice, "Shillelagh");

  const dwSpells = (char.knownSpells || []).filter((k) => k.ownerKey === "Ranger__TCE");
  assert.equal(dwSpells.length, 2);
  assert.equal(dwSpells[0].name, "Druidcraft");
  assert.equal(dwSpells[0].ability, "wis");
  assert.equal(dwSpells[0].className, "Ranger");
  assert.equal(dwSpells[1].name, "Shillelagh");
  assert.equal(dwSpells[1].ability, "wis");
  assert.equal(dwSpells[1].className, "Ranger");

  // When Druidic Warrior style is removed, cantrips are cleaned up
  const rangerStyleChoice = choices.find((c) => c.id === "PHB__Ranger__Fighting Style")!;
  char = pickFightingStyleChoice(char, rangerStyleChoice, "Archery");

  assert.equal(hasFightingStyle(char, "Druidic Warrior"), false);
  assert.equal(hasFightingStyle(char, "Archery"), true);
  assert.ok(!char.ruleChoices?.some((rc) => rc.id === "TCE__Ranger__Druidic Warrior Cantrips"));
  assert.equal((char.knownSpells || []).filter((k) => k.ownerKey === "Ranger__TCE").length, 0);
});

test("Archery grants +2 attack roll bonus to ranged weapon attacks", () => {
  const baseArcher = makeChar({
    classes: [{ className: "Fighter", level: 1, hitDiceType: "d10" }],
    baseAbilityScores: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 }, // Dex mod +3, PB +2 -> +5
    items: [
      weapon("w1", "Longbow", { damage: "1d8", damageType: "piercing" }),
      weapon("w2", "Longsword", { damage: "1d8", damageType: "slashing" }),
    ],
  });

  const withoutArchery = getWeaponAttacks(baseArcher);
  const bowWithout = withoutArchery.find((a) => a.name === "Longbow")!;
  assert.equal(bowWithout.attackBonus, 5);
  assert.equal(bowWithout.toHit, 5);

  const archerChar = makeChar({
    ...baseArcher,
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Archery"],
        picked: ["Archery"],
      },
    ],
  });

  const withArchery = getWeaponAttacks(archerChar);
  const bowWith = withArchery.find((a) => a.name === "Longbow")!;
  const swordWith = withArchery.find((a) => a.name === "Longsword")!;

  assert.equal(bowWith.attackBonus, 7); // +5 + 2 = +7
  assert.equal(bowWith.toHit, 7);
  assert.deepEqual(bowWith.calculationBadges, ["Archery +2"]);
  assert.equal(bowWith.archeryBonus, 2);
  assert.equal(swordWith.attackBonus, 2); // Melee weapon uses Str (+0) + PB (+2) = +2, no Archery bonus
  assert.equal(swordWith.calculationBadges, undefined);
});

test("Defense grants +1 AC while armored and includes breakdown badge", () => {
  const armoredDefender = makeChar({
    classes: [{ className: "Fighter", level: 1, hitDiceType: "d10" }],
    baseAbilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    items: [armor("a1", "Chain Mail", 16)],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Defense"],
        picked: ["Defense"],
      },
    ],
  });

  const acArmored = armorClass(armoredDefender);
  assert.equal(acArmored.ac, 17); // 16 (Chain Mail) + 1 (Defense) = 17
  assert.ok(acArmored.breakdown.includes("+ 1 (Defense)"));

  // Unarmored character does not gain Defense AC
  const unarmoredDefender = makeChar({
    ...armoredDefender,
    items: [],
  });
  const acUnarmored = armorClass(unarmoredDefender);
  assert.equal(acUnarmored.ac, 10);
  assert.ok(!acUnarmored.breakdown.includes("Defense"));

  // Shield only (not worn armor) does not gain Defense AC
  const shieldDefender = makeChar({
    ...armoredDefender,
    items: [armor("s1", "Shield", 2, { armorCategory: "shield" })],
  });
  const acShield = armorClass(shieldDefender);
  assert.equal(acShield.ac, 12); // 10 + 2 (Shield)
  assert.ok(!acShield.breakdown.includes("Defense"));
});

test("Dueling grants +2 damage to single one-handed melee weapon attack", () => {
  const duelist = makeChar({
    classes: [{ className: "Fighter", level: 1, hitDiceType: "d10" }],
    baseAbilityScores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, // Str +3
    items: [
      weapon("w1", "Longsword", { damage: "1d8", damageType: "slashing" }),
      armor("s1", "Shield", 2, { armorCategory: "shield" }), // Shield is allowed!
    ],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Dueling"],
        picked: ["Dueling"],
      },
    ],
  });

  const attacks = getWeaponAttacks(duelist);
  assert.equal(attacks.length, 1);
  assert.equal(attacks[0].name, "Longsword");
  assert.equal(attacks[0].damageString, "1d8 + 5"); // 1d8 + 3 (Str) + 2 (Dueling) = 1d8 + 5
  assert.deepEqual(attacks[0].calculationBadges, ["Dueling +2"]);
  assert.equal(attacks[0].duelingBonus, 2);

  // Two equipped weapons: Dueling does not apply
  const dualWieldChar = makeChar({
    ...duelist,
    items: [
      weapon("w1", "Longsword", { damage: "1d8", damageType: "slashing" }),
      weapon("w2", "Dagger", { damage: "1d4", damageType: "piercing" }),
    ],
  });
  const dualAttacks = getWeaponAttacks(dualWieldChar);
  const swordAttack = dualAttacks.find((a) => a.name === "Longsword")!;
  assert.equal(swordAttack.damageString, "1d8 + 3"); // No Dueling bonus!

  // Two-Handed weapon: Dueling does not apply
  const twoHandedChar = makeChar({
    ...duelist,
    items: [
      weapon("w1", "Greatsword", { damage: "2d6", damageType: "slashing", properties: ["Heavy", "Two-Handed"] }),
    ],
  });
  const twoHandedAttacks = getWeaponAttacks(twoHandedChar);
  assert.equal(twoHandedAttacks[0].damageString, "2d6 + 3"); // No Dueling bonus!
});

test("Two-Weapon Fighting style adds ability modifier to off-hand damage in checkDualWielding", () => {
  const twfChar = makeChar({
    classes: [{ className: "Fighter", level: 1, hitDiceType: "d10" }],
    baseAbilityScores: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 }, // Dex +3
    items: [
      weapon("w1", "Shortsword", { damage: "1d6", damageType: "piercing", properties: ["Finesse", "Light"] }),
      weapon("w2", "Dagger", { damage: "1d4", damageType: "piercing", properties: ["Finesse", "Light"] }),
    ],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Two-Weapon Fighting"],
        picked: ["Two-Weapon Fighting"],
      },
    ],
  });

  const result = checkDualWielding(twfChar);
  assert.equal(result.isDualWielding, true);
  assert.equal(result.mainHand?.damageString, "1d6 + 3");
  assert.equal(result.offHand?.damageString, "1d4 + 3"); // TWF adds +3 to off-hand!

  // Without TWF style: offHand damage does not add +3
  const noTwfChar = makeChar({
    ...twfChar,
    ruleChoices: [],
  });
  const noTwfResult = checkDualWielding(noTwfChar);
  assert.equal(noTwfResult.offHand?.damageString, "1d4");
});

test("Thrown Weapon Fighting adds +2 to damage of thrown weapons", () => {
  const thrownChar = makeChar({
    classes: [{ className: "Fighter", level: 1, hitDiceType: "d10" }],
    baseAbilityScores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, // Str +3
    items: [
      weapon("w1", "Javelin", { damage: "1d6", damageType: "piercing", properties: ["Thrown"] }),
      weapon("w2", "Greatsword", { damage: "2d6", damageType: "slashing", properties: ["Heavy", "Two-Handed"] }),
    ],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Thrown Weapon Fighting"],
        picked: ["Thrown Weapon Fighting"],
      },
    ],
  });

  const attacks = getWeaponAttacks(thrownChar);
  const javelin = attacks.find((a) => a.name === "Javelin")!;
  const greatsword = attacks.find((a) => a.name === "Greatsword")!;

  assert.equal(javelin.damageString, "1d6 + 5"); // 1d6 + 3 (Str) + 2 (Thrown) = 1d6 + 5
  assert.equal(greatsword.damageString, "2d6 + 3"); // Greatsword is not thrown
});

test("Fighting Initiate feat offers Fighter styles", () => {
  const featChar = makeChar({
    classes: [{ className: "Rogue", level: 4, hitDiceType: "d8" }],
    asiSelections: [
      {
        level: 4,
        type: "feat",
        featName: "Fighting Initiate",
        featSource: "TCE",
      },
    ],
  });

  const choices = fightingStyleRuleChoices(featChar);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].id, "TCE__Feat__Fighting Initiate__Style");
  assert.equal(choices[0].traitName, "Fighting Initiate Style");
  assert.equal(choices[0].choose, 1);
  assert.ok(choices[0].options.some((o) => o.name === "Archery"));
  assert.ok(choices[0].options.some((o) => o.name === "Defense"));
  assert.ok(choices[0].options.some((o) => o.name === "Dueling"));

  // Fighting Initiate via originFeats
  const originFeatChar = makeChar({
    classes: [{ className: "Wizard", level: 1, hitDiceType: "d6" }],
    originFeats: [
      {
        level: 1,
        type: "feat",
        featName: "Fighting Initiate",
        featSource: "TCE",
      },
    ],
  });
  const originChoices = fightingStyleRuleChoices(originFeatChar);
  assert.equal(originChoices.length, 1);
  assert.equal(originChoices[0].id, "TCE__Feat__Fighting Initiate__Style");

  // Character without feat does not receive the choice
  const plainChar = makeChar({ classes: [{ className: "Wizard", level: 1, hitDiceType: "d6" }] });
  assert.equal(fightingStyleRuleChoices(plainChar).length, 0);
});

test("reconcile cleans up invalid styles and cantrips on de-leveling", () => {
  const char = makeChar({
    classes: [{ className: "Paladin", level: 1, hitDiceType: "d10" }], // Level 1 Paladin (lost level 2)
    ruleChoices: [
      {
        id: "PHB__Paladin__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Blessed Warrior"],
        picked: ["Blessed Warrior"],
      },
      {
        id: "TCE__Paladin__Blessed Warrior Cantrips",
        trait: "Blessed Warrior Cantrips",
        origin: "class",
        choose: 2,
        from: ["Guidance", "Sacred Flame"],
        picked: ["Guidance", "Sacred Flame"],
      },
    ],
    knownSpells: [
      { name: "Guidance", source: "PHB", ownerKey: "Paladin__TCE", ability: "cha", className: "Paladin" },
      { name: "Sacred Flame", source: "PHB", ownerKey: "Paladin__TCE", ability: "cha", className: "Paladin" },
    ],
  });

  const pruned = reconcile(char, currentCompendium());
  assert.equal(pruned.ruleChoices?.length, 0);
  assert.equal(pruned.knownSpells?.length, 0);
});

// A Fighter from an invented book other than the PHB, with one style option from that book. Every name here is invented.
const otherBookFighter = (): ClassData => ({
  name: "Fighter",
  source: "ALT",
  hitDie: "1d10",
  primaryAbility: [],
  savingThrows: [],
  armorProficiencies: [],
  weaponProficiencies: [],
  toolProficiencies: [],
  skillProficiencies: { choose: 0, from: [] },
  features: [],
  subclasses: [],
  description: "Placeholder description for the class.",
});

const sampleStyle = (name: string): OptionFeatureData => ({
  name,
  source: "ALT",
  category: "Fighting Style",
  featureType: ["FS:F"],
  prerequisite: null,
  description: "Placeholder description for the style.",
});

test("a Fighter from a book without the PHB is offered its style choice under that book's source", () => {
  const compendium = inMemoryCompendium({ classes: [otherBookFighter()], optionsAndFeatures: [sampleStyle("Sample Guard")] });
  const fighter = makeChar({ classes: [{ className: "Fighter", source: "ALT", level: 1 }] });
  const offered = availableSubclassRuleChoices(fighter, ["ALT"], compendium);
  assert.ok(offered.some((choice) => choice.id === "ALT__Fighter__Fighting Style"), "the choice is offered with the class record's source");
});

test("a Fighting Style pick saved under the old fixed id is kept under the class record's id", () => {
  const compendium = inMemoryCompendium({ classes: [otherBookFighter()], optionsAndFeatures: [sampleStyle("Sample Guard")] });
  const saved = makeChar({
    classes: [{ className: "Fighter", source: "ALT", level: 1 }],
    ruleChoices: [
      { id: "PHB__Fighter__Fighting Style", trait: "Fighting Style", origin: "class", choose: 1, from: ["Sample Guard"], picked: ["Sample Guard"] },
    ],
  });
  const loaded = reconcile(saved, compendium, { activeBooks: ["ALT"] });
  assert.deepEqual(loaded.ruleChoices?.map((entry) => [entry.id, entry.picked]), [["ALT__Fighter__Fighting Style", ["Sample Guard"]]]);
  assert.equal(hasFightingStyle(loaded, "Sample Guard"), true, "the saved pick still counts");
});
