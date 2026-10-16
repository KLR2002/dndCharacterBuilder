import { test } from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import { integratedTestCompendium, loadTestCatalog, makeChar } from "./testUtils.ts";
import { ancestryRuleChoices, offeredRuleChoices } from "../src/rules/ruleChoices.ts";
import { FIGHTING_INITIATE_CHOICE_ID, fightingStyleRuleChoices } from "../src/rules/choices/fightingStyles.ts";
import { MARTIAL_ADEPT_CHOICE_ID, battleMasterManeuverChoices } from "../src/rules/choices/maneuvers.ts";
import {
  ELDRITCH_ADEPT_CHOICE_ID,
  warlockAncientSecretsStartingRituals,
  warlockInvocationChoices,
  warlockMysticArcanumChoices,
  warlockPactBoonChoices,
  warlockTomeCantripChoices,
} from "../src/rules/choices/warlockChoices.ts";
import { ARTIFICER_INFUSIONS_KNOWN_ID, artificerInfusionChoices } from "../src/rules/choices/artificerInfusions.ts";
import { GIANT_POWER_CHOICE_ID } from "../src/rules/choices/types.ts";
import { HIGH_ELF_CANTRIP_CHOICE_ID } from "../src/rules/ancestryEngine.ts";

/**
 * Rule Choice ids are persisted in saved characters. Renaming one orphans every pick made under it,
 * so the ids below are the frozen contract. A change here must be deliberate and come with a migration.
 */

const SHIPPED_RULE_CHOICE_IDS = [
  "BGG__Barbarian__Path of the Giant__Giant Power",
  "DMG__Cleric__Death Domain__Reaper",
  "GGR__Simic Hybrid____Animal Enhancement",
  "MPMM__Aasimar____Celestial Revelation",
  "MPMM__Eladrin____Fey Step",
  "MPMM__Kobold____Kobold Legacy",
  "MPMM__Shifter____Shifting",
  "MTF__Elf__Eladrin__Fey Step",
  "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6",
  "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3",
  "PHB__Barbarian__Path of the Totem Warrior__Totemic Attunement 14",
  "PHB__Cleric__Nature Domain__Acolyte of Nature",
  "PHB__Druid__Circle of the Land__Biome",
  "PHB__Feat__Martial Adept__Maneuvers",
  "PHB__Fighter__Additional Fighting Style 10",
  "PHB__Fighter__Battle Master__Maneuvers 10",
  "PHB__Fighter__Battle Master__Maneuvers 15",
  "PHB__Fighter__Battle Master__Maneuvers 3",
  "PHB__Fighter__Battle Master__Maneuvers 7",
  "PHB__Fighter__Fighting Style",
  "PHB__Monk__Way of the Four Elements__Discipline 11",
  "PHB__Monk__Way of the Four Elements__Discipline 17",
  "PHB__Monk__Way of the Four Elements__Discipline 3",
  "PHB__Monk__Way of the Four Elements__Discipline 6",
  "PHB__Paladin__Fighting Style",
  "PHB__Ranger__Fighting Style",
  "PHB__Warlock__Invocations 12",
  "PHB__Warlock__Invocations 15",
  "PHB__Warlock__Invocations 2",
  "PHB__Warlock__Invocations 5",
  "PHB__Warlock__Invocations 7",
  "PHB__Warlock__Invocations 9",
  "PHB__Warlock__Pact Boon",
  "SCAG__Cleric__Arcana Domain__Arcane Initiate",
  "SCAG__Half-Elf__Aquatic Elf Descent__Variant Feature (Choose 1)",
  "SCAG__Half-Elf__Drow Descent__Variant Feature (Choose 1)",
  "SCAG__Half-Elf__Moon Elf or Sun Elf Descent__Variant Feature (Choose 1)",
  "SCAG__Half-Elf__Wood Elf Descent__Variant Feature (Choose 1)",
  "TCE__Artificer__Infusions 10",
  "TCE__Artificer__Infusions 14",
  "TCE__Artificer__Infusions 18",
  "TCE__Artificer__Infusions 2",
  "TCE__Artificer__Infusions 6",
  "TCE__Artificer__Infusions Known",
  "TCE__Barbarian__Primal Knowledge 10",
  "TCE__Barbarian__Primal Knowledge 3",
  "TCE__Feat__Eldritch Adept__Invocation",
  "TCE__Feat__Fighting Initiate__Style",
  "TCE__Fighter__Superior Technique__Maneuver",
  "TCE__Paladin__Blessed Warrior Cantrips",
  "TCE__Ranger__Druidic Warrior Cantrips",
  "TCE__Warlock__The Genie__Kind",
  "VRGR__Dhampir____Ancestral Legacy",
  "VRGR__Hexblood____Ancestral Legacy",
  "VRGR__Reborn____Ancestral Legacy",
  "Warlock__Book of Ancient Secrets__Starting Rituals",
  "Warlock__Mystic Arcanum 11",
  "Warlock__Mystic Arcanum 13",
  "Warlock__Mystic Arcanum 15",
  "Warlock__Mystic Arcanum 17",
  "Warlock__Pact of the Tome__Cantrips",
  "XGE__Bard__College of Swords__Fighting Style",
  "XGE__Sorcerer__Divine Soul__Affinity",
];

