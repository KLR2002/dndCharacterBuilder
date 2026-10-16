import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, inMemoryCompendium } from "./testUtils.ts";
import { getClassSpellProfiles } from "../src/rules/spellcasting.ts";
import {
  getSpellSlotLedger,
  toggleSpellSlot,
  togglePactSlot,
  spendSorceryPoints,
  toggleMysticArcanumCast,
  toggleInnateSpellUse,
  inscribeRitual,
  removeInscribedRitual,
  swapSubclassSpell,
  resetSubclassSpellSwap,
  isKnown,
  isPrepared,
  togglePrepared,
  countPrepared,
} from "../src/rules/characterSpells.ts";
import type { SpellData } from "../src/types/dnd5e.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";

test("getSpellSlotLedger computes standard slots, pact slots, and sorcery points accurately", () => {
  // Multiclass Wizard 3 / Warlock 3 / Sorcerer 2
  const char = makeChar({
    classes: [
      { className: "Wizard", source: "PHB", level: 3 },
      { className: "Warlock", source: "PHB", level: 3 },
      { className: "Sorcerer", source: "PHB", level: 2 },
    ],
    usedSpellSlots: { 1: 2, 2: 1 },
    pactSlotsUsed: 1,
    sorceryPointsUsed: 1,
  });

  const ledger = getSpellSlotLedger(char);

  // Standard caster level: Wizard 3 + Sorcerer 2 = 5
  // Level 5 caster slots: 1st: 4, 2nd: 3, 3rd: 2
  assert.equal(ledger.hasStandardSlots, true);
  const lvl1 = ledger.standardSlots.find((s) => s.level === 1);
  assert.ok(lvl1);
  assert.equal(lvl1.total, 4);
  assert.equal(lvl1.used, 2);
  assert.equal(lvl1.remaining, 2);

  const lvl2 = ledger.standardSlots.find((s) => s.level === 2);
  assert.ok(lvl2);
  assert.equal(lvl2.total, 3);
  assert.equal(lvl2.used, 1);
  assert.equal(lvl2.remaining, 2);

  // Pact slots: Warlock 3 -> 2 slots of 2nd level
  assert.ok(ledger.pactSlots);
  assert.equal(ledger.pactSlots.level, 2);
  assert.equal(ledger.pactSlots.total, 2);
  assert.equal(ledger.pactSlots.used, 1);
  assert.equal(ledger.pactSlots.remaining, 1);

  // Sorcery points: Sorcerer 2 -> 2 max points
  assert.ok(ledger.sorceryPoints);
  assert.equal(ledger.sorceryPoints.max, 2);
  assert.equal(ledger.sorceryPoints.used, 1);
  assert.equal(ledger.sorceryPoints.remaining, 1);
});

test("toggleSpellSlot updates used count incrementally and resets on earlier slot taps", () => {
  const initial = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
  });

  // Tap 1st slot (index 0) when 0 used -> 1 used
  const s1 = toggleSpellSlot(initial, 1, 0);
  assert.equal(s1.usedSpellSlots?.[1], 1);

  // Tap 2nd slot (index 1) when 1 used -> 2 used
  const s2 = toggleSpellSlot(s1, 1, 1);
  assert.equal(s2.usedSpellSlots?.[1], 2);

  // Tap 1st slot (index 0) when 2 used -> unchecks back to 0 used
  const s3 = toggleSpellSlot(s2, 1, 0);
  assert.equal(s3.usedSpellSlots?.[1], 0);

  // Immutability check
  assert.deepEqual(initial.usedSpellSlots, {});
  assert.equal(initial.usedSpellSlots?.[1], undefined);
});

test("togglePactSlot updates pactSlotsUsed correctly", () => {
  const initial = makeChar({
    classes: [{ className: "Warlock", source: "PHB", level: 2 }],
  });

  // Tap 1st slot (index 0) -> 1 used
  const p1 = togglePactSlot(initial, 0);
  assert.equal(p1.pactSlotsUsed, 1);

  // Tap 2nd slot (index 1) -> 2 used
  const p2 = togglePactSlot(p1, 1);
  assert.equal(p2.pactSlotsUsed, 2);

  // Tap 1st slot (index 0) -> resets back to 0
  const p3 = togglePactSlot(p2, 0);
  assert.equal(p3.pactSlotsUsed, 0);
});

test("spendSorceryPoints clamps within 0 and max points", () => {
  const char = makeChar({
    classes: [{ className: "Sorcerer", source: "PHB", level: 3 }],
    sorceryPointsUsed: 1,
  });

  // Spend 1 point
  const spent = spendSorceryPoints(char, 1);
  assert.equal(spent.sorceryPointsUsed, 2);

  // Spend 5 more points (capped at max 3)
  const capped = spendSorceryPoints(spent, 5);
  assert.equal(capped.sorceryPointsUsed, 3);

  // Regain 10 points (floored at 0)
  const regained = spendSorceryPoints(capped, -10);
  assert.equal(regained.sorceryPointsUsed, 0);
});

