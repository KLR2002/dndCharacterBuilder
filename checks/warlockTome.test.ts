import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import { makeChar } from "./testUtils.ts";
import {
  warlockTomeCantripChoices,
  warlockPactBoonChoices,
  subclassRuleChoices,
  availableSubclassRuleChoices,
  pickRuleChoice,
} from "../src/rules/ruleChoices.ts";
import { getClassSpellProfiles } from "../src/rules/spellcasting.ts";

test("Level 3 Warlock picking Pact of the Tome offers Warlock__Pact of the Tome__Cantrips with choose: 3", () => {
  // Non-warlock should not get Tome cantrip choices
  const fighter = makeChar({
    classes: [{ className: "Fighter", level: 3, source: "PHB" }],
  });
  assert.equal(warlockTomeCantripChoices(fighter).length, 0);

  // Warlock level 2 (below level 3) should not get Tome cantrip choices
  const warlockLvl2 = makeChar({
    classes: [{ className: "Warlock", level: 2, source: "PHB" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        origin: "class",
        choose: 1,
        from: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"],
        picked: ["Pact of the Tome"],
      },
    ],
  });
  assert.equal(warlockTomeCantripChoices(warlockLvl2).length, 0);

  // Warlock level 3 without Pact of the Tome (e.g. Pact of the Blade) should not get Tome cantrip choices
  const warlockBlade = makeChar({
    classes: [{ className: "Warlock", level: 3, source: "PHB" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        origin: "class",
        choose: 1,
        from: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"],
        picked: ["Pact of the Blade"],
      },
    ],
  });
  assert.equal(warlockTomeCantripChoices(warlockBlade).length, 0);

  // Level 3 Warlock with Pact of the Tome receives the canonical rule choice
  const warlockTome = makeChar({
    classes: [{ className: "Warlock", level: 3, source: "PHB" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        origin: "class",
        choose: 1,
        from: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"],
        picked: ["Pact of the Tome"],
      },
    ],
  });

  const choices = warlockTomeCantripChoices(warlockTome);
  assert.equal(choices.length, 1);
  const choice = choices[0];
  assert.equal(choice.id, "Warlock__Pact of the Tome__Cantrips");
  assert.equal(choice.traitName, "Pact of the Tome Cantrips");
  assert.equal(choice.choose, 3);
  assert.equal(choice.level, 3);
  assert.equal(choice.effectLevel, 3);
  assert.equal(choice.origin, "class");
  assert.ok(choice.options.length > 0);
});

test("Cantrip options include cross-class cantrips from all classes and respect activeBooks", () => {
  const warlockTome = makeChar({
    classes: [{ className: "Warlock", level: 3, source: "PHB" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        origin: "class",
        choose: 1,
        from: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"],
        picked: ["Pact of the Tome"],
      },
    ],
  });

  const choicesPhb = warlockTomeCantripChoices(warlockTome, ["PHB"]);
  assert.equal(choicesPhb.length, 1);
  const optionNamesPhb = new Set(choicesPhb[0].options.map((o) => o.name));

  // Cross-class cantrips must be present
  assert.ok(optionNamesPhb.has("Guidance"), "Cleric/Druid Guidance must be present");
  assert.ok(optionNamesPhb.has("Vicious Mockery"), "Bard Vicious Mockery must be present");
  assert.ok(optionNamesPhb.has("Sacred Flame"), "Cleric Sacred Flame must be present");
  assert.ok(optionNamesPhb.has("Shillelagh"), "Druid Shillelagh must be present");
  assert.ok(optionNamesPhb.has("Fire Bolt"), "Wizard/Sorcerer Fire Bolt must be present");
  assert.ok(optionNamesPhb.has("Eldritch Blast"), "Warlock Eldritch Blast must be present");

  // XGE-only cantrip (Toll the Dead) should NOT be present when only PHB is active
  assert.ok(!optionNamesPhb.has("Toll the Dead"), "Toll the Dead should not be present with only PHB active");

  // When XGE is added to activeBooks, Toll the Dead becomes available
  const choicesXge = warlockTomeCantripChoices(warlockTome, ["PHB", "XGE"]);
  const optionNamesXge = new Set(choicesXge[0].options.map((o) => o.name));
  assert.ok(optionNamesXge.has("Toll the Dead"), "Toll the Dead should be present when XGE is active");

  // Verify that options have descriptions and class hints
  const guidanceOpt = choicesPhb[0].options.find((o) => o.name === "Guidance");
  assert.ok(guidanceOpt);
  assert.ok(guidanceOpt.description.length > 0);
  assert.match(guidanceOpt.description, /cleric/i);
});

test("availableSubclassRuleChoices offers Warlock__Pact of the Tome__Cantrips without being filtered out", () => {
  const warlockTome = makeChar({
    classes: [{ className: "Warlock", level: 3, source: "PHB" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        origin: "class",
        choose: 1,
        from: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"],
        picked: ["Pact of the Tome"],
      },
    ],
  });

  const available = availableSubclassRuleChoices(warlockTome, ["PHB"]);
  const tomeChoice = available.find((c) => c.id === "Warlock__Pact of the Tome__Cantrips");
  assert.ok(tomeChoice, "Warlock__Pact of the Tome__Cantrips should be present in availableSubclassRuleChoices");
  assert.equal(tomeChoice.choose, 3);
});

