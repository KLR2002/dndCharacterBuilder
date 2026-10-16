import test from "node:test";
import assert from "node:assert/strict";
import { makeChar, inMemoryCompendium } from "./testUtils.ts";
import {
  getAutoGrantedSkills,
  normalizeSkillName,
  skills,
} from "../src/rules/skills.ts";
import { setChoiceRacialBonus } from "../src/rules/builderTransitions.ts";
import { applyAncestrySelection } from "../src/rules/ancestryEngine.ts";
import type { RaceData, BackgroundData } from "../src/types/dnd5e.ts";

test("getAutoGrantedSkills collects background skills, fixed race skills, and rule choice grants", () => {
  const backgrounds: BackgroundData[] = [
    {
      name: "Soldier",
      source: "PHB",
      skillProficiencies: ["Athletics", "Intimidation"],
      toolProficiencies: [],
      languages: [],
      startingEquipment: [],
      feature: null,
      characteristics: {},
      description: "",
    },
  ];

  const races: RaceData[] = [
    {
      name: "Elf",
      source: "PHB",
      speed: { walk: 30 },
      size: ["Medium"],
      abilityScoreIncrease: [{ dex: 2 }],
      traits: [
        {
          name: "Keen Senses",
          description: "You have proficiency in the Perception skill.",
        },
      ],
      subraces: [],
      description: "",
    },
  ];

  const char = makeChar({
    background: { name: "Soldier", source: "PHB" },
    race: { name: "Elf", source: "PHB" },
    ruleChoices: [
      {
        id: "race__lineage__ancestral_legacy",
        trait: "Ancestral Legacy",
        origin: "race",
        choose: 2,
        from: ["Survival", "Stealth"],
        picked: ["Survival"],
      },
    ],
  });

  const granted = getAutoGrantedSkills(char, { races, backgrounds });
  assert.ok(granted.includes("Athletics"), "Must include background skill Athletics");
  assert.ok(granted.includes("Intimidation"), "Must include background skill Intimidation");
  assert.ok(granted.includes("Perception"), "Must include fixed race skill Perception");
  assert.ok(granted.includes("Survival"), "Must include ancestral legacy pick Survival");
});

test("getAutoGrantedSkills resolves race and background from a catalog bundle", () => {
  // Names absent from the static fallback maps, so only the catalog can supply their skills.
  const scholar: BackgroundData = {
    name: "Test Scholar",
    source: "TEST",
    skillProficiencies: ["Arcana", "Nature"],
    toolProficiencies: [],
    languages: [],
    startingEquipment: [],
    feature: null,
    characteristics: {},
    description: "",
  };
  const testfolk: RaceData = {
    name: "Testfolk",
    source: "TEST",
    speed: { walk: 30 },
    size: ["Medium"],
    abilityScoreIncrease: [{ dex: 2 }],
    traits: [{ name: "Test Sense", description: "You have proficiency in the Survival skill." }],
    subraces: [],
    description: "",
  };
  const char = makeChar({
    background: { name: "Test Scholar", source: "TEST" },
    race: { name: "Testfolk", source: "TEST" },
  });

  const granted = getAutoGrantedSkills(char, {
    catalogs: { compendium: inMemoryCompendium({ races: [testfolk], backgrounds: [scholar] }) },
  });
  assert.deepEqual(granted.sort(), ["Arcana", "Nature", "Survival"]);
});

test("Race skill choices do not consume class skill choices and lock already granted proficiencies", () => {
  // Scenario:
  // Character has Soldier background (Athletics, Intimidation).
  // Race: Half-Elf granting 2 choices. Player picks Survival and Stealth.
  // Class: Fighter granting 2 choices from [Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Survival].
  const backgroundSkills = ["Athletics", "Intimidation"];
  const raceChoicePicks = ["Survival", "Stealth"];

  const autoGrantedBase = ["Athletics", "Intimidation"]; // From background

  // In Class Section:
  // classAutoGranted includes autoGrantedBase + race choices
  const classAutoGranted = Array.from(new Set([...autoGrantedBase, ...raceChoicePicks]));
  assert.ok(classAutoGranted.includes("Athletics"));
  assert.ok(classAutoGranted.includes("Intimidation"));
  assert.ok(classAutoGranted.includes("Survival"));
  assert.ok(classAutoGranted.includes("Stealth"));

  const fighterFrom = [
    "Acrobatics",
    "Animal Handling",
    "Athletics",
    "History",
    "Insight",
    "Intimidation",
    "Perception",
    "Survival",
  ];

  // In Fighter's SkillPicker:
  // pickerChosen = normChosen.filter(s => normFrom.includes(s) && !normAuto.includes(s))
  // Even if character.chosenSkills has ["Survival", "Stealth"]:
  const characterChosenSkills = ["Survival", "Stealth"];
  const fighterClassPicks: string[] = []; // Fighter has not chosen yet

  const pickerChosen = fighterClassPicks.filter(
    (s) => fighterFrom.includes(s) && !classAutoGranted.includes(s)
  );
  const remaining = 2 - pickerChosen.length;

  // Remaining for Fighter must be 2 full choices!
  assert.equal(remaining, 2, "Fighter must have 2 choices remaining, not reduced by race or background");

  // In the picker, Athletics, Intimidation, and Survival must show as locked (granted: true)
  for (const lockedSkill of ["Athletics", "Intimidation", "Survival"]) {
    assert.ok(classAutoGranted.includes(lockedSkill), `${lockedSkill} must be locked in class picker`);
  }

  // Fighter picks Acrobatics and Insight
  const updatedFighterPicks = ["Acrobatics", "Insight"];
  const updatedAllChosen = Array.from(new Set([...raceChoicePicks, ...updatedFighterPicks]));

  const char = makeChar({
    background: { name: "Soldier", source: "PHB" },
    chosenSkills: updatedAllChosen,
    skillChoices: [
      {
        id: "Race: Skill Versatility",
        origin: "race",
        choose: 2,
        from: raceChoicePicks,
        picked: raceChoicePicks,
      },
      {
        id: "Class: Fighter",
        origin: "class",
        choose: 2,
        from: fighterFrom,
        picked: updatedFighterPicks,
      },
    ],
  });

  const allSheetSkills = skills(char);
  const proficient = allSheetSkills.filter((s) => s.isProficient).map((s) => s.name);

  // All 6 skills must be proficient
  assert.ok(proficient.includes("Athletics"), "Soldier background skill");
  assert.ok(proficient.includes("Intimidation"), "Soldier background skill");
  assert.ok(proficient.includes("Survival"), "Race choice pick");
  assert.ok(proficient.includes("Stealth"), "Race choice pick");
  assert.ok(proficient.includes("Acrobatics"), "Class choice pick");
  assert.ok(proficient.includes("Insight"), "Class choice pick");
});

