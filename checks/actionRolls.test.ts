import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { makeChar } from "./testUtils.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { getTacticalActionLedger } from "../src/rules/tacticalActions.ts";
import { damagePoolOf, rollActionAttack, rollActionDamage } from "../src/rules/actionRolls.ts";
import type { RollLogEntryInput } from "../src/rules/rollLog.ts";
import { appRandom, currentRandom, __setRandomSourceForTests, rollD20, type RandomSource } from "../src/rules/dice.ts";

/** A random source with fixed faces, cycling: each die lands on the next queued face. */
function fixedFaces(faces: number[]): RandomSource {
  let index = 0;
  return (sides) => {
    const face = faces[index++ % faces.length];
    return Math.min(sides, Math.max(1, face));
  };
}

/** A spellcaster with spent slots, a used feature counter, a used hit die and ammunition in the pack. */
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
      second_wind: { id: "second_wind", name: "Second Wind", current: 0, max: 1, resetOn: "short" },
    },
    items: [
      { id: "w1", name: "Dagger", source: "PHB", quantity: 1, isEquipped: true, section: "equipped", damage: "1d4", damageType: "piercing" },
      { id: "ammo", name: "Arrows (20)", source: "SRD", quantity: 1, isEquipped: false, section: "carried" },
    ],
  });
}

test("rolling an attack and its damage through the tab's code path leaves slots, uses and ammunition unchanged", () => {
  const char = spellcasterWithSpentResources();
  const before = JSON.parse(JSON.stringify(char));

  const evaluated = evaluateCharacter(char, { activeBooks: ALL_BOOKS });
  const ledger = getTacticalActionLedger(char, evaluated, { activeBooks: ALL_BOOKS });
  const attack = ledger.weaponAttacks.find((a) => a.name === "Dagger");
  assert.ok(attack);
  assert.equal(attack.attackBonus, 4);
  assert.equal(attack.damage, "1d4 + 2");

  // The publish seam the Roll Log provider hands the badge: entries only, no Character write.
  const entries: RollLogEntryInput[] = [];
  const publish = (input: RollLogEntryInput) => {
    entries.push(input);
  };

  const fixed = fixedFaces([15, 4]);
  const sources = { source: `${attack.name} attack`, damageSource: `${attack.name} damage`, characterName: char.name };
  const roll = rollActionAttack(attack, sources, "none", publish, fixed);
  assert.equal(roll.total, 15 + 4);
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

  // The roll spent nothing.
  assert.deepEqual(JSON.parse(JSON.stringify(char)), before);
});

test("a natural 20 offers critical damage with doubled dice and the modifier once", () => {
  const char = spellcasterWithSpentResources();
  const evaluated = evaluateCharacter(char, { activeBooks: ALL_BOOKS });
  const ledger = getTacticalActionLedger(char, evaluated, { activeBooks: ALL_BOOKS });
  const attack = ledger.weaponAttacks.find((a) => a.name === "Dagger");
  assert.ok(attack);

  const entries: RollLogEntryInput[] = [];
  const publish = (input: RollLogEntryInput) => {
    entries.push(input);
  };
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

test("a damage-only roll (the damage badge's tap) publishes just the damage", () => {
  const entries: RollLogEntryInput[] = [];
  const publish = (input: RollLogEntryInput) => {
    entries.push(input);
  };
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
  // Cleric casts with Wis (+3), Wizard with Int (+2); proficiency +2 at total level 2.
  const sacredFlame = ledger.spellAttacks.find((s) => s.name === "Sacred Flame");
  const fireBolt = ledger.spellAttacks.find((s) => s.name === "Fire Bolt");
  const light = ledger.spellAttacks.find((s) => s.name === "Light");
  assert.ok(sacredFlame && fireBolt && light);
  assert.equal(sacredFlame.attackBonus, 5);
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
