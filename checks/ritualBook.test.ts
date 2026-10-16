import test from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import type { Character } from "../src/types/character.ts";
import type { SpellData } from "../src/types/dnd5e.ts";
import {
  warlockAncientSecretsStartingRituals,
  availableSubclassRuleChoices,
  pickRuleChoice,
  getMaxRitualBookLevel,
  isSpellEligibleForRitualBook,
} from "../src/rules/ruleChoices.ts";
import { getClassSpellProfiles } from "../src/rules/spellcasting.ts";

function createTestWarlock(level: number, pactBoon: string = "Pact of the Tome"): Character {
  return {
    id: "test-warlock",
    name: "Tome Binder",
    abilityMethod: "standardArray",
    baseAbilityScores: { str: 10, dex: 14, con: 14, int: 10, wis: 12, cha: 16 },
    customLineage: false,
    lineageReplacement: null,
    race: { name: "Tiefling", source: "PHB" },
    racialAbilityBonuses: { cha: 2, int: 1 },
    background: { name: "Sage", source: "PHB" },
    startingOption: "equipment",
    classes: [
      {
        className: "Warlock",
        level,
        hitDiceSpent: 0,
        subclass: "The Fiend",
        subclassName: "The Fiend",
      },
    ],
    chosenSkills: ["Arcana", "History"],
    chosenExpertise: [],
    asiSelections: [],
    currentHp: 20,
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
    ruleChoices: [
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        picked: [pactBoon],
        choose: 1,
        origin: "class",
      },
      {
        id: "PHB__Warlock__Invocations 2",
        trait: "Eldritch Invocations (2nd Level)",
        picked: ["Book of Ancient Secrets", "Agonizing Blast"],
        choose: 2,
        origin: "class",
      },
    ],
    knownSpells: [
      { name: "Eldritch Blast", source: "PHB", ownerKey: "Warlock__PHB", ability: "cha", className: "Warlock" },
    ],
  };
}

test("Book of Ancient Secrets starting rituals: offering and eligibility", () => {
  // Level 1 Warlock cannot take invocations
  const lvl1 = createTestWarlock(1);
  const choices1 = warlockAncientSecretsStartingRituals(lvl1);
  assert.equal(choices1.length, 0);

  // Level 3 Warlock with Tome and Book of Ancient Secrets offers choice
  const lvl3 = createTestWarlock(3);
  const choices3 = warlockAncientSecretsStartingRituals(lvl3);
  assert.equal(choices3.length, 1);
  assert.equal(choices3[0].id, "Warlock__Book of Ancient Secrets__Starting Rituals");
  assert.equal(choices3[0].choose, 2);

  // All options must be 1st-level ritual spells
  assert.ok(choices3[0].options.length > 5);
  const optionNames = choices3[0].options.map((o) => o.name);
  assert.ok(optionNames.includes("Find Familiar"));
  assert.ok(optionNames.includes("Identify"));
  assert.ok(optionNames.includes("Detect Magic"));
  assert.ok(optionNames.includes("Comprehend Languages"));
  assert.ok(optionNames.includes("Alarm"));

  // Subclass rule choices exposes it without being filtered out by activeBooks
  const available = availableSubclassRuleChoices(lvl3, ["PHB", "TCE"]);
  const found = available.find((c) => c.id === "Warlock__Book of Ancient Secrets__Starting Rituals");
  assert.ok(found, "Warlock__Book of Ancient Secrets__Starting Rituals should be available");
});

test("Book of Ancient Secrets starting rituals: non-Tome or missing invocation produces no choices", () => {
  // Level 3 Warlock with Blade pact does not qualify for Book of Ancient Secrets
  const bladeWarlock = createTestWarlock(3, "Pact of the Blade");
  bladeWarlock.ruleChoices = [
    {
      id: "PHB__Warlock__Pact Boon",
      trait: "Pact Boon",
      picked: ["Pact of the Blade"],
      choose: 1,
      origin: "class",
    },
    {
      id: "PHB__Warlock__Invocations 2",
      trait: "Eldritch Invocations (2nd Level)",
      picked: ["Armor of Shadows", "Agonizing Blast"],
      choose: 2,
      origin: "class",
    },
  ];
  const choices = warlockAncientSecretsStartingRituals(bladeWarlock);
  assert.equal(choices.length, 0);
});

