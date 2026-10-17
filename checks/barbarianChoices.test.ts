import test from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import {
  subclassRuleChoices,
  availableSubclassRuleChoices,
  pickRuleChoice,
} from "../src/rules/ruleChoices.ts";
import { createCompendium } from "../src/services/compendium.ts";
import { choiceCatalogBundle, choiceCatalogClasses } from "./choiceCatalogFixture.ts";
import { skills } from "../src/rules/skills.ts";
import {
  getClassSpellProfiles,
  isCastingClass,
  isGiantBarbarian,
  isSpellAvailableForClass,
} from "../src/rules/spellcasting.ts";
import { findSpell } from "../src/services/dataService.ts";

test("Primal Knowledge (TCoE): level gating and optional feature activation", () => {
  // Barbarian level 2 with optional feature enabled -> 0 choices offered (level < 3)
  const barbLvl2 = makeChar({
    classes: [{ className: "Barbarian", level: 2 }],
    optionalFeatureReplacements: { "Primal Knowledge": true },
  });
  const choicesLvl2 = subclassRuleChoices(barbLvl2);
  assert.equal(
    choicesLvl2.some((c) => c.traitName.includes("Primal Knowledge")),
    false,
    "Level 2 barbarian must not be offered Primal Knowledge"
  );

  // Barbarian level 3 without optional feature enabled -> 0 choices offered
  const barbLvl3NoOpt = makeChar({
    classes: [{ className: "Barbarian", level: 3 }],
  });
  const choicesNoOpt = subclassRuleChoices(barbLvl3NoOpt);
  assert.equal(
    choicesNoOpt.some((c) => c.traitName.includes("Primal Knowledge")),
    false,
    "Barbarian without Primal Knowledge enabled must not receive choices"
  );

  // Barbarian level 3 with optional feature enabled -> exactly Level 3 choice offered
  const barbLvl3 = makeChar({
    classes: [{ className: "Barbarian", level: 3 }],
    optionalFeatureReplacements: { "Primal Knowledge": true },
  });
  const choicesLvl3 = subclassRuleChoices(barbLvl3);
  const pkLvl3 = choicesLvl3.find((c) => c.id === "TCE__Barbarian__Primal Knowledge 3");
  assert.ok(pkLvl3, "Level 3 barbarian must receive 3rd-level Primal Knowledge choice");
  assert.equal(pkLvl3.choose, 1);
  assert.equal(pkLvl3.level, 3);
  assert.equal(
    choicesLvl3.some((c) => c.id === "TCE__Barbarian__Primal Knowledge 10"),
    false,
    "10th-level Primal Knowledge choice must not be offered at level 3"
  );

  // Barbarian level 10 with optional feature enabled -> both Level 3 and Level 10 choices offered
  const barbLvl10 = makeChar({
    classes: [{ className: "Barbarian", level: 10 }],
    optionalFeatureReplacements: { "Primal Knowledge": true },
  });
  const choicesLvl10 = subclassRuleChoices(barbLvl10);
  assert.ok(
    choicesLvl10.some((c) => c.id === "TCE__Barbarian__Primal Knowledge 3"),
    "Level 10 barbarian must have 3rd-level Primal Knowledge choice"
  );
  assert.ok(
    choicesLvl10.some((c) => c.id === "TCE__Barbarian__Primal Knowledge 10"),
    "Level 10 barbarian must have 10th-level Primal Knowledge choice"
  );
});

test("Primal Knowledge: excludes already proficient Barbarian skills and grants proficiency on pick", () => {
  // Barbarian level 3 with Athletics and Perception already chosen at level 1
  const char = makeChar({
    classes: [{ className: "Barbarian", level: 3 }],
    chosenSkills: ["Athletics", "Perception"],
    optionalFeatureReplacements: { "Primal Knowledge": true },
  });

  const choices = subclassRuleChoices(char);
  const pk3 = choices.find((c) => c.id === "TCE__Barbarian__Primal Knowledge 3")!;
  const offeredNames = pk3.options.map((o) => o.name);

  // Athletics and Perception should be excluded
  assert.equal(offeredNames.includes("Athletics"), false);
  assert.equal(offeredNames.includes("Perception"), false);
  assert.deepEqual(offeredNames.sort(), ["Animal Handling", "Intimidation", "Nature", "Survival"].sort());

  // Pick "Survival" using pickRuleChoice
  const updatedChar = pickRuleChoice(char, pk3, "Survival");
  assert.ok(
    updatedChar.ruleChoices?.some(
      (rc) => rc.id === "TCE__Barbarian__Primal Knowledge 3" && rc.picked.includes("Survival")
    )
  );

  // Survival should now evaluate as proficient
  const evalSkills = skills(updatedChar);
  const survivalSkill = evalSkills.find((s) => s.name === "Survival");
  assert.equal(survivalSkill?.isProficient, true, "Survival should be proficient after picking Primal Knowledge");

  // At level 10, Level 10 choice must exclude Athletics, Perception, and Survival
  const updatedLvl10Char = {
    ...updatedChar,
    classes: [{ className: "Barbarian", level: 10 }],
  };
  const choicesLvl10 = subclassRuleChoices(updatedLvl10Char);
  const pk10 = choicesLvl10.find((c) => c.id === "TCE__Barbarian__Primal Knowledge 10")!;
  const offeredNames10 = pk10.options.map((o) => o.name);
  assert.equal(offeredNames10.includes("Survival"), false, "Survival picked at level 3 must not be offered at level 10");
  assert.deepEqual(offeredNames10.sort(), ["Animal Handling", "Intimidation", "Nature"].sort());
});

