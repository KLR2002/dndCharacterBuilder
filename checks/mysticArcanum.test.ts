import test from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import type { Character } from "../src/types/character.ts";
import {
  warlockMysticArcanumChoices,
  availableSubclassRuleChoices,
  getMysticArcanumTiers,
  pickRuleChoice,
} from "../src/rules/ruleChoices.ts";
import { applyLongRest, applyShortRest } from "../src/rules/rest.ts";

function createHighLevelWarlock(level: number, subclass: string = "The Fiend"): Character {
  return {
    id: "test-warlock",
    name: "Arcanum Master",
    abilityMethod: "standardArray",
    baseAbilityScores: { str: 10, dex: 14, con: 14, int: 10, wis: 12, cha: 16 },
    customLineage: false,
    lineageReplacement: null,
    race: { name: "Human", source: "PHB" },
    racialAbilityBonuses: {},
    background: { name: "Sage", source: "PHB" },
    startingOption: "equipment",
    classes: [
      {
        className: "Warlock",
        level,
        hitDiceSpent: 0,
        subclass,
        subclassName: subclass,
      },
    ],
    chosenSkills: ["Arcana", "History"],
    chosenExpertise: [],
    asiSelections: [],
    currentHp: 80,
    maxHpOverride: null,
    tempHp: 0,
    conditions: [],
    usedHitDice: {},
    deathSaves: { successes: 0, failures: 0 },
    items: [],
    pouch: { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 },
    useWeightLimit: false,
    resourceCounters: {},
    description: "",
    backstory: "",
    personalityTraits: "",
    ideals: "",
    bonds: "",
    flaws: "",
    notes: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    avatarUri: null,
    usedSpellSlots: {},
    sorceryPointsUsed: 0,
    chosenMetamagic: [],
    ruleChoices: [],
    knownSpells: [],
  };
}

test("Mystic Arcanum: milestone choices unlock at levels 11, 13, 15, and 17", () => {
  // Level 10: no Arcanum
  const lvl10 = createHighLevelWarlock(10);
  assert.equal(warlockMysticArcanumChoices(lvl10).length, 0);

  // Level 11: 6th-level Arcanum
  const lvl11 = createHighLevelWarlock(11);
  const choices11 = warlockMysticArcanumChoices(lvl11);
  assert.equal(choices11.length, 1);
  assert.equal(choices11[0].id, "Warlock__Mystic Arcanum 11");
  assert.equal(choices11[0].choose, 1);
  const spells6 = choices11[0].options.map((o) => o.name);
  assert.ok(spells6.includes("Circle of Death"));
  assert.ok(spells6.includes("Eyebite"));
  assert.ok(spells6.includes("Mass Suggestion"));
  assert.ok(spells6.includes("True Seeing"));

  // Level 13: 6th and 7th
  const lvl13 = createHighLevelWarlock(13);
  const choices13 = warlockMysticArcanumChoices(lvl13);
  assert.equal(choices13.length, 2);
  assert.equal(choices13[1].id, "Warlock__Mystic Arcanum 13");
  const spells7 = choices13[1].options.map((o) => o.name);
  assert.ok(spells7.includes("Finger of Death"));
  assert.ok(spells7.includes("Plane Shift"));
  assert.ok(spells7.includes("Forcecage"));

  // Level 15: 6th, 7th, 8th
  const lvl15 = createHighLevelWarlock(15);
  const choices15 = warlockMysticArcanumChoices(lvl15);
  assert.equal(choices15.length, 3);
  assert.equal(choices15[2].id, "Warlock__Mystic Arcanum 15");
  const spells8 = choices15[2].options.map((o) => o.name);
  assert.ok(spells8.includes("Demiplane"));
  assert.ok(spells8.includes("Dominate Monster"));
  assert.ok(spells8.includes("Feeblemind"));
  assert.ok(spells8.includes("Power Word Stun"));

  // Level 17: 6th, 7th, 8th, 9th
  const lvl17 = createHighLevelWarlock(17);
  const choices17 = warlockMysticArcanumChoices(lvl17);
  assert.equal(choices17.length, 4);
  assert.equal(choices17[3].id, "Warlock__Mystic Arcanum 17");
  const spells9 = choices17[3].options.map((o) => o.name);
  assert.ok(spells9.includes("Astral Projection"));
  assert.ok(spells9.includes("Foresight"));
  assert.ok(spells9.includes("Imprisonment"));
  assert.ok(spells9.includes("Power Word Kill"));
  assert.ok(spells9.includes("True Polymorph"));

  // Available in availableSubclassRuleChoices without being filtered out
  const available = availableSubclassRuleChoices(lvl17, ["PHB", "TCE"]);
  assert.ok(available.some((c) => c.id === "Warlock__Mystic Arcanum 11"));
  assert.ok(available.some((c) => c.id === "Warlock__Mystic Arcanum 17"));
});

