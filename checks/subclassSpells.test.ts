import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getSubclassSpells,
  isSubclassSpellReplaceable,
  getSubclassAllowedSwapSchools,
  validateSubclassSpellSwap,
  getEligibleSubclassSpellSwaps,
  getOrphanedSubclassSpells,
} from "../src/rules/subclassSpells.ts";
import { isSpellAvailableForClass } from "../src/rules/spellcasting.ts";
import { findSpell } from "../src/services/dataService.ts";
import { makeChar } from "./testUtils.ts";

test("Cleric Life Domain progression across levels 1, 3, 5, 7, 9", () => {
  // Level 1: Bless, Cure Wounds
  const lvl1 = getSubclassSpells("Cleric", "Life Domain", 1);
  const names1 = lvl1.prepared.map((s) => s.name).sort();
  assert.deepEqual(names1, ["Bless", "Cure Wounds"]);
  assert.equal(lvl1.cantrips.length, 0);

  // Level 3: Bless, Cure Wounds, Lesser Restoration, Spiritual Weapon
  const lvl3 = getSubclassSpells("Cleric", "Life Domain", 3);
  const names3 = lvl3.prepared.map((s) => s.name).sort();
  assert.deepEqual(names3, ["Bless", "Cure Wounds", "Lesser Restoration", "Spiritual Weapon"]);

  // Level 5 adds Beacon of Hope, Revivify
  const lvl5 = getSubclassSpells("Cleric", "Life Domain", 5);
  const names5 = lvl5.prepared.map((s) => s.name).sort();
  assert.deepEqual(names5, [
    "Beacon of Hope",
    "Bless",
    "Cure Wounds",
    "Lesser Restoration",
    "Revivify",
    "Spiritual Weapon",
  ]);

  // Level 7 adds Death Ward, Guardian of Faith
  const lvl7 = getSubclassSpells("Cleric", "Life Domain", 7);
  const names7 = lvl7.prepared.map((s) => s.name).sort();
  assert.ok(names7.includes("Death Ward"));
  assert.ok(names7.includes("Guardian of Faith"));
  assert.equal(names7.length, 8);

  // Level 9 adds Mass Cure Wounds, Raise Dead
  const lvl9 = getSubclassSpells("Cleric", "Life Domain", 9);
  const names9 = lvl9.prepared.map((s) => s.name).sort();
  assert.ok(names9.includes("Mass Cure Wounds"));
  assert.ok(names9.includes("Raise Dead"));
  assert.equal(names9.length, 10);
});

test("Level gating: Level 1 cleric only receives 1st-level domain spells", () => {
  const lvl1 = getSubclassSpells("Cleric", "Life Domain", 1);
  const preparedNames = lvl1.prepared.map((s) => s.name);
  assert.equal(lvl1.prepared.length, 2);
  assert.ok(!preparedNames.includes("Lesser Restoration"));
  assert.ok(!preparedNames.includes("Spiritual Weapon"));
  assert.ok(!preparedNames.includes("Beacon of Hope"));
});