test("toggleMysticArcanumCast toggles spent state", () => {
  const initial = makeChar({
    classes: [{ className: "Warlock", source: "PHB", level: 11 }],
  });

  const cast = toggleMysticArcanumCast(initial, 6);
  assert.equal(cast.mysticArcanumSpent?.[6], true);

  const uncast = toggleMysticArcanumCast(cast, 6);
  assert.equal(uncast.mysticArcanumSpent?.[6], false);
});

test("toggleInnateSpellUse toggles resource counter remaining uses", () => {
  const char = makeChar();
  const innateSpell = {
    name: "Misty Step",
    source: "MPMM",
    level: 2,
    castLimit: "1/long",
    resourceCounterId: "innate_misty_step",
  };

  const used = toggleInnateSpellUse(char, innateSpell);
  assert.equal(used.resourceCounters?.["innate_misty_step"]?.current, 0);

  const restored = toggleInnateSpellUse(used, innateSpell);
  assert.equal(restored.resourceCounters?.["innate_misty_step"]?.current, 1);
});

test("inscribeRitual and removeInscribedRitual manage Ritual Book entries", () => {
  const initial = makeChar({
    ritualBook: [
      { name: "Detect Magic", source: "PHB", level: 1, isStarting: true },
    ],
  });

  const dummySpell: SpellData = {
    name: "Identify",
    source: "PHB",
    level: 1,
    school: "divination",
    castingTime: "1 minute",
    range: "Touch",
    duration: "Instantaneous",
    ritual: true,
    entries: [],
  };

  const inscribed = inscribeRitual(initial, dummySpell);
  assert.equal(inscribed.ritualBook?.length, 2);
  assert.equal(inscribed.ritualBook?.[1].name, "Identify");
  assert.equal(inscribed.ritualBook?.[1].isStarting, false);

  // Deduplication check: inscribe same spell does nothing
  const dupe = inscribeRitual(inscribed, dummySpell);
  assert.equal(dupe.ritualBook?.length, 2);

  // Cannot remove starting ritual
  const attemptRemoveStart = removeInscribedRitual(inscribed, "Detect Magic");
  assert.equal(attemptRemoveStart.ritualBook?.length, 2);

  // Can remove inscribed non-starting ritual
  const removed = removeInscribedRitual(inscribed, "Identify");
  assert.equal(removed.ritualBook?.length, 1);
  assert.equal(removed.ritualBook?.[0].name, "Detect Magic");
});

test("swapSubclassSpell and resetSubclassSpellSwap manage spell replacements", () => {
  const initial = makeChar();

  const swapped = swapSubclassSpell(initial, "Armor of Agathys", "Shield");
  assert.equal(swapped.subclassSpellSwaps?.["Armor of Agathys"], "Shield");

  const reset = resetSubclassSpellSwap(swapped, "armor of agathys");
  assert.equal(reset.subclassSpellSwaps, undefined);
});


function spell(name: string, source: string, level: number, classes: string[]): SpellData {
  return {
    name, source, level, school: "Evocation", castingTime: "1 action", range: "Self",
    components: { verbal: true, somatic: true, material: false }, componentsString: "V, S",
    duration: "Instantaneous", concentration: false, ritual: false, classes, subclasses: [],
    damageTypes: [], savingThrows: [], description: "", higherLevels: null, entries: [],
  } as unknown as SpellData;
}

const BLESS = spell("Bless", "PHB", 1, ["Cleric", "Paladin"]);
const CURE_WOUNDS = spell("Cure Wounds", "PHB", 1, ["Bard", "Cleric", "Druid", "Paladin", "Ranger"]);
const SANCTUARY = spell("Sanctuary", "PHB", 1, ["Cleric"]);
const MAGIC_MISSILE = spell("Magic Missile", "PHB", 1, ["Sorcerer", "Wizard"]);
const SHIELD = spell("Shield", "PHB", 1, ["Sorcerer", "Wizard"]);
const SCORCHING_RAY = spell("Scorching Ray", "PHB", 2, ["Sorcerer", "Wizard"]);
const SANCTUARY_WARD = spell("Sanctuary Ward", "XGE", 1, ["Cleric"]);
const SPELLS = [BLESS, CURE_WOUNDS, SANCTUARY, MAGIC_MISSILE, SHIELD, SCORCHING_RAY, SANCTUARY_WARD];

