import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { makeChar, inMemoryCompendium } from "./testUtils.ts";
import { choiceCatalogClasses } from "./choiceCatalogFixture.ts";
import type { OptionFeatureData, SpellData, ClassData, RaceData } from "../src/types/dnd5e.ts";
import { characterSpeeds } from "../src/rules/speed.ts";
import { getTacticalActionLedger } from "../src/rules/tacticalActions.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { getBaselineSubclassSpellNames } from "../src/rules/subclassSpells.ts";
import {
  battleMasterManeuverChoices,
  fightingStyleRuleChoices,
  pickFightingStyleChoice,
  subclassRuleChoices,
  warlockTomeCantripChoices,
} from "../src/rules/ruleChoices.ts";

// Each rules function takes a Compendium. These tests hand it an in-memory catalog that
// contains only the records under test, so any read of the process-wide default would
// surface as a missing or extra option.

function spell(name: string, level: number, classes: string[], source = "PHB"): SpellData {
  return {
    name, source, level, school: "Evocation", castingTime: "1 action", range: "60 ft",
    components: "V, S", duration: "Instantaneous", description: "", classes,
  } as unknown as SpellData;
}

function maneuver(name: string): OptionFeatureData {
  return {
    name, source: "PHB", category: "Maneuver", featureType: [], prerequisite: null,
    description: `${name} description`,
  };
}

test("battleMasterManeuverChoices reads maneuver options from the given Compendium only", () => {
  const bm3 = makeChar({
    classes: [{ className: "Fighter", level: 3, subclassName: "Battle Master", hitDiceType: "d10" }],
  });
  const choices = battleMasterManeuverChoices(bm3, undefined, inMemoryCompendium({
    optionsAndFeatures: [maneuver("Trip Attack")],
  }));
  assert.equal(choices.length, 1);
  assert.deepEqual(choices[0].options.map((o) => o.name), ["Trip Attack"]);
});

test("warlockTomeCantripChoices offers only cantrips from the given Compendium", () => {
  const warlock3 = makeChar({
    classes: [{ className: "Warlock", level: 3, hitDiceType: "d8" }],
    ruleChoices: [{
      id: "PHB__Warlock__Pact Boon", trait: "Pact Boon", origin: "class",
      choose: 1, from: [], picked: ["Pact of the Tome"],
    }],
  });
  const choices = warlockTomeCantripChoices(warlock3, undefined, inMemoryCompendium({
    spells: [spell("Eldritch Blast", 0, ["Warlock"]), spell("Fireball", 3, ["Wizard"])],
  }));
  assert.deepEqual(choices[0].options.map((o) => o.name), ["Eldritch Blast"]);
});

test("reconcile takes a granted Tome cantrip's source from the given Compendium", () => {
  const warlock3 = makeChar({
    classes: [{ className: "Warlock", level: 3, hitDiceType: "d8" }],
    ruleChoices: [
      { id: "PHB__Warlock__Pact Boon", trait: "Pact Boon", origin: "class", choose: 1, from: [], picked: ["Pact of the Tome"] },
      { id: "Warlock__Pact of the Tome__Cantrips", trait: "Pact of the Tome Cantrips", origin: "class", choose: 3, from: [], picked: ["Eldritch Blast"] },
    ],
  });
  const synced = reconcile(warlock3, inMemoryCompendium({
    spells: [spell("Eldritch Blast", 0, ["Warlock"], "XGE")],
  }), { activeBooks: ALL_BOOKS });
  const tome = synced.knownSpells?.find((k) => k.name === "Eldritch Blast");
  assert.equal(tome?.source, "XGE");
});

test("fightingStyleRuleChoices builds the Blessed Warrior cantrips from the given Compendium", () => {
  const paladin = makeChar({
    classes: [{ className: "Paladin", level: 2, hitDiceType: "d10" }],
    ruleChoices: [{
      id: "PHB__Paladin__Fighting Style", trait: "Fighting Style", origin: "class",
      choose: 1, from: [], picked: ["Blessed Warrior"],
    }],
  });
  const choices = fightingStyleRuleChoices(paladin, undefined, inMemoryCompendium({
    spells: [spell("Sacred Flame", 0, ["Cleric"]), spell("Fire Bolt", 0, ["Wizard"])],
  }));
  const cantrips = choices.find((c) => c.id === "TCE__Paladin__Blessed Warrior Cantrips");
  assert.deepEqual(cantrips?.options.map((o) => o.name), ["Sacred Flame"]);
});