test("Paladin Oath of Devotion progression", () => {
  // Level 1-2: no oath spells yet
  const lvl1 = getSubclassSpells("Paladin", "Oath of Devotion", 1);
  assert.equal(lvl1.prepared.length, 0);
  const lvl2 = getSubclassSpells("Paladin", "Oath of Devotion", 2);
  assert.equal(lvl2.prepared.length, 0);

  // Level 3: Protection from Evil and Good, Sanctuary
  const lvl3 = getSubclassSpells("Paladin", "Oath of Devotion", 3);
  const names3 = lvl3.prepared.map((s) => s.name).sort();
  assert.deepEqual(names3, ["Protection from Evil and Good", "Sanctuary"]);

  // Level 5: Lesser Restoration, Zone of Truth
  const lvl5 = getSubclassSpells("Paladin", "Oath of Devotion", 5);
  const names5 = lvl5.prepared.map((s) => s.name).sort();
  assert.deepEqual(names5, [
    "Lesser Restoration",
    "Protection from Evil and Good",
    "Sanctuary",
    "Zone of Truth",
  ]);

  // Level 9: Beacon of Hope, Dispel Magic
  const lvl9 = getSubclassSpells("Paladin", "Oath of Devotion", 9);
  const names9 = lvl9.prepared.map((s) => s.name).sort();
  assert.ok(names9.includes("Beacon of Hope"));
  assert.ok(names9.includes("Dispel Magic"));
  assert.equal(names9.length, 6);

  // Level 13: Freedom of Movement, Guardian of Faith
  const lvl13 = getSubclassSpells("Paladin", "Oath of Devotion", 13);
  const names13 = lvl13.prepared.map((s) => s.name).sort();
  assert.ok(names13.includes("Freedom of Movement"));
  assert.ok(names13.includes("Guardian of Faith"));
  assert.equal(names13.length, 8);

  // Level 17: Commune, Flame Strike
  const lvl17 = getSubclassSpells("Paladin", "Oath of Devotion", 17);
  const names17 = lvl17.prepared.map((s) => s.name).sort();
  assert.ok(names17.includes("Commune"));
  assert.ok(names17.includes("Flame Strike"));
  assert.equal(names17.length, 10);
});

test("Artificer Battle Smith progression", () => {
  // Level 1-2: no specialist spells yet
  const lvl1 = getSubclassSpells("Artificer", "Battle Smith", 1);
  assert.equal(lvl1.prepared.length, 0);
  const lvl2 = getSubclassSpells("Artificer", "Battle Smith", 2);
  assert.equal(lvl2.prepared.length, 0);

  // Level 3: Heroism, Shield
  const lvl3 = getSubclassSpells("Artificer", "Battle Smith", 3);
  const names3 = lvl3.prepared.map((s) => s.name).sort();
  assert.deepEqual(names3, ["Heroism", "Shield"]);

  // Level 5: Branding Smite, Warding Bond
  const lvl5 = getSubclassSpells("Artificer", "Battle Smith", 5);
  const names5 = lvl5.prepared.map((s) => s.name).sort();
  assert.deepEqual(names5, ["Branding Smite", "Heroism", "Shield", "Warding Bond"]);

  // Level 9: Aura of Vitality, Conjure Barrage
  const lvl9 = getSubclassSpells("Artificer", "Battle Smith", 9);
  assert.equal(lvl9.prepared.length, 6);
  assert.ok(lvl9.prepared.some((s) => s.name === "Aura of Vitality"));
  assert.ok(lvl9.prepared.some((s) => s.name === "Conjure Barrage"));

  // Level 13: Aura of Purity, Fire Shield
  const lvl13 = getSubclassSpells("Artificer", "Battle Smith", 13);
  assert.equal(lvl13.prepared.length, 8);
  assert.ok(lvl13.prepared.some((s) => s.name === "Aura of Purity"));
  assert.ok(lvl13.prepared.some((s) => s.name === "Fire Shield"));

  // Level 17: Banishing Smite, Mass Cure Wounds
  const lvl17 = getSubclassSpells("Artificer", "Battle Smith", 17);
  assert.equal(lvl17.prepared.length, 10);
  assert.ok(lvl17.prepared.some((s) => s.name === "Banishing Smite"));
  assert.ok(lvl17.prepared.some((s) => s.name === "Mass Cure Wounds"));
});

