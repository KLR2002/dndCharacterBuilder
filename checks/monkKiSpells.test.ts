import test from "node:test";
import assert from "node:assert/strict";
import {
  isCastingClass,
  getSpellcastingAbility,
  getClassSpellProfiles,
} from "../src/rules/spellcasting.ts";
import { getSubclassSpells } from "../src/rules/subclassSpells.ts";
import {
  subclassRuleChoices,
  availableSubclassRuleChoices,
} from "../src/rules/ruleChoices.ts";
import type { Character } from "../src/types/character.ts";

function createMonk(
  level: number,
  subclassName?: string,
  extra: Partial<Character> = {}
): Character {
  return {
    id: "test-monk",
    name: "Master Li",
    folderId: null,
    gender: "Male",
    alignment: "Lawful Neutral",
    faction: { name: "", rank: "", renown: "", notes: "" },
    avatarUri: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    abilityMethod: "standardArray",
    baseAbilityScores: {
      str: 10,
      dex: 16,
      con: 14,
      int: 10,
      wis: 16, // +3 Wis mod
      cha: 8,
    },
    customLineage: false,
    lineageReplacement: null,
    race: { name: "Human", source: "PHB" },
    racialAbilityBonuses: {},
    background: { name: "Hermit", source: "PHB" },
    classes: [
      {
        className: "Monk",
        level,
        source: "PHB",
        subclassName,
        subclass: subclassName,
      },
    ],
    inventory: [],
    customProficiencies: [],
    customFeatures: [],
    conditions: [],
    ...extra,
  };
}

test("isCastingClass recognizes Monk only with spellcasting subclasses at level >= 3", () => {
  // Low level monk
  assert.equal(
    isCastingClass({ className: "Monk", level: 1, source: "PHB" }),
    false
  );
  assert.equal(
    isCastingClass({
      className: "Monk",
      level: 2,
      source: "PHB",
      subclassName: "Way of Shadow",
    }),
    false
  );

  // Non-spellcasting subclasses
  assert.equal(
    isCastingClass({
      className: "Monk",
      level: 3,
      source: "PHB",
      subclassName: "Way of the Open Hand",
    }),
    false
  );
  assert.equal(
    isCastingClass({
      className: "Monk",
      level: 5,
      source: "PHB",
      subclassName: "Way of the Kensei",
    }),
    false
  );

  // Spellcasting subclasses
  assert.equal(
    isCastingClass({
      className: "Monk",
      level: 3,
      source: "PHB",
      subclassName: "Way of Shadow",
    }),
    true
  );
  assert.equal(
    isCastingClass({
      className: "Monk",
      level: 3,
      source: "PHB",
      subclassName: "Way of the Four Elements",
    }),
    true
  );
  assert.equal(
    isCastingClass({
      className: "Monk",
      level: 3,
      source: "PHB",
      subclassName: "Way of the Sun Soul",
    }),
    true
  );
});

test("getSpellcastingAbility returns Wisdom for Monks", () => {
  assert.equal(
    getSpellcastingAbility({
      className: "Monk",
      level: 3,
      source: "PHB",
      subclassName: "Way of Shadow",
    }),
    "wis"
  );
});

test("getClassSpellProfiles generates a valid Ki Spellcasting Profile for Way of Shadow", () => {
  const monk = createMonk(3, "Way of Shadow"); // PB = +2, Wis = 16 (+3)
  const profiles = getClassSpellProfiles(monk);

  assert.equal(profiles.length, 1);
  const p = profiles[0];
  assert.equal(p.className, "Monk");
  assert.equal(p.subclass, "Way of Shadow");
  assert.equal(p.ability, "wis");
  assert.equal(p.spellSaveDc, 13); // 8 + 2 (PB) + 3 (Wis)
  assert.equal(p.spellAttackBonus, 5); // 2 (PB) + 3 (Wis)
  assert.equal(p.preparedLimit, undefined);

  // Check shadow spells
  const shadowSpells = p.subclassKnownSpells || [];
  const names = shadowSpells.map((s) => s.name.toLowerCase());
  assert.ok(names.includes("minor illusion"));
  assert.ok(names.includes("darkness"));
  assert.ok(names.includes("darkvision"));
  assert.ok(names.includes("pass without trace"));
  assert.ok(names.includes("silence"));

  const darkness = shadowSpells.find((s) => s.name.toLowerCase() === "darkness");
  assert.equal(darkness?.kiCost, 2);
});

test("Way of the Sun Soul grants Burning Hands (2 Ki) at level 6", () => {
  const monkLvl3 = createMonk(3, "Way of the Sun Soul");
  const subLvl3 = getSubclassSpells("Monk", "Way of the Sun Soul", 3);
  assert.equal(subLvl3.known.some((s) => s.name.toLowerCase() === "burning hands"), false);

  const monkLvl6 = createMonk(6, "Way of the Sun Soul");
  const subLvl6 = getSubclassSpells("Monk", "Way of the Sun Soul", 6);
  const bh = subLvl6.known.find((s) => s.name.toLowerCase() === "burning hands");
  assert.ok(bh, "Burning hands should be granted at level 6");
  assert.equal(bh?.kiCost, 2);

  const profiles = getClassSpellProfiles(monkLvl6);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].spellSaveDc, 14); // level 6 PB = 3, Wis = 3 -> 8 + 3 + 3 = 14
});

