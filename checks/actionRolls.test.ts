import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { makeChar } from "./testUtils.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { getTacticalActionLedger } from "../src/rules/tacticalActions.ts";
import { damagePoolOf, pressRollBadge, rollActionAttack, rollActionDamage, type RollAndPublish } from "../src/rules/actionRolls.ts";
import type { RollLogEntryInput } from "../src/rules/rollLog.ts";
import { appRandom, currentRandom, __setRandomSourceForTests, rollD20, type RandomSource } from "../src/rules/dice.ts";
import { replayRandom } from "../src/rules/throwRoll.ts";
import { planLevelUp, rollPlanHitPoints, type LevelUpPlan } from "../src/rules/levelUpFlow.ts";

/** A random source with fixed faces, cycling: each die lands on the next queued face. */
function fixedFaces(faces: number[]): RandomSource {
  let index = 0;
  return (sides) => {
    const face = faces[index++ % faces.length];
    return Math.min(sides, Math.max(1, face));
  };
}

/**
 * The roll seam with the Roll Log provider's contract and no throw: it runs `make` once with `random`
 * (the seam's own source) and records every input it publishes.
 */
function recordingSeam(entries: RollLogEntryInput[], random: RandomSource = fixedFaces([1])): RollAndPublish {
  return (make) => {
    const made = make(random);
    entries.push(...(Array.isArray(made) ? made : [made]));
    return made;
  };
}

/** A random source that shows 1 on every die: a Throw's recording pass learns the dice from it. */
const recordingRandom: RandomSource = () => 1;

/**
 * The Throw-mode seam: `make` runs twice, first with `recordingRandom`, then with the settled faces, and
 * only the second run is published. The settled faces are consumed in order across the seam's runs, as
 * the dice of successive Rolls are; `fallback` supplies any die past them.
 */
function twoPassSeam(entries: RollLogEntryInput[], settled: number[], fallback: RandomSource = fixedFaces([3])): RollAndPublish {
  const replay = replayRandom(settled, fallback);
  return (make) => {
    make(recordingRandom);
    const made = make(replay);
    entries.push(...(Array.isArray(made) ? made : [made]));
    return made;
  };
}

const DAGGER_ORIGIN = { source: "Dagger attack", damageSource: "Dagger damage", characterName: "Elowen" };

/** The Dagger row of the spellcaster's ledger: attack bonus +4, damage 1d4 + 2. */
function daggerAttack() {
  const char = spellcasterWithSpentResources();
  const evaluated = evaluateCharacter(char, { activeBooks: ALL_BOOKS });
  const attack = getTacticalActionLedger(char, evaluated, { activeBooks: ALL_BOOKS }).weaponAttacks.find((a) => a.name === "Dagger");
  assert.ok(attack);
  return attack;
}

/** A spellcaster with spell slots left, a limited-use feature with uses left and ammunition in the pack. */
function spellcasterWithSpentResources() {
  return makeChar({
    id: "char_action_rolls",
    name: "Elowen",
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
    baseAbilityScores: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    knownSpells: [{ name: "Fire Bolt", source: "PHB", ownerKey: "Wizard__PHB" }],
    usedSpellSlots: { 1: 1, 2: 1 },
    sorceryPointsUsed: 2,
    usedHitDice: { d6: 1 },
    resourceCounters: {
      second_wind: { id: "second_wind", name: "Second Wind", current: 1, max: 1, resetOn: "short" },
    },
    items: [
      { id: "w1", name: "Dagger", source: "PHB", quantity: 1, isEquipped: true, damage: "1d4", damageType: "piercing" },
      { id: "ammo", name: "Arrows (20)", source: "SRD", quantity: 20, isEquipped: false },
    ],
  });
}