test("Druid Circle of the Land (Coast biome) and Circle of Spores", () => {
  // Circle of the Land - Coast at level 3
  const coast3 = getSubclassSpells("Druid", "Circle of the Land", 3, { biome: "Coast" });
  const coastNames3 = coast3.prepared.map((s) => s.name).sort();
  assert.deepEqual(coastNames3, ["Mirror Image", "Misty Step"]);

  // Circle of the Land - Coast at level 5
  const coast5 = getSubclassSpells("Druid", "Circle of the Land", 5, { biome: "Coast" });
  const coastNames5 = coast5.prepared.map((s) => s.name).sort();
  assert.deepEqual(coastNames5, ["Mirror Image", "Misty Step", "Water Breathing", "Water Walk"]);

  // Circle of the Land - Mountain comparison at level 3
  const mountain3 = getSubclassSpells("Druid", "Circle of the Land", 3, { biome: "Mountain" });
  const mountainNames3 = mountain3.prepared.map((s) => s.name).sort();
  assert.deepEqual(mountainNames3, ["Spider Climb", "Spike Growth"]);

  // Circle of Spores at level 2: Chill Touch cantrip granted
  const spores2 = getSubclassSpells("Druid", "Circle of Spores", 2);
  assert.equal(spores2.cantrips.length, 1);
  assert.equal(spores2.cantrips[0].name, "Chill Touch");
  assert.equal(spores2.prepared.length, 0);

  // Circle of Spores at level 3: Chill Touch + Blindness/Deafness, Gentle Repose
  const spores3 = getSubclassSpells("Druid", "Circle of Spores", 3);
  assert.equal(spores3.cantrips.length, 1);
  assert.equal(spores3.cantrips[0].name, "Chill Touch");
  const sporesPrep3 = spores3.prepared.map((s) => s.name).sort();
  assert.deepEqual(sporesPrep3, ["Blindness/Deafness", "Gentle Repose"]);
});

test("Subclass supremacy: spells accessible if subclass source is active", () => {
  // Battle Smith source is TCE. If activeBooks has only PHB, Battle Smith is not active -> empty
  const bsPhbOnly = getSubclassSpells("Artificer", "Battle Smith", 3, { activeBooks: ["PHB"] });
  assert.equal(bsPhbOnly.prepared.length, 0);

  // When TCE is active, Battle Smith spells are resolved and accessible
  const bsTce = getSubclassSpells("Artificer", "Battle Smith", 3, { activeBooks: ["PHB", "TCE"] });
  assert.equal(bsTce.prepared.length, 2);
  assert.ok(bsTce.prepared.some((s) => s.name === "Heroism"));
  assert.ok(bsTce.prepared.some((s) => s.name === "Shield"));
});

test("Warlock Otherworldly Patron expanded list eligibility (does not auto-prepare or auto-learn)", () => {
  // Level 1 Fiend Warlock
  const fiend1 = getSubclassSpells("Warlock", "The Fiend", 1, { activeBooks: ["PHB"] });
  assert.deepEqual(fiend1.prepared, []);
  assert.deepEqual(fiend1.known, []);
  assert.deepEqual(fiend1.cantrips, []);
  assert.deepEqual(fiend1.expanded.sort(), ["Burning Hands", "Command"].sort());

  // Level 3 Fiend Warlock adds Blindness/Deafness, Scorching Ray
  const fiend3 = getSubclassSpells("Warlock", "The Fiend", 3, { activeBooks: ["PHB"] });
  assert.deepEqual(fiend3.prepared, []);
  assert.deepEqual(fiend3.known, []);
  assert.deepEqual(fiend3.cantrips, []);
  assert.ok(fiend3.expanded.includes("Blindness/Deafness"));
  assert.ok(fiend3.expanded.includes("Scorching Ray"));
  assert.ok(!fiend3.expanded.includes("Fireball"));

  // Level 5 Fiend Warlock adds Fireball, Stinking Cloud
  const fiend5 = getSubclassSpells("Warlock", "The Fiend", 5, { activeBooks: ["PHB"] });
  assert.deepEqual(fiend5.prepared, []);
  assert.deepEqual(fiend5.known, []);
  assert.ok(fiend5.expanded.includes("Fireball"));
  assert.ok(fiend5.expanded.includes("Stinking Cloud"));

  // Level 9 Fiend Warlock has all 10 expanded spells
  const fiend9 = getSubclassSpells("Warlock", "The Fiend", 9, { activeBooks: ["PHB"] });
  assert.equal(fiend9.expanded.length, 10);
  assert.deepEqual(fiend9.prepared, []);
  assert.deepEqual(fiend9.known, []);
  assert.ok(fiend9.expanded.includes("Flame Strike"));
  assert.ok(fiend9.expanded.includes("Hallow"));

  // Celestial Warlock source gating (XGE required)
  const celestialPhbOnly = getSubclassSpells("Warlock", "The Celestial", 5, { activeBooks: ["PHB"] });
  assert.equal(celestialPhbOnly.expanded.length, 0);

  const celestialXge = getSubclassSpells("Warlock", "The Celestial", 5, { activeBooks: ["PHB", "XGE"] });
  assert.ok(celestialXge.expanded.length > 0);
  assert.ok(celestialXge.expanded.includes("Cure Wounds"));
});