test("pickFightingStyleChoice records the cantrip's source from the given Compendium", () => {
  const paladin = makeChar({
    classes: [{ className: "Paladin", level: 2, hitDiceType: "d10" }],
    ruleChoices: [{
      id: "PHB__Paladin__Fighting Style", trait: "Fighting Style", origin: "class",
      choose: 1, from: [], picked: ["Blessed Warrior"],
    }],
  });
  const compendium = inMemoryCompendium({ spells: [spell("Sacred Flame", 0, ["Cleric"], "XGE")] });
  const choice = fightingStyleRuleChoices(paladin, undefined, compendium)
    .find((c) => c.id === "TCE__Paladin__Blessed Warrior Cantrips");
  assert.ok(choice);
  const picked = pickFightingStyleChoice(paladin, choice, "Sacred Flame", compendium);
  assert.equal(picked.knownSpells?.find((k) => k.name === "Sacred Flame")?.source, "XGE");
});

test("Cleric Nature Domain cantrip offers Druid cantrips from the given Compendium", () => {
  const nature = makeChar({
    classes: [{ className: "Cleric", level: 1, subclassName: "Nature", hitDiceType: "d8" }],
  });
  // The Nature Domain's filter comes from the catalog's class, so the compendium holds the fixture Cleric.
  const choices = subclassRuleChoices(nature, undefined, inMemoryCompendium({
    classes: choiceCatalogClasses().filter((c) => c.name === "Cleric"),
    spells: [spell("Produce Flame", 0, ["Druid"]), spell("Sacred Flame", 0, ["Cleric"])],
  }));
  const acolyte = choices.find((c) => c.id === "PHB__Cleric__Nature Domain__Acolyte of Nature");
  assert.deepEqual(acolyte?.options.map((o) => o.name), ["Produce Flame"]);
});

test("characterSpeeds resolves the race from the given Compendium", () => {
  const elf = makeChar({ race: { name: "Elf", source: "PHB" } });
  const race = { name: "Elf", source: "PHB", speed: { walk: 35 }, traits: [], abilityScoreIncrease: [] } as unknown as RaceData;
  const speeds = characterSpeeds(elf, { compendium: inMemoryCompendium({ races: [race] }), activeBooks: ALL_BOOKS });
  assert.equal(speeds.walk, 35);
});

test("getBaselineSubclassSpellNames reads subclass spells from the given Compendium", () => {
  const life = {
    name: "Life", shortName: "Life", source: "PHB", className: "Cleric", classSource: "PHB",
    features: [], description: "", additionalSpells: [{ prepared: { "1": ["Bless"] } }],
  } as unknown as ClassData;
  const cleric = { name: "Cleric", source: "PHB", subclasses: [life] } as unknown as ClassData;
  const names = getBaselineSubclassSpellNames("Cleric", "Life", inMemoryCompendium({ classes: [cleric] }));
  assert.deepEqual(names, ["Bless"]);
});

test("tactical maneuver descriptions come from the given Compendium", () => {
  const bm3 = makeChar({
    classes: [{ className: "Fighter", level: 3, subclassName: "Battle Master", hitDiceType: "d10" }],
    ruleChoices: [{
      id: "PHB__Fighter__Battle Master__Maneuvers 3", trait: "Maneuvers", origin: "subclass",
      choose: 3, from: [], picked: ["Trip Attack"],
    }],
  });
  const evaluated = evaluateCharacter(bm3, { compendium: inMemoryCompendium({ optionsAndFeatures: [maneuver("Trip Attack")] }), activeBooks: ALL_BOOKS });
  const ledger = getTacticalActionLedger(bm3, evaluated, {
    compendium: inMemoryCompendium({ optionsAndFeatures: [maneuver("Trip Attack")] }), activeBooks: ALL_BOOKS,
  });
  assert.equal(ledger.maneuvers.find((m) => m.name === "Trip Attack")?.description, "Trip Attack description");
});
