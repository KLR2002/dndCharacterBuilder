import test from "node:test";
import assert from "node:assert/strict";
import { makeChar, loadTestCatalogs, inMemoryCompendium } from "./testUtils.ts";
import { characterSpeeds } from "../src/rules/speed.ts";
import { skills } from "../src/rules/skills.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { availableRuleChoices } from "../src/rules/ruleChoices.ts";
import { grantedFeatures } from "../src/rules/grantedFeatures.ts";

const catalogs = loadTestCatalogs();
const seaElfRace = catalogs.races.find(r => r.name === "Sea Elf" && r.source === "MPMM")!;
const humanRace = catalogs.races.find(r => r.name === "Human" && r.source === "PHB")!;
const elfRace = catalogs.races.find(r => r.name === "Elf" && r.source === "PHB")!;
const dhampirRace = catalogs.races.find(r => r.name === "Dhampir" && r.source === "VRGR")!;
const rebornRace = catalogs.races.find(r => r.name === "Reborn" && r.source === "VRGR")!;

test("Ancestral Legacy: adopts Lineage over Sea Elf, retaining swim speed and Perception proficiency", () => {
  // Character with prior race Sea Elf (walk 30, swim 30, Perception skill), adopting Dhampir lineage
  const char = makeChar({
    race: { name: "Sea Elf", source: "MPMM" },
    lineageReplacement: "Dhampir",
  });

  // Evaluated speeds should have Dhampir's walk 35, climb 35 (Spider climb), and retain Sea Elf's swim 30
  const evaluated = evaluateCharacter(char, { compendium: inMemoryCompendium(catalogs) });
  assert.equal(evaluated.speeds.walk, 35);
  assert.equal(evaluated.speeds.climb, 35);
  assert.equal(evaluated.speeds.swim, 30);

  // Skill proficiencies should retain Sea Elf's Perception
  const evaluatedSkills = evaluated.skills;
  const perception = evaluatedSkills.find(s => s.name === "Perception");
  assert.equal(perception?.isProficient, true);

  // Should NOT offer 2-skill fallback since speeds and skills were inherited
  const choices = availableRuleChoices(char, catalogs.races, 1, ["VRGR", "MPMM", "PHB"]);
  assert.equal(choices.some(c => c.traitName.includes("Ancestral Legacy")), false);
});

test("Ancestral Legacy: adopts Lineage over Human (no speeds/skills), grants 2-skill choice", () => {
  // Character replacing standard Human (has neither special speed nor skills)
  const char = makeChar({
    race: { name: "Human", source: "PHB" },
    lineageReplacement: "Dhampir",
  });

  // Offers 2-skill choice
  const choices = availableRuleChoices(char, catalogs.races, 1, ["VRGR", "PHB"]);
  const ancestralChoice = choices.find(c => c.traitName.includes("Ancestral Legacy"));
  assert.ok(ancestralChoice);
  assert.equal(ancestralChoice.choose, 2);
  assert.equal(ancestralChoice.options.length, 18);

  // When 2 skills are picked, character gains proficiency in them
  const withPicks = {
    ...char,
    ruleChoices: [
      {
        id: ancestralChoice.id,
        trait: ancestralChoice.traitName,
        origin: "race" as const,
        choose: 2,
        from: ["Athletics", "Stealth"],
        picked: ["Athletics", "Stealth"],
      },
    ],
  };

  const evalResult = evaluateCharacter(withPicks, { compendium: inMemoryCompendium(catalogs) });
  const athletics = evalResult.skills.find(s => s.name === "Athletics");
  const stealth = evalResult.skills.find(s => s.name === "Stealth");
  assert.equal(athletics?.isProficient, true);
  assert.equal(stealth?.isProficient, true);
});

test("Ancestral Legacy: 1st-level Reborn without prior race offers 2-skill choice", () => {
  // Direct Reborn at 1st level
  const char = makeChar({
    race: { name: "Reborn", source: "VRGR" },
    lineageReplacement: null,
  });

  const choices = availableRuleChoices(char, catalogs.races, 1, ["VRGR"]);
  const ancestralChoice = choices.find(c => c.traitName.includes("Ancestral Legacy"));
  assert.ok(ancestralChoice);
  assert.equal(ancestralChoice.choose, 2);
});

test("Ancestral Legacy: suppresses prior race features while granting lineage features", () => {
  const char = makeChar({
    race: { name: "Elf", source: "PHB" },
    lineageReplacement: "Dhampir",
  });

  const features = grantedFeatures(char, catalogs);
  // Lineage features present
  assert.ok(features.some(f => f.name === "Spider Climb"));
  assert.ok(features.some(f => f.name === "Vampiric Bite"));

  // Replaced base race features (e.g. Fey Ancestry, Trance) are suppressed
  assert.equal(features.some(f => f.name === "Fey Ancestry"), false);
  assert.equal(features.some(f => f.name === "Trance"), false);
});