test("Book of Ancient Secrets: picking starting rituals synchronizes into character.ritualBook with isStarting: true", () => {
  const char = createTestWarlock(3);
  const choice = warlockAncientSecretsStartingRituals(char)[0];

  const updated1 = pickRuleChoice(char, choice, "Find Familiar");
  const updated2 = pickRuleChoice(updated1, choice, "Identify");

  assert.ok(updated2.ritualBook);
  assert.equal(updated2.ritualBook.length, 2);

  const fam = updated2.ritualBook.find((r) => r.name === "Find Familiar");
  assert.ok(fam);
  assert.equal(fam.isStarting, true);
  assert.equal(fam.level, 1);

  const ident = updated2.ritualBook.find((r) => r.name === "Identify");
  assert.ok(ident);
  assert.equal(ident.isStarting, true);
  assert.equal(ident.level, 1);
});

test("Book of Ancient Secrets: ritual ledger isolation from known spells and prepared counts", () => {
  const char = createTestWarlock(3);
  const choice = warlockAncientSecretsStartingRituals(char)[0];
  let updated = pickRuleChoice(char, choice, "Find Familiar");
  updated = pickRuleChoice(updated, choice, "Identify");

  // Inscribe an adventure ritual
  updated = {
    ...updated,
    ritualBook: [
      ...(updated.ritualBook || []),
      { name: "Silence", source: "PHB", level: 2, isStarting: false },
    ],
  };

  assert.equal(updated.ritualBook.length, 3);

  // Verify knownSpells count remains only the baseline Eldritch Blast
  assert.equal(updated.knownSpells?.length, 1);

  // Verify spellcasting profile doesn't count rituals in known or prepared
  const profiles = getClassSpellProfiles(updated);
  const warlockProfile = profiles.find((p) => p.className === "Warlock");
  assert.ok(warlockProfile);
  assert.equal(warlockProfile.knownSpells.length, 1);
  assert.equal(warlockProfile.knownSpells[0].name, "Eldritch Blast");
});

test("Book of Ancient Secrets: adventure inscription preserves starting rituals and allows removal of inscribed only", () => {
  const char = createTestWarlock(5);
  const choice = warlockAncientSecretsStartingRituals(char)[0];
  let updated = pickRuleChoice(char, choice, "Find Familiar");
  updated = pickRuleChoice(updated, choice, "Identify");

  // Add adventure inscribed rituals (Level <= Math.ceil(5/2) = 3)
  updated = {
    ...updated,
    ritualBook: [
      ...(updated.ritualBook || []),
      { name: "Water Breathing", source: "PHB", level: 3, isStarting: false },
      { name: "Leomund's Tiny Hut", source: "PHB", level: 3, isStarting: false },
    ],
  };

  assert.equal(updated.ritualBook.length, 4);

  // Changing one starting ritual preserves inscribed rituals
  const updatedStarting = pickRuleChoice(updated, choice, "Alarm");
  const names = (updatedStarting.ritualBook || []).map((r) => r.name);
  assert.ok(names.includes("Water Breathing"));
  assert.ok(names.includes("Leomund's Tiny Hut"));
  assert.ok(names.includes("Alarm"));
});

test("Book of Ancient Secrets: switching Pact Boon or losing invocation completely cleanses ritualBook and populates needsReview", () => {
  const char = createTestWarlock(3);
  const choice = warlockAncientSecretsStartingRituals(char)[0];
  let updated = pickRuleChoice(char, choice, "Find Familiar");
  updated = pickRuleChoice(updated, choice, "Identify");
  // Also add an inscribed adventure ritual
  updated = {
    ...updated,
    ritualBook: [
      ...(updated.ritualBook || []),
      { name: "Augury", source: "PHB", level: 2, isStarting: false },
    ],
  };
  assert.equal(updated.ritualBook?.length, 3);

  // 1. Change Pact Boon to Blade
  const bladeChar: Character = {
    ...updated,
    ruleChoices: updated.ruleChoices?.map((rc) =>
      rc.id.includes("Pact Boon") ? { ...rc, picked: ["Pact of the Blade"] } : rc
    ),
  };

  // Pruning invocations will prune Book of Ancient Secrets (since it requires Tome)
  const pruned = reconcile(bladeChar, currentCompendium());
  assert.ok(
    !pruned.ruleChoices?.some((rc) => rc.id.includes("Book of Ancient Secrets")),
    "Starting rituals ruleChoice should be pruned"
  );
  assert.equal(pruned.ritualBook, undefined, "All rituals (starting and inscribed) must be completely cleansed");
  assert.ok(
    pruned.needsReview?.includes(
      "Book of Ancient Secrets rituals removed: character no longer possesses Book of Ancient Secrets"
    ),
    "needsReview must include notice about Book of Ancient Secrets rituals removed"
  );

  // 2. Direct losing of Book of Ancient Secrets invocation on Tome warlock
  const lostInvocationChar: Character = {
    ...updated,
    ruleChoices: updated.ruleChoices?.map((rc) =>
      rc.id.includes("Invocations 2") ? { ...rc, picked: ["Agonizing Blast", "Armor of Shadows"] } : rc
    ),
  };
  const syncedAfterLost = reconcile(lostInvocationChar, currentCompendium());
  assert.equal(syncedAfterLost.ritualBook, undefined, "ritualBook must be completely cleansed when invocation is lost");
  assert.ok(
    syncedAfterLost.needsReview?.includes(
      "Book of Ancient Secrets rituals removed: character no longer possesses Book of Ancient Secrets"
    )
  );
});