test("rolling an attack, its damage and a spell attack through the badge path leaves slots, uses and ammunition unchanged", () => {
  const char = spellcasterWithSpentResources();
  const before = JSON.parse(JSON.stringify(char));

  // The tab's code path: the character flows through the engine and the ledger, and each badge tap goes
  // through pressRollBadge, the same handler RollBadge calls.
  const evaluated = evaluateCharacter(char, { activeBooks: ALL_BOOKS });
  const ledger = getTacticalActionLedger(char, evaluated, { activeBooks: ALL_BOOKS });
  const attack = ledger.weaponAttacks.find((a) => a.name === "Dagger");
  assert.ok(attack);
  assert.equal(attack.attackBonus, 4);
  assert.equal(attack.damage, "1d4 + 2");
  const fireBolt = ledger.spellAttacks.find((s) => s.name === "Fire Bolt");
  assert.ok(fireBolt);
  assert.equal(fireBolt.attackBonus, 5);

  // The publish seam the Roll Log provider hands the badge: entries only, no Character write.
  const entries: RollLogEntryInput[] = [];
  const publish = recordingSeam(entries);

  const fixed = fixedFaces([15, 4]);
  const roll = pressRollBadge(
    {
      modifier: attack.attackBonus,
      pool: damagePoolOf(attack.damage) ?? undefined,
      source: `${attack.name} attack`,
      poolSource: `${attack.name} damage`,
      characterName: char.name,
    },
    "none",
    publish,
    fixed,
  );
  assert.equal(roll?.total, 15 + 4);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "Dagger attack");
  assert.equal(entries[0].characterName, "Elowen");
  assert.equal(entries[0].d20Mode, "none");
  assert.equal(entries[0].followUp?.label, "Roll damage");

  // The result card's follow-up rolls the damage.
  entries[0].followUp!.onPress();
  assert.equal(entries.length, 2);
  const damage = entries[1];
  assert.equal(damage.source, "Dagger damage");
  assert.equal(damage.characterName, "Elowen");
  assert.equal(damage.critical, false);
  assert.equal(damage.roll.dice.length, 1);
  assert.equal(damage.roll.dice[0].sides, 4);
  assert.equal(damage.roll.dice[0].face, 4);
  assert.equal(damage.roll.modifier, 2);
  assert.equal(damage.roll.total, 6);

  // The spell row's badge tap: a d20 with the profile's bonus, no damage pool on a cantrip.
  const spellRoll = pressRollBadge(
    {
      modifier: fireBolt.attackBonus,
      pool: damagePoolOf(fireBolt.damage) ?? undefined,
      source: `${fireBolt.name} attack`,
      poolSource: `${fireBolt.name} damage`,
      characterName: char.name,
    },
    "none",
    publish,
    fixed,
  );
  assert.equal(spellRoll?.total, 15 + 5);
  assert.equal(entries.length, 3);
  assert.equal(entries[2].source, "Fire Bolt attack");
  assert.equal(entries[2].followUp, undefined);

  // The rolls spent nothing.
  assert.deepEqual(JSON.parse(JSON.stringify(char)), before);
});

test("a natural 20 offers critical damage with doubled dice and the modifier once", () => {
  const char = spellcasterWithSpentResources();
  const evaluated = evaluateCharacter(char, { activeBooks: ALL_BOOKS });
  const ledger = getTacticalActionLedger(char, evaluated, { activeBooks: ALL_BOOKS });
  const attack = ledger.weaponAttacks.find((a) => a.name === "Dagger");
  assert.ok(attack);

  const entries: RollLogEntryInput[] = [];
  const publish = recordingSeam(entries);
  const fixed = fixedFaces([20, 3, 5, 2]);
  rollActionAttack(attack, { source: "Dagger attack", damageSource: "Dagger damage", characterName: char.name }, "advantage", publish, fixed);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].d20Mode, "advantage");
  assert.deepEqual(entries[0].roll.dice.map((d) => [d.face, d.dropped]), [[20, false], [3, true]]);
  assert.equal(entries[0].roll.total, 20 + 4);
  assert.equal(entries[0].followUp?.label, "Roll critical damage");

  entries[0].followUp!.onPress();
  const damage = entries[1];
  assert.equal(damage.source, "Dagger damage");
  assert.equal(damage.critical, true);
  // 1d4 doubles to 2d4; the +2 modifier is not doubled.
  assert.deepEqual(damage.roll.dice.map((d) => d.sides), [4, 4]);
  assert.deepEqual(damage.roll.dice.map((d) => d.face), [4, 2]);
  assert.equal(damage.roll.modifier, 2);
  assert.equal(damage.roll.total, 4 + 2 + 2);

  assert.deepEqual(JSON.parse(JSON.stringify(char)), JSON.parse(JSON.stringify(spellcasterWithSpentResources())));
});