test("Primal Knowledge: the pool is the Barbarian's skill list from the catalog, so no Barbarian class means no offer", () => {
  const withoutBarbarian = createCompendium(
    choiceCatalogBundle({ classes: choiceCatalogClasses().filter((c) => c.name !== "Barbarian") }),
  );
  const char = makeChar({
    classes: [{ className: "Barbarian", level: 3 }],
    optionalFeatureReplacements: { "Primal Knowledge": true },
  });
  assert.equal(
    subclassRuleChoices(char, undefined, withoutBarbarian).some((c) => c.traitName.includes("Primal Knowledge")),
    false,
    "a catalog with no Barbarian class offers no Primal Knowledge choice",
  );
});

test("Path of the Giant: level gating, cantrip choice, and Wisdom spellcasting profile", () => {
  // Level 2 Path of the Giant Barbarian -> 0 choices (level < 3)
  const giantLvl2 = makeChar({
    classes: [{ className: "Barbarian", level: 2, subclassName: "Path of the Giant", source: "BGG" }],
  });
  assert.equal(isGiantBarbarian(giantLvl2.classes[0]), false);
  assert.equal(isCastingClass(giantLvl2.classes[0]), false);
  assert.equal(subclassRuleChoices(giantLvl2).length, 0);

  // Level 3 Path of the Giant Barbarian -> offers Giant Power Cantrip
  const giantLvl3 = makeChar({
    classes: [{ className: "Barbarian", level: 3, subclassName: "Path of the Giant", source: "BGG" }],
    baseAbilityScores: { str: 16, dex: 14, con: 16, int: 10, wis: 14, cha: 8 }, // Wis mod = +2
  });
  assert.equal(isGiantBarbarian(giantLvl3.classes[0]), true);
  assert.equal(isCastingClass(giantLvl3.classes[0]), true);

  const choices = subclassRuleChoices(giantLvl3);
  const giantChoice = choices.find((c) => c.id === "BGG__Barbarian__Path of the Giant__Giant Power")!;
  assert.ok(giantChoice, "Giant Power choice must be offered at level 3");
  assert.equal(giantChoice.choose, 1);
  assert.deepEqual(
    giantChoice.options.map((o) => o.name).sort(),
    ["Druidcraft", "Thaumaturgy"].sort()
  );

  // Pick "Druidcraft"
  const charWithCantrip = pickRuleChoice(giantLvl3, giantChoice, "Druidcraft");
  const known = charWithCantrip.knownSpells?.find((k) => k.name === "Druidcraft");
  assert.ok(known, "Druidcraft must be added to character knownSpells");
  assert.equal(known.ownerKey, "Barbarian__BGG");
  assert.equal(known.ability, "wis");

  // Inspect getClassSpellProfiles
  const profiles = getClassSpellProfiles(charWithCantrip);
  assert.equal(profiles.length, 1);
  const prof = profiles[0];
  assert.equal(prof.className, "Barbarian");
  assert.equal(prof.ability, "wis");
  assert.equal(prof.maxSpellLevel, 0);
  assert.equal(prof.spellSaveDc, 8 + 2 + 2); // 8 + PB(2) + Wis(2) = 12
  assert.equal(prof.spellAttackBonus, 2 + 2); // PB(2) + Wis(2) = 4
  assert.ok(prof.knownSpells.some((k) => k.name === "Druidcraft"));
  assert.ok(prof.subclassKnownSpells?.some((k) => k.name === "Druidcraft"));

  // Check spell availability helper
  const druidcraftSpell = findSpell("Druidcraft")!;
  assert.equal(
    isSpellAvailableForClass(druidcraftSpell, "Barbarian", ["PHB", "BGG"], { subclassName: "Path of the Giant" }),
    true
  );
  assert.equal(
    isSpellAvailableForClass(druidcraftSpell, "Barbarian", ["PHB"], { subclassName: "Berserker" }),
    false
  );
});