test("isSpellEligibleForRitualBook: rejects non-ritual spells, cantrips, and over-level rituals (boundary verification)", () => {
  const fireball: SpellData = {
    name: "Fireball",
    level: 3,
    school: "Evocation",
    classes: ["Sorcerer", "Wizard"],
    source: "PHB",
  };

  const shield: SpellData = {
    name: "Shield",
    level: 1,
    school: "Abjuration",
    classes: ["Sorcerer", "Wizard"],
    source: "PHB",
  };

  const lightCantrip: SpellData = {
    name: "Light",
    level: 0,
    school: "Evocation",
    classes: ["Cleric", "Wizard"],
    source: "PHB",
  };

  const waterBreathing3rdRitual: SpellData = {
    name: "Water Breathing",
    level: 3,
    school: "Transmutation",
    classes: ["Druid", "Wizard"],
    source: "PHB",
    ritual: true,
  };

  const identify1stRitual: SpellData = {
    name: "Identify",
    level: 1,
    school: "Divination",
    classes: ["Bard", "Wizard"],
    source: "PHB",
    ritual: true,
  };

  const augury2ndRitual: SpellData = {
    name: "Augury",
    level: 2,
    school: "Divination",
    classes: ["Cleric", "Wizard"],
    source: "PHB",
    ritual: true,
  };

  // 1. Rejects non-ritual spells regardless of level
  assert.equal(isSpellEligibleForRitualBook(fireball, 10), false, "Fireball (non-ritual) must be rejected");
  assert.equal(isSpellEligibleForRitualBook(shield, 10), false, "Shield (non-ritual) must be rejected");

  // 2. Rejects cantrips (level 0) even if somehow queried
  assert.equal(isSpellEligibleForRitualBook(lightCantrip, 10), false, "Cantrip (level 0) must be rejected");

  // 3. Level 3 Warlock: getMaxRitualBookLevel(3) is Math.ceil(3/2) = 2
  assert.equal(getMaxRitualBookLevel(3), 2);
  assert.equal(isSpellEligibleForRitualBook(identify1stRitual, 3), true, "1st-level ritual is eligible at level 3");
  assert.equal(isSpellEligibleForRitualBook(augury2ndRitual, 3), true, "2nd-level ritual is eligible at level 3");
  assert.equal(
    isSpellEligibleForRitualBook(waterBreathing3rdRitual, 3),
    false,
    "3rd-level ritual must be rejected for level 3 Warlock (max ritual level 2)"
  );

  // 4. Level 5 Warlock: getMaxRitualBookLevel(5) is Math.ceil(5/2) = 3
  assert.equal(getMaxRitualBookLevel(5), 3);
  assert.equal(
    isSpellEligibleForRitualBook(waterBreathing3rdRitual, 5),
    true,
    "3rd-level ritual is eligible for level 5 Warlock"
  );

  // 5. Active books boundary filtering
  const xgeRitual: SpellData = {
    name: "Tiny Servant",
    level: 3,
    school: "Transmutation",
    classes: ["Wizard"],
    source: "XGE",
    ritual: true,
  };
  assert.equal(
    isSpellEligibleForRitualBook(xgeRitual, 5, ["PHB"]),
    false,
    "XGE ritual must be rejected when only PHB is active"
  );
  assert.equal(
    isSpellEligibleForRitualBook(xgeRitual, 5, ["PHB", "XGE"]),
    true,
    "XGE ritual is accepted when XGE is active"
  );
});