test("Clockwork Soul Sorcerer baseline spells known at levels 1 and 3", () => {
  const lvl1 = getSubclassSpells("Sorcerer", "Clockwork Soul", 1);
  const names1 = lvl1.known.map((s) => s.name).sort();
  assert.deepEqual(names1, ["Alarm", "Protection from Evil and Good"]);
  assert.equal(lvl1.cantrips.length, 0);

  const lvl3 = getSubclassSpells("Sorcerer", "Clockwork Soul", 3);
  const names3 = lvl3.known.map((s) => s.name).sort();
  assert.deepEqual(names3, ["Aid", "Alarm", "Lesser Restoration", "Protection from Evil and Good"]);
});

test("Aberrant Mind Sorcerer baseline spells known and cantrips at level 1", () => {
  const lvl1 = getSubclassSpells("Sorcerer", "Aberrant Mind", 1);
  assert.equal(lvl1.cantrips.length, 1);
  assert.equal(lvl1.cantrips[0].name, "Mind Sliver");
  const known1 = lvl1.known.map((s) => s.name).sort();
  assert.deepEqual(known1, ["Arms of Hadar", "Dissonant Whispers"]);
});

test("Ranger Conclave Gloom Stalker progression across levels 3, 5, 9, 13, 17", () => {
  // Level 1-2: no conclave spells
  assert.equal(getSubclassSpells("Ranger", "Gloom Stalker", 2).known.length, 0);

  // Level 3: Disguise Self
  const lvl3 = getSubclassSpells("Ranger", "Gloom Stalker", 3);
  assert.deepEqual(lvl3.known.map((s) => s.name), ["Disguise Self"]);

  // Level 5 adds Rope Trick
  const lvl5 = getSubclassSpells("Ranger", "Gloom Stalker", 5);
  assert.deepEqual(lvl5.known.map((s) => s.name).sort(), ["Disguise Self", "Rope Trick"]);

  // Level 9 adds Fear
  const lvl9 = getSubclassSpells("Ranger", "Gloom Stalker", 9);
  assert.ok(lvl9.known.some((s) => s.name === "Fear"));
  assert.equal(lvl9.known.length, 3);

  // Level 13 adds Greater Invisibility
  const lvl13 = getSubclassSpells("Ranger", "Gloom Stalker", 13);
  assert.ok(lvl13.known.some((s) => s.name === "Greater Invisibility"));
  assert.equal(lvl13.known.length, 4);

  // Level 17 adds Seeming
  const lvl17 = getSubclassSpells("Ranger", "Gloom Stalker", 17);
  assert.ok(lvl17.known.some((s) => s.name === "Seeming"));
  assert.equal(lvl17.known.length, 5);
});