const ALL_BOOKS = ["PHB", "XGE", "TCE", "SCAG", "MPMM", "BGG", "DMG", "EGW", "VRGR", "GGR", "MTF"];
const races = loadTestCatalog("races");

const pick = (id: string, trait: string, picked: string[]) => ({
  id,
  trait,
  origin: "class" as const,
  choose: 1,
  from: picked,
  picked,
});

const feat = (featName: string) => ({ level: 1, type: "feat" as const, featName, featSource: "PHB" });

/** Representative characters at high level, so every gated choice is offered at least once. */
function scenarioCharacters(): Character[] {
  const single = (className: string, level: number, subclassName?: string) =>
    makeChar({ classes: [{ className, source: "PHB", level, ...(subclassName ? { subclassName } : {}) }] });
  return [
    single("Fighter", 17, "Champion"),
    makeChar({
      classes: [{ className: "Fighter", source: "PHB", level: 17, subclassName: "Battle Master" }],
      ruleChoices: [pick("PHB__Fighter__Fighting Style", "Fighting Style", ["Superior Technique"])],
    }),
    makeChar({
      classes: [{ className: "Paladin", source: "PHB", level: 17 }],
      ruleChoices: [pick("PHB__Paladin__Fighting Style", "Fighting Style", ["Blessed Warrior"])],
    }),
    makeChar({
      classes: [{ className: "Ranger", source: "PHB", level: 17 }],
      ruleChoices: [pick("PHB__Ranger__Fighting Style", "Fighting Style", ["Druidic Warrior"])],
    }),
    single("Bard", 17, "College of Swords"),
    makeChar({
      classes: [{ className: "Warlock", source: "PHB", level: 17, subclassName: "The Genie" }],
      ruleChoices: [
        pick("PHB__Warlock__Pact Boon", "Pact Boon", ["Pact of the Tome"]),
        pick("PHB__Warlock__Invocations 2", "Eldritch Invocations", ["Book of Ancient Secrets"]),
      ],
    }),
    single("Artificer", 18),
    single("Druid", 17, "Circle of the Land"),
    single("Sorcerer", 17, "Divine Soul"),
    single("Cleric", 17, "Nature Domain"),
    single("Cleric", 17, "Death Domain"),
    single("Cleric", 17, "Arcana Domain"),
    single("Monk", 17, "Way of the Four Elements"),
    single("Barbarian", 17, "Path of the Giant"),
    single("Barbarian", 17, "Path of the Totem Warrior"),
    makeChar({
      classes: [{ className: "Barbarian", source: "PHB", level: 17, subclassName: "Path of the Berserker" }],
      optionalFeatureReplacements: { "Primal Knowledge": true },
    }),
    makeChar({
      classes: [{ className: "Fighter", source: "PHB", level: 3 }],
      originFeats: [feat("Fighting Initiate"), feat("Martial Adept")],
    }),
    makeChar({
      classes: [{ className: "Warlock", source: "PHB", level: 3 }],
      asiSelections: [feat("Eldritch Adept")],
    }),
  ];
}