test("Picking 3 cantrips synchronizes them into character.knownSpells with ownerKey: 'Warlock__Tome', ability: 'cha'", () => {
  let char = makeChar({
    classes: [{ className: "Warlock", level: 3, source: "PHB" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        origin: "class",
        choose: 1,
        from: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"],
        picked: ["Pact of the Tome"],
      },
    ],
    knownSpells: [
      { name: "Eldritch Blast", source: "PHB", ownerKey: "Warlock__PHB", ability: "cha", className: "Warlock" },
    ],
  });

  const [tomeChoice] = warlockTomeCantripChoices(char);
  assert.ok(tomeChoice);

  // Pick first cantrip: Guidance
  char = pickRuleChoice(char, tomeChoice, "Guidance");
  assert.equal(char.knownSpells.length, 2);
  const guidance = char.knownSpells.find((k) => k.name === "Guidance");
  assert.ok(guidance);
  assert.equal(guidance.ownerKey, "Warlock__Tome");
  assert.equal(guidance.ability, "cha");
  assert.equal(guidance.className, "Warlock");

  // Pick second cantrip: Vicious Mockery
  char = pickRuleChoice(char, tomeChoice, "Vicious Mockery");
  assert.equal(char.knownSpells.length, 3);
  const vm = char.knownSpells.find((k) => k.name === "Vicious Mockery");
  assert.ok(vm);
  assert.equal(vm.ownerKey, "Warlock__Tome");
  assert.equal(vm.ability, "cha");

  // Pick third cantrip: Sacred Flame
  char = pickRuleChoice(char, tomeChoice, "Sacred Flame");
  assert.equal(char.knownSpells.length, 4);
  const sf = char.knownSpells.find((k) => k.name === "Sacred Flame");
  assert.ok(sf);
  assert.equal(sf.ownerKey, "Warlock__Tome");
  assert.equal(sf.ability, "cha");

  // Existing native Warlock spell is preserved untouched
  const eb = char.knownSpells.find((k) => k.name === "Eldritch Blast");
  assert.ok(eb);
  assert.equal(eb.ownerKey, "Warlock__PHB");

  // Verify ruleChoices contains the 3 picks
  const rcEntry = char.ruleChoices?.find((rc) => rc.id === "Warlock__Pact of the Tome__Cantrips");
  assert.ok(rcEntry);
  assert.deepEqual(rcEntry.picked, ["Guidance", "Vicious Mockery", "Sacred Flame"]);
});

test("Tome cantrips appear in Warlock profile with Charisma DC and attack bonus and do not leak into multiclass profiles", () => {
  // Multiclass: Warlock 3 (Cha 16 -> +3) / Cleric 3 (Wis 14 -> +2), total level 6 (PB +3)
  const char = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 16 },
    classes: [
      { className: "Warlock", level: 3, source: "PHB" },
      { className: "Cleric", level: 3, source: "PHB" },
    ],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        origin: "class",
        choose: 1,
        from: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"],
        picked: ["Pact of the Tome"],
      },
      {
        id: "Warlock__Pact of the Tome__Cantrips",
        trait: "Pact of the Tome Cantrips",
        origin: "class",
        choose: 3,
        from: ["Guidance", "Vicious Mockery", "Sacred Flame"],
        picked: ["Guidance", "Vicious Mockery", "Sacred Flame"],
      },
    ],
    knownSpells: [
      { name: "Guidance", source: "PHB", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock" },
      { name: "Vicious Mockery", source: "PHB", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock" },
      { name: "Sacred Flame", source: "PHB", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock" },
      { name: "Bless", source: "PHB", ownerKey: "Cleric__PHB", ability: "wis", className: "Cleric" },
    ],
  });

  const profiles = getClassSpellProfiles(char);
  assert.equal(profiles.length, 2);

  const warlockProfile = profiles.find((p) => p.className === "Warlock");
  assert.ok(warlockProfile);
  assert.equal(warlockProfile.ability, "cha");
  // Total level 6 -> PB +3. Cha 16 (+3). DC = 8 + 3 + 3 = 14. Attack bonus = 3 + 3 = 6.
  assert.equal(warlockProfile.spellSaveDc, 14);
  assert.equal(warlockProfile.spellAttackBonus, 6);

  // Warlock profile includes all 3 Tome cantrips
  const warlockKnownNames = warlockProfile.knownSpells.map((k) => k.name);
  assert.ok(warlockKnownNames.includes("Guidance"));
  assert.ok(warlockKnownNames.includes("Vicious Mockery"));
  assert.ok(warlockKnownNames.includes("Sacred Flame"));

  // Cleric profile does NOT include Warlock Tome cantrips
  const clericProfile = profiles.find((p) => p.className === "Cleric");
  assert.ok(clericProfile);
  const clericKnownNames = clericProfile.knownSpells.map((k) => k.name);
  assert.ok(!clericKnownNames.includes("Guidance"));
  assert.ok(!clericKnownNames.includes("Vicious Mockery"));
  assert.ok(!clericKnownNames.includes("Sacred Flame"));
  assert.ok(clericKnownNames.includes("Bless"));
});