test("Clockwork Soul swap validation: Abjuration/Transmutation same level from Sorcerer/Warlock/Wizard", () => {
  assert.equal(isSubclassSpellReplaceable("Sorcerer", "Clockwork Soul"), true);
  assert.deepEqual(getSubclassAllowedSwapSchools("Clockwork Soul"), ["Abjuration", "Transmutation"]);

  // Swapping "Alarm" (1st level) with "Shield" (1st level Abjuration, Wizard) is valid
  const validSwap = validateSubclassSpellSwap("Sorcerer", "Clockwork Soul", "Alarm", "Shield");
  assert.equal(validSwap.valid, true);

  // Swapping with "Magic Missile" (Evocation) is invalid
  const invalidSchool = validateSubclassSpellSwap("Sorcerer", "Clockwork Soul", "Alarm", "Magic Missile");
  assert.equal(invalidSchool.valid, false);
  assert.ok(invalidSchool.reason?.includes("school") || invalidSchool.reason?.includes("Abjuration"));

  // Swapping with 2nd level spell ("Aid") is invalid
  const invalidLevel = validateSubclassSpellSwap("Sorcerer", "Clockwork Soul", "Alarm", "Aid");
  assert.equal(invalidLevel.valid, false);
  assert.ok(invalidLevel.reason?.includes("level"));
});

test("Aberrant Mind swap validation: Divination/Enchantment same level from Sorcerer/Warlock/Wizard", () => {
  assert.equal(isSubclassSpellReplaceable("Sorcerer", "Aberrant Mind"), true);
  assert.deepEqual(getSubclassAllowedSwapSchools("Aberrant Mind"), ["Divination", "Enchantment"]);

  // Swapping "Arms of Hadar" (1st level) with "Hex" (1st level Enchantment, Warlock) is valid
  const validSwap = validateSubclassSpellSwap("Sorcerer", "Aberrant Mind", "Arms of Hadar", "Hex");
  assert.equal(validSwap.valid, true);

  // Swapping with "Shield" (Abjuration) is invalid
  const invalidSchool = validateSubclassSpellSwap("Sorcerer", "Aberrant Mind", "Arms of Hadar", "Shield");
  assert.equal(invalidSchool.valid, false);
  assert.ok(invalidSchool.reason?.includes("school") || invalidSchool.reason?.includes("Divination"));

  // Swapping cantrip "Mind Sliver" is invalid (TCoE restricts to 1st level or higher)
  const invalidCantrip = validateSubclassSpellSwap("Sorcerer", "Aberrant Mind", "Mind Sliver", "Friends");
  assert.equal(invalidCantrip.valid, false);
  assert.ok(invalidCantrip.reason?.includes("cantrip") || invalidCantrip.reason?.includes("1st level"));

  assert.equal(isSubclassSpellReplaceable("Sorcerer", "Aberrant Mind", 0), false);
});

test("getSubclassSpells with active swaps replaces the spell in known and tracks metadata", () => {
  const swapped = getSubclassSpells("Sorcerer", "Clockwork Soul", 1, {
    swaps: { Alarm: "Shield" },
  });

  const names = swapped.known.map((s) => s.name).sort();
  assert.deepEqual(names, ["Protection from Evil and Good", "Shield"]);
  assert.ok(!names.includes("Alarm"));

  const shield = swapped.known.find((s) => s.name === "Shield");
  assert.ok(shield);
  assert.equal(shield.isReplaced, true);
  assert.equal(shield.originalName, "Alarm");

  const unswapped = swapped.known.find((s) => s.name === "Protection from Evil and Good");
  assert.ok(unswapped);
  assert.equal(unswapped.isReplaced, false);
});