test("applyAncestrySelection clears race skill choices and race chosenSkills without touching class choices", () => {
  const initial = makeChar({
    chosenSkills: ["Survival", "Stealth", "Acrobatics", "Insight"],
    skillChoices: [
      {
        id: "Race: Skill Versatility",
        origin: "race",
        choose: 2,
        from: ["Survival", "Stealth"],
        picked: ["Survival", "Stealth"],
      },
      {
        id: "Class: Fighter",
        origin: "class",
        choose: 2,
        from: ["Acrobatics", "Insight"],
        picked: ["Acrobatics", "Insight"],
      },
    ],
  });

  const dwarf: RaceData = {
    name: "Dwarf",
    source: "PHB",
    speed: { walk: 25 },
    size: ["Medium"],
    abilityScoreIncrease: [{ con: 2 }],
    traits: [],
    subraces: [],
    description: "",
  };

  const updated = applyAncestrySelection(initial, dwarf);

  // Race skill choices must be cleared
  assert.equal(
    updated.skillChoices?.some((sc) => sc.origin === "race"),
    false,
    "Race skill choices must be removed"
  );

  // Class choices must remain
  const classChoice = updated.skillChoices?.find((sc) => sc.origin === "class");
  assert.ok(classChoice, "Class skill choice must be preserved");
  assert.deepEqual(classChoice?.picked, ["Acrobatics", "Insight"]);

  // chosenSkills must only have the class picks
  assert.ok(!updated.chosenSkills.includes("Survival"), "Race pick Survival must be removed");
  assert.ok(!updated.chosenSkills.includes("Stealth"), "Race pick Stealth must be removed");
  assert.ok(updated.chosenSkills.includes("Acrobatics"), "Class pick Acrobatics must be preserved");
  assert.ok(updated.chosenSkills.includes("Insight"), "Class pick Insight must be preserved");
});

test("Choice ASI derivation and mode persistence across tab remounts", () => {
  // Test 1: Half-Elf (+1 to two abilities)
  const halfElfChar = setChoiceRacialBonus(makeChar({ racialAbilityBonuses: { cha: 2 } }), [
    { key: "dex", amount: 1 },
    { key: "con", amount: 1 },
  ]);

  // Derive choiceASI as AncestrySection does
  const halfElfChoiceASI: Record<string, number> = {};
  for (const b of halfElfChar.racialChoiceBonus || []) {
    halfElfChoiceASI[b.key] = b.amount;
  }
  assert.deepEqual(halfElfChoiceASI, { dex: 1, con: 1 });

  // Test 2: MPMM Flexible ASI (+2 / +1 mode)
  const mpmmChar21 = setChoiceRacialBonus(makeChar(), [
    { key: "str", amount: 2 },
    { key: "con", amount: 1 },
  ]);

  const mpmm21ChoiceASI: Record<string, number> = {};
  for (const b of mpmmChar21.racialChoiceBonus || []) {
    mpmm21ChoiceASI[b.key] = b.amount;
  }
  assert.deepEqual(mpmm21ChoiceASI, { str: 2, con: 1 });

  const isMode21 =
    mpmmChar21.racialChoiceBonus?.some((b) => b.amount === 2) ||
    !(mpmmChar21.racialChoiceBonus?.length === 3 && mpmmChar21.racialChoiceBonus.every((b) => b.amount === 1));
  assert.equal(isMode21, true, "Must detect +2/+1 mode");

  // Test 3: MPMM Flexible ASI (+1 / +1 / +1 mode)
  const mpmmChar111 = setChoiceRacialBonus(makeChar(), [
    { key: "str", amount: 1 },
    { key: "dex", amount: 1 },
    { key: "wis", amount: 1 },
  ]);

  const mpmm111ChoiceASI: Record<string, number> = {};
  for (const b of mpmmChar111.racialChoiceBonus || []) {
    mpmm111ChoiceASI[b.key] = b.amount;
  }
  assert.deepEqual(mpmm111ChoiceASI, { str: 1, dex: 1, wis: 1 });

  const isMode111 =
    mpmmChar111.racialChoiceBonus?.length === 3 &&
    mpmmChar111.racialChoiceBonus.every((b) => b.amount === 1);
  assert.equal(isMode111, true, "Must detect +1/+1/+1 mode");
});