test("Switching Pact Boon to Pact of the Blade purges Tome cantrips from knownSpells and ruleChoices", () => {
  let char = makeChar({
    classes: [{ className: "Warlock", level: 3, source: "PHB" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        origin: "class",
        choose: 1,
        from: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"],
        picked: ["Pact of the Tome"],
      },
      {
        id: "Warlock__Pact of the Tome__Cantrips",
        trait: "Pact of the Tome Cantrips",
        origin: "class",
        choose: 3,
        from: ["Guidance", "Vicious Mockery", "Sacred Flame"],
        picked: ["Guidance", "Vicious Mockery", "Sacred Flame"],
      },
    ],
    knownSpells: [
      { name: "Eldritch Blast", source: "PHB", ownerKey: "Warlock__PHB", ability: "cha", className: "Warlock" },
      { name: "Guidance", source: "PHB", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock" },
      { name: "Vicious Mockery", source: "PHB", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock" },
      { name: "Sacred Flame", source: "PHB", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock" },
    ],
  });

  const pactBoonChoice = warlockPactBoonChoices(char)[0];
  assert.ok(pactBoonChoice);

  // Switch boon to Pact of the Blade
  char = pickRuleChoice(char, pactBoonChoice, "Pact of the Blade");

  // Verify Pact Boon is now Pact of the Blade
  const updatedBoon = char.ruleChoices?.find((rc) => rc.id.includes("Pact Boon"));
  assert.deepEqual(updatedBoon?.picked, ["Pact of the Blade"]);

  // Verify Warlock__Pact of the Tome__Cantrips is pruned from ruleChoices
  const tomeChoice = char.ruleChoices?.find((rc) => rc.id === "Warlock__Pact of the Tome__Cantrips");
  assert.equal(tomeChoice, undefined);

  // Verify all Tome cantrips are purged from knownSpells
  const tomeSpells = char.knownSpells.filter((k) => k.ownerKey === "Warlock__Tome");
  assert.equal(tomeSpells.length, 0);

  // Native Warlock spell is preserved
  assert.equal(char.knownSpells.length, 1);
  assert.equal(char.knownSpells[0].name, "Eldritch Blast");

  // Verify needsReview notice is added
  assert.ok(
    char.needsReview?.includes(
      "Pact of the Tome Cantrips removed: character no longer possesses Pact of the Tome"
    ),
    "needsReview must include notice about Tome cantrips removed upon switching boon"
  );
});

test("De-leveling Warlock to level 2 purges Tome cantrips and rule choices", () => {
  const charLvl3 = makeChar({
    classes: [{ className: "Warlock", level: 3, source: "PHB" }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        origin: "class",
        choose: 1,
        from: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"],
        picked: ["Pact of the Tome"],
      },
      {
        id: "Warlock__Pact of the Tome__Cantrips",
        trait: "Pact of the Tome Cantrips",
        origin: "class",
        choose: 3,
        from: ["Guidance", "Vicious Mockery", "Sacred Flame"],
        picked: ["Guidance", "Vicious Mockery", "Sacred Flame"],
      },
    ],
    knownSpells: [
      { name: "Eldritch Blast", source: "PHB", ownerKey: "Warlock__PHB", ability: "cha", className: "Warlock" },
      { name: "Guidance", source: "PHB", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock" },
      { name: "Vicious Mockery", source: "PHB", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock" },
      { name: "Sacred Flame", source: "PHB", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock" },
    ],
  });

  // De-level Warlock to level 2
  const charLvl2 = {
    ...charLvl3,
    classes: [{ className: "Warlock", level: 2, source: "PHB" }],
  };

  const pruned = reconcile(charLvl2, currentCompendium());

  // Pact Boon should be purged
  assert.equal(pruned.ruleChoices?.some((rc) => rc.id.includes("Pact Boon")), false);

  // Warlock__Pact of the Tome__Cantrips should be purged
  assert.equal(pruned.ruleChoices?.some((rc) => rc.id === "Warlock__Pact of the Tome__Cantrips"), false);

  // Tome cantrips should be purged from knownSpells
  const remainingTomeSpells = pruned.knownSpells.filter((k) => k.ownerKey === "Warlock__Tome");
  assert.equal(remainingTomeSpells.length, 0);

  // Native Eldritch Blast is kept
  assert.equal(pruned.knownSpells.length, 1);
  assert.equal(pruned.knownSpells[0].name, "Eldritch Blast");

  // Verify needsReview notice is added upon de-leveling
  assert.ok(
    pruned.needsReview?.includes(
      "Pact of the Tome Cantrips removed: character no longer possesses Pact of the Tome"
    ),
    "needsReview must include notice about Tome cantrips removed upon de-leveling"
  );
});