test("Fixed subclass cantrips are auto-granted (Light, Grave, Spores, Celestial)", () => {
  // Light Cleric: Light
  const light = getSubclassSpells("Cleric", "Light Domain", 1);
  assert.ok(light.cantrips.some((c) => c.name === "Light"));

  // Grave Cleric: Spare the Dying
  const grave = getSubclassSpells("Cleric", "Grave Domain", 1);
  assert.ok(grave.cantrips.some((c) => c.name === "Spare the Dying"));

  // Spores Druid: Chill Touch
  const spores = getSubclassSpells("Druid", "Circle of Spores", 2);
  assert.ok(spores.cantrips.some((c) => c.name === "Chill Touch"));

  // Celestial Warlock: Light and Sacred Flame
  const celestial = getSubclassSpells("Warlock", "The Celestial", 1);
  assert.ok(celestial.cantrips.some((c) => c.name === "Light"));
  assert.ok(celestial.cantrips.some((c) => c.name === "Sacred Flame"));
});

test("RuleChoices integration: Circle of Land biomes, Divine Soul affinity, Cleric cantrips", () => {
  // Biome from ruleChoice
  const landCoast = getSubclassSpells("Druid", "Circle of the Land", 3, {
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
  });
  assert.ok(landCoast.prepared.some((s) => s.name === "Mirror Image"));
  assert.ok(landCoast.prepared.some((s) => s.name === "Misty Step"));

  // Affinity from ruleChoice
  const divineGood = getSubclassSpells("Sorcerer", "Divine Soul", 1, {
    ruleChoices: [
      {
        id: "XGE__Sorcerer__Divine Soul__Affinity",
        trait: "Divine Soul: Divine Affinity",
        origin: "subclass",
        choose: 1,
        from: ["Good"],
        picked: ["Good"],
      },
    ],
  });
  assert.ok(divineGood.known.some((s) => s.name === "Cure Wounds"));

  // Nature Cleric choice cantrip
  const nature = getSubclassSpells("Cleric", "Nature Domain", 1, {
    ruleChoices: [
      {
        id: "PHB__Cleric__Nature Domain__Acolyte of Nature",
        trait: "Acolyte of Nature Cantrip",
        origin: "subclass",
        choose: 1,
        from: ["Shillelagh"],
        picked: ["Shillelagh"],
      },
    ],
  });
  assert.ok(nature.cantrips.some((c) => c.name === "Shillelagh"));

  // Arcana Cleric 2 choice cantrips
  const arcana = getSubclassSpells("Cleric", "Arcana Domain", 1, {
    ruleChoices: [
      {
        id: "SCAG__Cleric__Arcana Domain__Arcane Initiate",
        trait: "Arcane Initiate Cantrips",
        origin: "subclass",
        choose: 2,
        from: ["Fire Bolt", "Mage Hand"],
        picked: ["Fire Bolt", "Mage Hand"],
      },
    ],
  });
  assert.ok(arcana.cantrips.some((c) => c.name === "Fire Bolt"));
  assert.ok(arcana.cantrips.some((c) => c.name === "Mage Hand"));
});

test("getOrphanedSubclassSpells detects illegal spells when changing Warlock patron", () => {
  // Warlock Fiend patron who learned Fireball, Hex, and Eldritch Blast
  const fiendWarlock = makeChar({
    classes: [{ className: "Warlock", source: "PHB", level: 5, subclassName: "The Fiend" }],
    knownSpells: [
      { name: "Hex", source: "PHB", ownerKey: "Warlock__PHB" },
      { name: "Fireball", source: "PHB", ownerKey: "Warlock__PHB" },
      { name: "Eldritch Blast", source: "PHB", ownerKey: "Warlock__PHB" },
    ],
  });

  // Switching to Archfey: Fireball is not on Archfey list and not base Warlock spell -> orphaned!
  // Hex and Eldritch Blast are base Warlock spells -> not orphaned!
  const orphanedArchfey = getOrphanedSubclassSpells(
    fiendWarlock,
    "Warlock",
    "The Fiend",
    "The Archfey"
  );
  assert.deepEqual(orphanedArchfey, ["Fireball"]);

  // Switching to undefined (clearing subclass): Fireball is orphaned
  const orphanedClear = getOrphanedSubclassSpells(
    fiendWarlock,
    "Warlock",
    "The Fiend",
    undefined
  );
  assert.deepEqual(orphanedClear, ["Fireball"]);

  // Non-Warlock class returns empty
  const cleric = makeChar({
    classes: [{ className: "Cleric", source: "PHB", level: 5, subclassName: "Life Domain" }],
    knownSpells: [{ name: "Bless", source: "PHB" }],
  });
  assert.deepEqual(getOrphanedSubclassSpells(cleric, "Cleric", "Life Domain", "Light Domain"), []);
});