test("Way of the Four Elements: discipline choices and automatic Elemental Attunement", () => {
  // Level 3 monk with no choices yet
  const monk = createMonk(3, "Way of the Four Elements");
  const sub = getSubclassSpells("Monk", "Way of the Four Elements", 3);
  assert.ok(
    sub.cantrips.some((c) => c.name === "Elemental Attunement"),
    "Should grant Elemental Attunement automatically"
  );

  // Offers discipline choices at level milestones
  const choicesLvl3 = subclassRuleChoices(monk);
  assert.equal(choicesLvl3.length, 1);
  assert.equal(choicesLvl3[0].traitName, "Elemental Discipline (3rd Level)");
  assert.equal(choicesLvl3[0].options.length >= 7, true);

  // Boundary verification (CODING_STANDARDS §4): Higher-level disciplines must NOT be available at 3rd level
  assert.equal(
    choicesLvl3[0].options.some((o) => o.name === "Clench of the North Wind"),
    false,
    "Level 6 discipline Clench of the North Wind must not be offered at level 3"
  );
  assert.equal(
    choicesLvl3[0].options.some((o) => o.name === "Flames of the Phoenix"),
    false,
    "Level 11 discipline Flames of the Phoenix must not be offered at level 3"
  );
  assert.equal(
    choicesLvl3[0].options.some((o) => o.name === "Breath of Winter"),
    false,
    "Level 17 discipline Breath of Winter must not be offered at level 3"
  );

  // Pre-subclass boundary check: level 2 Monk offers 0 subclass choices
  const monk2 = createMonk(2, "Way of the Four Elements");
  assert.equal(subclassRuleChoices(monk2).length, 0, "Level 2 monk must not offer Four Elements choices");

  // Level 6 offers both 3rd and 6th level disciplines
  const monk6 = createMonk(6, "Way of the Four Elements");
  const choicesLvl6 = subclassRuleChoices(monk6);
  assert.equal(choicesLvl6.length, 2); // 3rd level and 6th level choices
  assert.ok(choicesLvl6[1].options.some((o) => o.name === "Clench of the North Wind"));
  assert.equal(
    choicesLvl6[1].options.some((o) => o.name === "Flames of the Phoenix"),
    false,
    "Level 11 discipline Flames of the Phoenix must not be offered at level 6"
  );

  // Level 11 and 17 progression
  const monk17 = createMonk(17, "Way of the Four Elements");
  const choicesLvl17 = subclassRuleChoices(monk17);
  assert.equal(choicesLvl17.length, 4); // 3, 6, 11, 17

  // With choices selected in character.ruleChoices
  const monkWithPicks = createMonk(6, "Way of the Four Elements", {
    ruleChoices: [
      {
        id: "PHB__Monk__Way of the Four Elements__Discipline 3",
        trait: "Elemental Discipline (3rd Level)",
        origin: "subclass",
        choose: 1,
        from: [],
        picked: ["Sweeping Cinder Strike"],
      },
      {
        id: "PHB__Monk__Way of the Four Elements__Discipline 6",
        trait: "Elemental Discipline (6th Level)",
        origin: "subclass",
        choose: 1,
        from: [],
        picked: ["Clench of the North Wind"],
      },
    ],
  });

  const profiles = getClassSpellProfiles(monkWithPicks);
  assert.equal(profiles.length, 1);
  const spells = profiles[0].subclassKnownSpells || [];

  const burningHands = spells.find((s) => s.name.toLowerCase() === "burning hands");
  assert.ok(burningHands, "Sweeping Cinder Strike should resolve to Burning Hands");
  assert.equal(burningHands?.kiCost, 2);

  const holdPerson = spells.find((s) => s.name.toLowerCase() === "hold person");
  assert.ok(holdPerson, "Clench of the North Wind should resolve to Hold Person");
  assert.equal(holdPerson?.kiCost, 3);
});

test("Multiclass Monk 3 (Shadow) / Cleric 1 generates separate spell profiles", () => {
  const multiclassChar = createMonk(3, "Way of Shadow", {
    classes: [
      {
        className: "Monk",
        level: 3,
        source: "PHB",
        subclassName: "Way of Shadow",
        subclass: "Way of Shadow",
      },
      {
        className: "Cleric",
        level: 1,
        source: "PHB",
        subclassName: "Life Domain",
        subclass: "Life Domain",
      },
    ],
  });

  const profiles = getClassSpellProfiles(multiclassChar);
  assert.equal(profiles.length, 2);

  const monkProfile = profiles.find((p) => p.className === "Monk");
  const clericProfile = profiles.find((p) => p.className === "Cleric");

  assert.ok(monkProfile);
  assert.ok(clericProfile);
  assert.equal(monkProfile?.ability, "wis");
  assert.equal(clericProfile?.ability, "wis");
  assert.equal(monkProfile?.preparedLimit, undefined);
  assert.equal(clericProfile?.preparedLimit, 4); // 1 (cleric lvl) + 3 (wis) = 4
});