test("the seam's own random decides the attack: a settled natural 20 offers critical damage, a 7 offers damage", () => {
  const char = spellcasterWithSpentResources();
  const evaluated = evaluateCharacter(char, { activeBooks: ALL_BOOKS });
  const ledger = getTacticalActionLedger(char, evaluated, { activeBooks: ALL_BOOKS });
  const attack = ledger.weaponAttacks.find((a) => a.name === "Dagger");
  assert.ok(attack);
  const origin = { source: "Dagger attack", damageSource: "Dagger damage", characterName: char.name };

  const onTwenty: RollLogEntryInput[] = [];
  const twentyRoll = rollActionAttack(attack, origin, "none", recordingSeam(onTwenty, replayRandom([20], fixedFaces([3]))));
  assert.equal(twentyRoll.dice[0].face, 20);
  assert.equal(onTwenty.length, 1);
  assert.equal(onTwenty[0].followUp?.label, "Roll critical damage");

  const onSeven: RollLogEntryInput[] = [];
  const sevenRoll = rollActionAttack(attack, origin, "none", recordingSeam(onSeven, replayRandom([7], fixedFaces([3]))));
  assert.equal(sevenRoll.dice[0].face, 7);
  assert.equal(onSeven[0].followUp?.label, "Roll damage");

  // The follow-up runs through the seam again, and the critical flag reaches the damage entry.
  const followed: RollLogEntryInput[] = [];
  rollActionAttack(attack, origin, "none", recordingSeam(followed, replayRandom([20], fixedFaces([3]))));
  followed[0].followUp!.onPress();
  assert.equal(followed.length, 2);
  assert.equal(followed[1].critical, true);
  assert.equal(followed[1].roll.dice.length, 2);
});

test("through a two-pass seam a replayed natural 20 is the Roll returned and published, and its follow-up rolls doubled dice", () => {
  const entries: RollLogEntryInput[] = [];
  const roll = rollActionAttack(daggerAttack(), DAGGER_ORIGIN, "none", twoPassSeam(entries, [20, 4, 2]));
  assert.deepEqual(roll.dice.map((die) => die.face), [20]);
  assert.equal(roll.total, 24);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].roll, roll);
  assert.equal(entries[0].followUp?.label, "Roll critical damage");

  entries[0].followUp!.onPress();
  assert.equal(entries.length, 2);
  assert.equal(entries[1].critical, true);
  assert.deepEqual(entries[1].roll.dice.map((die) => die.sides), [4, 4]);
  assert.deepEqual(entries[1].roll.dice.map((die) => die.face), [4, 2]);
  assert.equal(entries[1].roll.modifier, 2);
});

test("through a two-pass seam a replayed 7 offers the damage follow-up", () => {
  const entries: RollLogEntryInput[] = [];
  const roll = rollActionAttack(daggerAttack(), DAGGER_ORIGIN, "none", twoPassSeam(entries, [7]));
  assert.equal(roll.dice[0].face, 7);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].followUp?.label, "Roll damage");
});

test("a Hit Points roll through a two-pass seam commits the face of the published Roll, the replay's", () => {
  const char = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", source: "PHB", level: 2 }],
  });
  const planned = planLevelUp(char, { className: "Fighter", hitPoints: { mode: "average" } });
  if (!planned.ok) assert.fail(planned.reason);
  const made: { plan?: LevelUpPlan } = {};
  const entries: RollLogEntryInput[] = [];
  twoPassSeam(entries, [9])((random) => {
    const result = rollPlanHitPoints(planned.plan, char, random);
    made.plan = result.plan;
    return { roll: result.roll, source: "Hit Points", characterName: char.name };
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].roll.dice[0].face, 9);
  assert.equal(made.plan?.hitPoints.roll, 9);
  assert.equal(made.plan?.hitPoints.amount, 11, "face 9 + Con 2");
});

test("a damage-only roll (the damage badge's tap) publishes just the damage", () => {
  const entries: RollLogEntryInput[] = [];
  const publish = recordingSeam(entries);
  const roll = rollActionDamage("1d8 + 3", { source: "Longsword damage", characterName: "Kara" }, publish, false, fixedFaces([6]));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].source, "Longsword damage");
  assert.equal(entries[0].characterName, "Kara");
  assert.equal(entries[0].critical, false);
  assert.equal(entries[0].d20Mode, undefined);
  assert.equal(entries[0].followUp, undefined);
  assert.equal(roll.dice.length, 1);
  assert.equal(roll.dice[0].face, 6);
  assert.equal(roll.modifier, 3);
  assert.equal(roll.total, 9);
});

test("the ledger gives spell attack rows the casting profile's attack bonus", () => {
  const char = spellcasterWithSpentResources();
  const evaluated = evaluateCharacter(char, { activeBooks: ALL_BOOKS });
  const ledger = getTacticalActionLedger(char, evaluated, { activeBooks: ALL_BOOKS });
  const fireBolt = ledger.spellAttacks.find((s) => s.name === "Fire Bolt");
  assert.ok(fireBolt);
  assert.equal(fireBolt.attackBonus, 5);
});

