import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
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
  togglePreparedSpell,
} from "../src/rules/characterSpells.ts";
import type { SpellData } from "../src/types/dnd5e.ts";

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

test("togglePreparedSpell adds and removes spells from preparedSpells", () => {
  const initial = makeChar({
    preparedSpells: ["Cure Wounds__PHB__Cleric__PHB"],
  });

  // Unprepare Cure Wounds
  const unprepared = togglePreparedSpell(initial, { name: "Cure Wounds", source: "PHB", ownerKey: "Cleric__PHB" });
  assert.equal(unprepared.preparedSpells?.length, 0);

  // Prepare Bless
  const prepared = togglePreparedSpell(unprepared, { name: "Bless", source: "PHB", ownerKey: "Cleric__PHB" });
  assert.equal(prepared.preparedSpells?.length, 1);
  assert.equal(prepared.preparedSpells?.[0], "Bless__PHB__Cleric__PHB");
});
