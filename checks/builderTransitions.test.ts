import { test } from "node:test";
import assert from "node:assert/strict";
import { teardownSubclass } from "../src/rules/characterReconciler.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import { makeChar, inMemoryCompendium } from "./testUtils.ts";
import {
  setStandardArrayPick,
  setChoiceRacialBonus,
  validateMulticlass,
  addMulticlassLevel,
  applyStartingGrants,
  setCustomBackground,
  applyBackgroundGrants,
  setLanguages,
  clearBackground,
  changeRace,
  changeSubclass,
  removeClassLevel,
} from "../src/rules/builderTransitions.ts";
import type {
  InventoryItem,
  RuleChoiceEntry,
  SkillChoiceEntry,
} from "../src/types/character.ts";
import type { BackgroundData } from "../src/types/dnd5e.ts";

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
  const tornDown = teardownSubclass(initial, "Druid", "Circle of the Land", "Circle of the Moon");
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
  const tornDownSorc = teardownSubclass(sorcInitial, "Sorcerer", "Clockwork Soul", "Draconic Bloodline");
  assert.equal(tornDownSorc.subclassSpellSwaps, undefined);

  // Teardown Wizard with Bladesong counter
  const wizInitial = makeChar({
    classes: [{ className: "Wizard", source: "TCE", level: 3, subclassName: "Bladesinging" }],
    resourceCounters: {
      bladesong: { id: "bladesong", name: "Bladesong", current: 2, max: 2, resetOn: "short" },
      arcane_recovery: { id: "arcane_recovery", name: "Arcane Recovery", current: 1, max: 1, resetOn: "long" },
    },
  });
  const tornDownWiz = teardownSubclass(wizInitial, "Wizard", "Bladesinging", "Evocation");
  assert.equal(tornDownWiz.resourceCounters.bladesong, undefined);
  // Teardown without new subclass (e.g. on deleveling below requirement)
  const delevelDruid = teardownSubclass(initial, "Druid", "Circle of the Land");
  assert.equal(delevelDruid.ruleChoices?.length, 1);
  assert.equal(delevelDruid.ruleChoices[0].id, "MPMM__Aasimar__null__Celestial Revelation");
});

test("teardownSubclass unconditionally cleans up even when previousSubclassName is empty string", () => {
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

  const tornDown = teardownSubclass(initial, "Fighter", "");
  assert.equal(tornDown.ruleChoices?.length, 0);
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
  const unchanged = reconcile(initial, currentCompendium());
  assert.equal(unchanged.ruleChoices?.length, 7);
  assert.equal(unchanged.knownSpells?.length, 3);

  // 2. De-leveling Fighter to level 0 (removed), Warlock to 2, and Artificer to 1
  const delevelled: typeof initial = {
    ...initial,
    classes: [
      { className: "Warlock", source: "PHB", level: 2 },
    ],
  };

  const reconciled = reconcile(delevelled, currentCompendium());

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

  const updated = clearBackground(char, { compendium: soldierCompendium });

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

  const updated = clearBackground(char, { compendium: soldierCompendium });

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
    ["Arcana", "History"]
  );

  const updated = clearBackground(custom, { compendium: inMemoryCompendium({}) });

  assert.equal(updated.background, null);
  assert.deepEqual(updated.chosenSkills, ["Athletics"]);
  assert.deepEqual(updated.skillChoices, [classSkills]);
  assert.deepEqual(updated.needsReview, [
    "Sage background removed: granted skills, languages and tools cleared",
  ]);
});

test("clearing a background with no recorded grants keeps unrelated choices and records nothing", () => {
  const char = makeChar({
    background: { name: "Hermit", source: "PHB" },
    classes: [{ className: "Fighter", source: "PHB", level: 4 }],
    chosenSkills: ["Athletics"],
    ruleChoices: [fighterStyle],
  });

  const updated = clearBackground(char, { compendium: inMemoryCompendium({}) });

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

  const changed = changeRace(initial, inMemoryCompendium());

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

  const changed = changeSubclass(initial, "Druid", "Circle of the Moon", "PHB", ["Moonbeam"], inMemoryCompendium());

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

  const removed = removeClassLevel(initial, "Fighter", inMemoryCompendium());

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
  const droppedToTwo = removeClassLevel(fighter3, "Fighter", inMemoryCompendium());
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
  const droppedToThree = removeClassLevel(fighter4, "Fighter", inMemoryCompendium());
  assert.equal(droppedToThree.classes[0].level, 3);
  assert.equal(droppedToThree.classes[0].subclassName, "Battle Master");
});