test("Mystic Arcanum: Genie Warlock gets Wish in 9th-level Arcanum options", () => {
  const genie = createHighLevelWarlock(17, "The Genie");
  const choices = warlockMysticArcanumChoices(genie, ["PHB", "TCE"]);
  const choice9 = choices.find((c) => c.id === "Warlock__Mystic Arcanum 17");
  assert.ok(choice9);
  const names = choice9.options.map((o) => o.name);
  assert.ok(names.includes("Wish"), "The Genie Warlock should have Wish available for 9th-level Arcanum");
});

test("Mystic Arcanum: selection, getMysticArcanumTiers, and daily tracking", () => {
  let char = createHighLevelWarlock(17);
  const choices = warlockMysticArcanumChoices(char);

  char = pickRuleChoice(char, choices[0], "Mass Suggestion"); // 6th
  char = pickRuleChoice(char, choices[1], "Finger of Death"); // 7th
  char = pickRuleChoice(char, choices[2], "Demiplane"); // 8th
  char = pickRuleChoice(char, choices[3], "True Polymorph"); // 9th

  const tiers = getMysticArcanumTiers(char);
  assert.equal(tiers.length, 4);
  assert.equal(tiers[0].spellLevel, 6);
  assert.equal(tiers[0].chosenSpellName, "Mass Suggestion");
  assert.equal(tiers[0].isSpent, false);

  assert.equal(tiers[3].spellLevel, 9);
  assert.equal(tiers[3].chosenSpellName, "True Polymorph");
  assert.equal(tiers[3].isSpent, false);

  // Spend tier 6 and 9
  char = {
    ...char,
    mysticArcanumSpent: {
      6: true,
      9: true,
    },
  };

  const spentTiers = getMysticArcanumTiers(char);
  assert.equal(spentTiers[0].isSpent, true);
  assert.equal(spentTiers[1].isSpent, false);
  assert.equal(spentTiers[2].isSpent, false);
  assert.equal(spentTiers[3].isSpent, true);
});

test("Mystic Arcanum: Short Rest preserves spent status, Long Rest recovers all tiers", () => {
  let char = createHighLevelWarlock(17);
  char = {
    ...char,
    mysticArcanumSpent: {
      6: true,
      7: true,
    },
  };

  // Short rest
  const afterShort = applyShortRest(char);
  assert.equal(afterShort.mysticArcanumSpent?.[6], true);
  assert.equal(afterShort.mysticArcanumSpent?.[7], true);

  // Long rest
  const afterLong = applyLongRest(char);
  assert.deepEqual(afterLong.mysticArcanumSpent, {});
  const tiersAfterLong = getMysticArcanumTiers(afterLong);
  assert.ok(tiersAfterLong.every((t) => !t.isSpent));
});

test("Mystic Arcanum: deleveling prunes invalid tiers and cleans up spent tracking", () => {
  let char = createHighLevelWarlock(17);
  const choices = warlockMysticArcanumChoices(char);

  char = pickRuleChoice(char, choices[0], "Mass Suggestion"); // 6th (lvl 11)
  char = pickRuleChoice(char, choices[1], "Finger of Death"); // 7th (lvl 13)
  char = pickRuleChoice(char, choices[2], "Demiplane"); // 8th (lvl 15)
  char = pickRuleChoice(char, choices[3], "True Polymorph"); // 9th (lvl 17)

  char = {
    ...char,
    mysticArcanumSpent: { 6: true, 7: true, 8: true, 9: true },
  };

  // De-level Warlock to level 14 (loses level 15 and 17 choices)
  const deleveled: Character = {
    ...char,
    classes: [{ className: "Warlock", level: 14, hitDiceSpent: 0 }],
  };

  const pruned = reconcile(deleveled, currentCompendium());

  // Verify only 11 and 13 choices remain
  assert.equal(pruned.ruleChoices?.length, 2);
  const ids = pruned.ruleChoices?.map((rc) => rc.id);
  assert.ok(ids?.includes("Warlock__Mystic Arcanum 11"));
  assert.ok(ids?.includes("Warlock__Mystic Arcanum 13"));
  assert.ok(!ids?.includes("Warlock__Mystic Arcanum 15"));
  assert.ok(!ids?.includes("Warlock__Mystic Arcanum 17"));

  // Verify spent tracking for 8 and 9 was pruned
  assert.equal(pruned.mysticArcanumSpent?.[6], true);
  assert.equal(pruned.mysticArcanumSpent?.[7], true);
  assert.equal(pruned.mysticArcanumSpent?.[8], undefined);
  assert.equal(pruned.mysticArcanumSpent?.[9], undefined);

  // Verify warning added to needsReview
  assert.ok(pruned.needsReview && pruned.needsReview.length > 0);
  assert.ok(pruned.needsReview.some((r) => r.includes("Demiplane")));
  assert.ok(pruned.needsReview.some((r) => r.includes("True Polymorph")));
});