// Every Ledger test runs against an SRD-style and an integrated in-memory Compendium (CODING_STANDARDS §4).
const MODES = [
  ["SRD", inMemoryCompendium({ spells: SPELLS })],
  ["integrated", inMemoryCompendium({ spells: SPELLS }, { integrated: true })],
] as const;

const PHB = ["PHB"];

function cls(className: string, level: number, subclassName?: string, source = "PHB"): CharacterClass {
  return { className, source, level, subclassName };
}

function profileFor(char: Character, className: string) {
  const profile = getClassSpellProfiles(char).find((p) => p.className === className);
  assert.ok(profile, `expected a ${className} profile`);
  return profile;
}

for (const [mode, compendium] of MODES) {
  test(`togglePrepared adds and removes spells from preparedSpells (${mode})`, () => {
    const cleric = makeChar({
      classes: [cls("Cleric", 1)],
      knownSpells: [
        { name: "Cure Wounds", source: "PHB", ownerKey: "Cleric__PHB" },
        { name: "Bless", source: "PHB", ownerKey: "Cleric__PHB" },
      ],
      preparedSpells: ["Cure Wounds__PHB__Cleric__PHB"],
    });
    const profile = profileFor(cleric, "Cleric");

    // Unprepare Cure Wounds
    const unprepared = togglePrepared(cleric, profile, { name: "Cure Wounds", source: "PHB" }, compendium, PHB);
    assert.equal(unprepared.preparedSpells?.length, 0);

    // Prepare Bless
    const prepared = togglePrepared(unprepared, profile, { name: "Bless", source: "PHB" }, compendium, PHB);
    assert.equal(prepared.preparedSpells?.length, 1);
    assert.equal(prepared.preparedSpells?.[0], "Bless__PHB__Cleric__PHB");
  });

  test(`togglePrepared rejects a spell outside the owner's class list and returns the character unchanged (${mode})`, () => {
    const cleric = makeChar({ classes: [cls("Cleric", 3)] });
    const profile = profileFor(cleric, "Cleric");

    const next = togglePrepared(cleric, profile, { name: "Magic Missile", source: "PHB" }, compendium, PHB);
    assert.strictEqual(next, cleric);
  });

  test(`togglePrepared rejects a spell from an inactive book (${mode})`, () => {
    const cleric = makeChar({ classes: [cls("Cleric", 3)] });
    const profile = profileFor(cleric, "Cleric");
    const target = { name: "Sanctuary Ward", source: "XGE" };

    assert.strictEqual(togglePrepared(cleric, profile, target, compendium, PHB), cleric);

    const withXge = togglePrepared(cleric, profile, target, compendium, ["PHB", "XGE"]);
    assert.deepEqual(withXge.preparedSpells, ["Sanctuary Ward__XGE__Cleric__PHB"]);
  });

  test(`togglePrepared rejects a spell above the owner's maximum spell level (${mode})`, () => {
    const wizard = makeChar({ classes: [cls("Wizard", 1)] });
    const profile = profileFor(wizard, "Wizard");

    assert.strictEqual(togglePrepared(wizard, profile, { name: "Scorching Ray", source: "PHB" }, compendium, PHB), wizard);
  });

  test(`Fighter Eldritch Knight and Rogue Arcane Trickster prepare from the Wizard list (${mode})`, () => {
    const ek = makeChar({ classes: [cls("Fighter", 3, "Eldritch Knight")] });
    const ekProfile = profileFor(ek, "Fighter");

    const withMissile = togglePrepared(ek, ekProfile, { name: "Magic Missile", source: "PHB" }, compendium, PHB);
    assert.deepEqual(withMissile.preparedSpells, ["Magic Missile__PHB__Fighter__PHB"]);
    assert.strictEqual(togglePrepared(ek, ekProfile, { name: "Cure Wounds", source: "PHB" }, compendium, PHB), ek);

    const at = makeChar({ classes: [cls("Rogue", 3, "Arcane Trickster")] });
    const atProfile = profileFor(at, "Rogue");
    assert.deepEqual(
      togglePrepared(at, atProfile, { name: "Shield", source: "PHB" }, compendium, PHB).preparedSpells,
      ["Shield__PHB__Rogue__PHB"],
    );
    assert.strictEqual(togglePrepared(at, atProfile, { name: "Cure Wounds", source: "PHB" }, compendium, PHB), at);
  });

  test(`always-prepared spells cannot be toggled and do not count against the preparation limit (${mode})`, () => {
    // Life Domain Cleric 1: Bless and Cure Wounds are always prepared.
    const lifeCleric = makeChar({
      baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
      classes: [cls("Cleric", 1, "Life Domain")],
      knownSpells: [
        { name: "Bless", source: "PHB", ownerKey: "Cleric__PHB" },
        { name: "Sanctuary", source: "PHB", ownerKey: "Cleric__PHB" },
      ],
      preparedSpells: ["Bless__PHB__Cleric__PHB", "Sanctuary__PHB__Cleric__PHB"],
    });
    const profile = profileFor(lifeCleric, "Cleric");

    assert.strictEqual(togglePrepared(lifeCleric, profile, { name: "Bless", source: "PHB" }, compendium, PHB), lifeCleric);
    assert.equal(countPrepared(lifeCleric, profile, compendium), 1);
  });

  test(`the same spell prepared under two owners stays independent (${mode})`, () => {
    const char = makeChar({
      classes: [cls("Cleric", 2), cls("Druid", 2)],
      knownSpells: [
        { name: "Cure Wounds", source: "PHB", ownerKey: "Cleric__PHB" },
        { name: "Cure Wounds", source: "PHB", ownerKey: "Druid__PHB" },
      ],
    });
    const cleric = profileFor(char, "Cleric");
    const druid = profileFor(char, "Druid");
    const target = { name: "Cure Wounds", source: "PHB" };

    const clericPrepared = togglePrepared(char, cleric, target, compendium, PHB);
    assert.deepEqual(clericPrepared.preparedSpells, ["Cure Wounds__PHB__Cleric__PHB"]);
    assert.equal(isPrepared(clericPrepared, cleric, target), true);
    assert.equal(isPrepared(clericPrepared, druid, target), false);

    const bothPrepared = togglePrepared(clericPrepared, druid, target, compendium, PHB);
    assert.equal(isPrepared(bothPrepared, druid, target), true);

    // Unpreparing under Cleric leaves the Druid's preparation alone.
    const druidOnly = togglePrepared(bothPrepared, cleric, target, compendium, PHB);
    assert.deepEqual(druidOnly.preparedSpells, ["Cure Wounds__PHB__Druid__PHB"]);
    assert.equal(isPrepared(druidOnly, druid, target), true);
    assert.equal(isPrepared(druidOnly, cleric, target), false);
  });

  test(`legacy two-part keys still count as prepared (${mode})`, () => {
    const char = makeChar({
      classes: [cls("Cleric", 3)],
      knownSpells: [{ name: "Cure Wounds", source: "PHB", ownerKey: "Cleric__PHB" }],
      preparedSpells: ["Cure Wounds__PHB"],
    });
    const profile = profileFor(char, "Cleric");
    const target = { name: "Cure Wounds", source: "PHB" };

    assert.equal(isPrepared(char, profile, target), true);
    assert.equal(countPrepared(char, profile, compendium), 1);

    const unprepared = togglePrepared(char, profile, target, compendium, PHB);
    assert.deepEqual(unprepared.preparedSpells, []);
  });

  test(`prepared-limit overrun is a warning, not a rejection (${mode})`, () => {
    const wizard = makeChar({
      baseAbilityScores: { str: 10, dex: 10, con: 10, int: 8, wis: 10, cha: 10 },
      classes: [cls("Wizard", 1)],
      knownSpells: [
        { name: "Magic Missile", source: "PHB", ownerKey: "Wizard__PHB" },
        { name: "Shield", source: "PHB", ownerKey: "Wizard__PHB" },
      ],
    });
    const profile = profileFor(wizard, "Wizard");
    assert.equal(profile.preparedLimit, 1);

    const one = togglePrepared(wizard, profile, { name: "Magic Missile", source: "PHB" }, compendium, PHB);
    const two = togglePrepared(one, profile, { name: "Shield", source: "PHB" }, compendium, PHB);
    assert.deepEqual(two.preparedSpells, ["Magic Missile__PHB__Wizard__PHB", "Shield__PHB__Wizard__PHB"]);
    assert.equal(countPrepared(two, profile, compendium), 2);
  });

  test(`isKnown matches the Giant Barbarian owner (${mode})`, () => {
    const giant = makeChar({
      baseAbilityScores: { str: 16, dex: 14, con: 16, int: 10, wis: 14, cha: 8 },
      classes: [cls("Barbarian", 3, "Path of the Giant")],
      knownSpells: [{ name: "Druidcraft", source: "PHB", ownerKey: "Barbarian__BGG", className: "Barbarian" }],
    });
    const profile = profileFor(giant, "Barbarian");

    assert.equal(profile.ownerKey, "Barbarian__BGG");
    assert.equal(isKnown(giant, profile, { name: "Druidcraft", source: "PHB" }), true);
    assert.equal(isKnown(giant, profile, { name: "Thaumaturgy", source: "PHB" }), false);
  });
}