test("a spell row gets an attack bonus only when the spell makes a spell attack (SRD records)", () => {
  const char = makeChar({
    id: "char_spell_attack_rows",
    name: "Bryn",
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
    baseAbilityScores: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    knownSpells: ["Fire Bolt", "Ray of Frost", "Sacred Flame", "Light", "Fireball"].map((name) => ({
      name,
      source: "PHB",
      ownerKey: "Wizard__PHB",
    })),
  });
  const evaluated = evaluateCharacter(char, { activeBooks: ALL_BOOKS });
  const ledger = getTacticalActionLedger(char, evaluated, { activeBooks: ALL_BOOKS });
  const byName = new Map(ledger.spellAttacks.map((s) => [s.name, s]));
  // Ranged spell attack cantrips roll the profile's bonus, so their rows show a "to hit" badge.
  assert.equal(byName.get("Fire Bolt")?.attackBonus, 5);
  assert.equal(byName.get("Ray of Frost")?.attackBonus, 5);
  // Save-based or utility spells keep their row (and any damage badge) but get no "to hit" badge.
  for (const name of ["Sacred Flame", "Light", "Fireball"]) {
    assert.ok(byName.has(name), `the ${name} row is missing from the ledger`);
    assert.equal(byName.get(name)?.attackBonus, undefined, `${name} must not carry an attack bonus`);
  }
});

test("a multiclass caster's spell rows get the owning profile's bonus; an unowned spell gets none", () => {
  const char = makeChar({
    id: "char_multi_caster",
    name: "Ivo",
    classes: [
      { className: "Cleric", source: "PHB", level: 1 },
      { className: "Wizard", source: "PHB", level: 1 },
    ],
    baseAbilityScores: { str: 8, dex: 10, con: 12, int: 14, wis: 16, cha: 10 },
    knownSpells: [
      { name: "Sacred Flame", source: "PHB", ownerKey: "Cleric__PHB" },
      { name: "Fire Bolt", source: "PHB", ownerKey: "Wizard__PHB" },
      { name: "Light", source: "PHB", ownerKey: "unknown__unknown" },
    ],
  });
  const evaluated = evaluateCharacter(char, { activeBooks: ALL_BOOKS });
  const ledger = getTacticalActionLedger(char, evaluated, { activeBooks: ALL_BOOKS });
  // Cleric casts with Wis (+3), Wizard with Int (+2); proficiency +2 at total level 2. Fire Bolt makes a
  // ranged spell attack, so its row carries the owning Wizard profile's bonus; Sacred Flame is a save and
  // Light is unowned, so neither row carries an attack bonus.
  const sacredFlame = ledger.spellAttacks.find((s) => s.name === "Sacred Flame");
  const fireBolt = ledger.spellAttacks.find((s) => s.name === "Fire Bolt");
  const light = ledger.spellAttacks.find((s) => s.name === "Light");
  assert.ok(sacredFlame && fireBolt && light);
  assert.equal(sacredFlame.attackBonus, undefined);
  assert.equal(fireBolt.attackBonus, 4);
  assert.equal(light.attackBonus, undefined);
});

test("damagePoolOf reads the leading pool of a damage string and rejects flat or non-pool text", () => {
  assert.equal(damagePoolOf("1d8 + 3"), "1d8 + 3");
  assert.equal(damagePoolOf("1d8+3"), "1d8+3");
  assert.equal(damagePoolOf("2d6"), "2d6");
  assert.equal(damagePoolOf("1d10 force"), "1d10");
  assert.equal(damagePoolOf("1d10 + 3 force"), "1d10 + 3");
  assert.equal(damagePoolOf("1d8 + 3 slashing"), "1d8 + 3");
  assert.equal(damagePoolOf("1d6 - 1"), "1d6 - 1");
  // No dice: flat damage is not a roll.
  assert.equal(damagePoolOf("5"), null);
  assert.equal(damagePoolOf("1 + 3"), null);
  // Not a pool at all.
  assert.equal(damagePoolOf("Cantrip scaling"), null);
  assert.equal(damagePoolOf("Spell attack"), null);
  assert.equal(damagePoolOf("2 Ki"), null);
  assert.equal(damagePoolOf(""), null);
  assert.equal(damagePoolOf("abc"), null);
});

test("the default random source is swappable for tests and restores", () => {
  assert.equal(currentRandom(), appRandom);
  __setRandomSourceForTests(fixedFaces([20]));
  assert.equal(rollD20(5).total, 25);
  __setRandomSourceForTests(null);
  assert.equal(currentRandom(), appRandom);
  // An explicit random source still wins over the default.
  assert.equal(rollD20(5, "none", fixedFaces([7])).total, 12);
});