test("Third casters access Wizard spells when subclass is active", () => {
  const fireball = findSpell("Fireball")!;
  assert.ok(fireball);

  // Fighter with Eldritch Knight subclass has access to Fireball (Wizard spell)
  assert.equal(isSpellAvailableForClass(fireball, "Fighter", ["PHB"], "Eldritch Knight"), true);
  assert.equal(isSpellAvailableForClass(fireball, "Fighter", ["PHB"], { subclassName: "Eldritch Knight" }), true);

  // Fighter without Eldritch Knight (or Champion) does NOT have access
  assert.equal(isSpellAvailableForClass(fireball, "Fighter", ["PHB"], "Champion"), false);
  assert.equal(isSpellAvailableForClass(fireball, "Fighter", ["PHB"]), false);

  // Rogue with Arcane Trickster subclass has access to Fireball
  assert.equal(isSpellAvailableForClass(fireball, "Rogue", ["PHB"], "Arcane Trickster"), true);
  assert.equal(isSpellAvailableForClass(fireball, "Rogue", ["PHB"], "Thief"), false);
});

test("getEligibleSubclassSpellSwaps disallows cantrips", () => {
  const mindSliver = findSpell("Mind Sliver")!;
  assert.ok(mindSliver);
  assert.equal(mindSliver.level, 0);

  const swaps = getEligibleSubclassSpellSwaps("Aberrant Mind", mindSliver);
  assert.deepEqual(swaps, []);
});

test("Genie Warlock expanded spells include shared spells and kind-specific spells", () => {
  // Level 1 Dao Genie Warlock (TCE active)
  const dao1 = getSubclassSpells("Warlock", "The Genie", 1, { kind: "Dao", activeBooks: ["PHB", "TCE"] });
  assert.ok(dao1.expanded.includes("Detect Evil and Good"));
  assert.ok(dao1.expanded.includes("Sanctuary"));
  assert.equal(dao1.expanded.length, 2);

  // Level 9 Dao Genie Warlock
  const dao9 = getSubclassSpells("Warlock", "The Genie", 9, { kind: "Dao", activeBooks: ["PHB", "TCE"] });
  assert.equal(dao9.expanded.length, 10);
  assert.ok(dao9.expanded.includes("Detect Evil and Good"));
  assert.ok(dao9.expanded.includes("Sanctuary"));
  assert.ok(dao9.expanded.includes("Spike Growth"));
  assert.ok(dao9.expanded.includes("Wall of Stone"));
  assert.ok(!dao9.expanded.includes("Fireball")); // Dao does not have Fireball

  // Level 9 Efreeti Genie Warlock
  const efreeti9 = getSubclassSpells("Warlock", "The Genie", 9, { kind: "Efreeti", activeBooks: ["PHB", "TCE"] });
  assert.equal(efreeti9.expanded.length, 10);
  assert.ok(efreeti9.expanded.includes("Detect Evil and Good"));
  assert.ok(efreeti9.expanded.includes("Fireball"));
  assert.ok(efreeti9.expanded.includes("Flame Strike"));
  assert.ok(!efreeti9.expanded.includes("Sanctuary")); // Efreeti does not have Sanctuary

  // Level 17 Efreeti Genie Warlock gets Wish
  const efreeti17 = getSubclassSpells("Warlock", "The Genie", 17, { kind: "Efreeti", activeBooks: ["PHB", "TCE"] });
  assert.ok(efreeti17.expanded.includes("Wish"));
});