test("Path of the Totem Warrior: 3 distinct milestones with choose: 1", () => {
  // Level 2 Totem Warrior Barbarian -> 0 choices
  const totemLvl2 = makeChar({
    classes: [{ className: "Barbarian", level: 2, subclassName: "Path of the Totem Warrior" }],
  });
  assert.equal(subclassRuleChoices(totemLvl2).length, 0);

  // Level 3 Totem Warrior Barbarian with PHB only -> Elk and Tiger excluded from Totem Spirit
  const totemLvl3Phb = makeChar({
    classes: [{ className: "Barbarian", level: 3, subclassName: "Path of the Totem Warrior" }],
  });
  const phbChoices = subclassRuleChoices(totemLvl3Phb, ["PHB"]);
  assert.equal(phbChoices.length, 1);
  const spirit3Phb = phbChoices[0];
  assert.equal(spirit3Phb.id, "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3");
  assert.equal(spirit3Phb.choose, 1);
  assert.deepEqual(
    spirit3Phb.options.map((o) => o.name).sort(),
    ["Bear", "Eagle", "Wolf"].sort()
  );

  // Level 3 Totem Warrior Barbarian with SCAG -> Elk and Tiger included
  const scagChoices = subclassRuleChoices(totemLvl3Phb, ["PHB", "SCAG"]);
  assert.equal(scagChoices.length, 1);
  const spirit3Scag = scagChoices[0];
  assert.deepEqual(
    spirit3Scag.options.map((o) => o.name).sort(),
    ["Bear", "Eagle", "Elk", "Tiger", "Wolf"].sort()
  );

  // Level 6 Totem Warrior -> offers Totem Spirit 3 AND Aspect of the Beast 6, but NOT Totemic Attunement 14
  const totemLvl6 = makeChar({
    classes: [{ className: "Barbarian", level: 6, subclassName: "Path of the Totem Warrior" }],
  });
  const lvl6Choices = subclassRuleChoices(totemLvl6);
  assert.equal(lvl6Choices.length, 2);
  assert.ok(lvl6Choices.some((c) => c.id === "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3"));
  assert.ok(lvl6Choices.some((c) => c.id === "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6"));
  assert.equal(
    lvl6Choices.some((c) => c.id === "PHB__Barbarian__Path of the Totem Warrior__Totemic Attunement 14"),
    false,
    "14th-level Totemic Attunement must not be offered at level 6"
  );

  // Level 14 Totem Warrior -> offers all 3 milestones
  const totemLvl14 = makeChar({
    classes: [{ className: "Barbarian", level: 14, subclassName: "Path of the Totem Warrior" }],
  });
  const lvl14Choices = subclassRuleChoices(totemLvl14);
  assert.equal(lvl14Choices.length, 3);
  assert.ok(lvl14Choices.some((c) => c.id === "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3"));
  assert.ok(lvl14Choices.some((c) => c.id === "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6"));
  assert.ok(lvl14Choices.some((c) => c.id === "PHB__Barbarian__Path of the Totem Warrior__Totemic Attunement 14"));
});

test("Path of the Totem Warrior: independent animal picks across milestones", () => {
  const totemChar = makeChar({
    classes: [{ className: "Barbarian", level: 14, subclassName: "Path of the Totem Warrior" }],
  });
  const choices = subclassRuleChoices(totemChar);
  const ch3 = choices.find((c) => c.id === "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3")!;
  const ch6 = choices.find((c) => c.id === "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6")!;
  const ch14 = choices.find((c) => c.id === "PHB__Barbarian__Path of the Totem Warrior__Totemic Attunement 14")!;

  // Pick Bear at 3, Eagle at 6, Wolf at 14
  let updated = pickRuleChoice(totemChar, ch3, "Bear");
  updated = pickRuleChoice(updated, ch6, "Eagle");
  updated = pickRuleChoice(updated, ch14, "Wolf");

  assert.equal(updated.ruleChoices?.length, 3);
  const pick3 = updated.ruleChoices?.find((rc) => rc.id === ch3.id)?.picked;
  const pick6 = updated.ruleChoices?.find((rc) => rc.id === ch6.id)?.picked;
  const pick14 = updated.ruleChoices?.find((rc) => rc.id === ch14.id)?.picked;

  assert.deepEqual(pick3, ["Bear"]);
  assert.deepEqual(pick6, ["Eagle"]);
  assert.deepEqual(pick14, ["Wolf"]);
});