/** Ancestry characters for every race and subrace in the catalog, plus the lineages. */
function ancestryCharacters(): Character[] {
  const out: Character[] = [];
  for (const race of races) {
    out.push(makeChar({ race: { name: race.name, source: race.source } }));
    for (const sub of race.subraces ?? []) {
      out.push(
        makeChar({
          race: { name: race.name, source: race.source, subraceName: sub.name, subraceSource: sub.source },
        })
      );
    }
  }
  for (const lineage of ["Dhampir", "Hexblood", "Reborn"]) {
    out.push(makeChar({ race: { name: lineage, source: "VGM" }, lineageReplacement: lineage }));
  }
  return out;
}

/** Every Rule Choice id the modules issue for the scenario characters, across every issuing module. */
function issuedRuleChoiceIds(): Set<string> {
  const compendium = integratedTestCompendium();
  const issued = new Set<string>();
  const add = (choices: { id: string }[]) => choices.forEach((choice) => issued.add(choice.id));

  for (const character of scenarioCharacters()) {
    add(offeredRuleChoices(character, { raceCatalog: races, level: 20, activeBooks: ALL_BOOKS, compendium }));
    add(fightingStyleRuleChoices(character, ALL_BOOKS, compendium));
    add(battleMasterManeuverChoices(character, ALL_BOOKS, compendium));
    add(warlockPactBoonChoices(character, ALL_BOOKS, compendium));
    add(warlockTomeCantripChoices(character, ALL_BOOKS, compendium));
    add(warlockAncientSecretsStartingRituals(character, ALL_BOOKS, compendium));
    add(warlockMysticArcanumChoices(character, ALL_BOOKS, compendium));
    add(warlockInvocationChoices(character, ALL_BOOKS, compendium));
    add(artificerInfusionChoices(character, ALL_BOOKS));
    add(artificerInfusionChoices(character, ALL_BOOKS, true));
  }
  for (const character of ancestryCharacters()) {
    add(ancestryRuleChoices(character, races));
  }
  return issued;
}

test("every shipped Rule Choice id is frozen, and every frozen id is still issued by its module", () => {
  assert.deepEqual([...issuedRuleChoiceIds()].sort(), [...SHIPPED_RULE_CHOICE_IDS].sort());
});

test("the feat, Warlock, Artificer, Giant Power and High Elf ids keep their persisted values", () => {
  assert.equal(FIGHTING_INITIATE_CHOICE_ID, "TCE__Feat__Fighting Initiate__Style");
  assert.equal(MARTIAL_ADEPT_CHOICE_ID, "PHB__Feat__Martial Adept__Maneuvers");
  assert.equal(ELDRITCH_ADEPT_CHOICE_ID, "TCE__Feat__Eldritch Adept__Invocation");
  assert.equal(ARTIFICER_INFUSIONS_KNOWN_ID, "TCE__Artificer__Infusions Known");
  assert.equal(GIANT_POWER_CHOICE_ID, "BGG__Barbarian__Path of the Giant__Giant Power");
  assert.equal(HIGH_ELF_CANTRIP_CHOICE_ID, "PHB__Elf__PHB__High Elf__Cantrip");
});

test("the frozen list is free of duplicates and every entry is a non-empty id", () => {
  assert.equal(new Set(SHIPPED_RULE_CHOICE_IDS).size, SHIPPED_RULE_CHOICE_IDS.length);
  assert.ok(SHIPPED_RULE_CHOICE_IDS.every((id) => id.length > 0));
});
