import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import type { Character, CharacterClass } from "../src/types/character.ts";
import {
  availableSubclassRuleChoices,
  subclassRuleChoices,
  type AvailableRuleChoice,
} from "../src/rules/ruleChoices.ts";
import type { Compendium } from "../src/services/compendium.ts";
import { integratedTestCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";

/**
 * Regression net for the class and subclass Rule Choices. Every representative character,
 * level, active book set and Compendium mode is recorded against a baseline file, so any
 * change to the offered ids, levels, gating or option text fails here.
 *
 * To re-record deliberately: UPDATE_SUBCLASS_CHOICE_BASELINE=1 node --test checks/subclassChoiceCharacterization.test.ts
 */

const BASELINE_PATH = new URL("./fixtures/subclassChoiceBaseline.json", import.meta.url);
const LEVELS = [1, 2, 3, 6, 10, 11, 14, 17];
const BOOK_SETS: (string[] | undefined)[] = [
  undefined,
  [],
  ["PHB"],
  ["PHB", "SCAG", "XGE", "TCE", "BGG", "DMG"],
];

const cls = (className: string, level: number, subclassName?: string): CharacterClass => ({
  className,
  source: "PHB",
  level,
  ...(subclassName ? { subclassName } : {}),
});

const withClasses = (classes: CharacterClass[], overrides: Partial<Character> = {}): Character =>
  makeChar({ classes, ...overrides });

type Build = (level: number) => Character;

const SCENARIOS: { label: string; build: Build }[] = [
  { label: "druid circle of the land", build: (l) => withClasses([cls("Druid", l, "Circle of the Land")]) },
  { label: "druid circle of the moon", build: (l) => withClasses([cls("Druid", l, "Circle of the Moon")]) },
  { label: "sorcerer divine soul", build: (l) => withClasses([cls("Sorcerer", l, "Divine Soul")]) },
  { label: "sorcerer draconic", build: (l) => withClasses([cls("Sorcerer", l, "Draconic Bloodline")]) },
  { label: "warlock the genie", build: (l) => withClasses([cls("Warlock", l, "The Genie")]) },
  { label: "warlock the fiend", build: (l) => withClasses([cls("Warlock", l, "The Fiend")]) },
  { label: "cleric nature domain", build: (l) => withClasses([cls("Cleric", l, "Nature Domain")]) },
  { label: "cleric death domain", build: (l) => withClasses([cls("Cleric", l, "Death Domain")]) },
  { label: "cleric arcana domain", build: (l) => withClasses([cls("Cleric", l, "Arcana Domain")]) },
  { label: "cleric life domain", build: (l) => withClasses([cls("Cleric", l, "Life Domain")]) },
  { label: "monk four elements", build: (l) => withClasses([cls("Monk", l, "Way of the Four Elements")]) },
  { label: "monk open hand", build: (l) => withClasses([cls("Monk", l, "Way of the Open Hand")]) },
  { label: "barbarian path of the giant", build: (l) => withClasses([cls("Barbarian", l, "Path of the Giant")]) },
  { label: "barbarian totem warrior", build: (l) => withClasses([cls("Barbarian", l, "Path of the Totem Warrior")]) },
  { label: "barbarian berserker", build: (l) => withClasses([cls("Barbarian", l, "Path of the Berserker")]) },
  {
    label: "barbarian berserker with primal knowledge",
    build: (l) =>
      withClasses([cls("Barbarian", l, "Path of the Berserker")], {
        optionalFeatureReplacements: { "Primal Knowledge": true },
        chosenSkills: ["Athletics", "Perception"],
      }),
  },
  {
    label: "barbarian totem warrior with primal knowledge",
    build: (l) =>
      withClasses([cls("Barbarian", l, "Path of the Totem Warrior")], {
        optionalFeatureReplacements: { "Primal Knowledge": true },
      }),
  },
  { label: "fighter battle master", build: (l) => withClasses([cls("Fighter", l, "Battle Master")]) },
  // Short subclass spellings the chain has always matched by substring.
  { label: "druid short land name", build: (l) => withClasses([cls("Druid", l, "Land")]) },
  { label: "cleric short nature name", build: (l) => withClasses([cls("Cleric", l, "Nature")]) },
  { label: "sorcerer divinesoul spelling", build: (l) => withClasses([cls("Sorcerer", l, "divinesoul")]) },
  { label: "warlock short genie name", build: (l) => withClasses([cls("Warlock", l, "Genie")]) },
  { label: "monk short elements name", build: (l) => withClasses([cls("Monk", l, "Elements")]) },
  { label: "barbarian short totem name", build: (l) => withClasses([cls("Barbarian", l, "Totem")]) },
  { label: "barbarian short giant name", build: (l) => withClasses([cls("Barbarian", l, "Giant")]) },
  {
    label: "multiclass druid and barbarian totem",
    build: (l) => withClasses([cls("Druid", 2, "Circle of the Land"), cls("Barbarian", l, "Path of the Totem Warrior")]),
  },
  {
    label: "multiclass cleric nature and monk elements",
    build: (l) => withClasses([cls("Cleric", 1, "Nature Domain"), cls("Monk", l, "Way of the Four Elements")]),
  },
];

interface Recorded {
  id: string;
  traitName: string;
  origin: string;
  choose: number;
  level: number;
  effectLevel: number;
  replaces?: string;
  options: string[];
  optionsHash: string;
}

const record = (choice: AvailableRuleChoice): Recorded => ({
  id: choice.id,
  traitName: choice.traitName,
  origin: choice.origin,
  choose: choice.choose,
  level: choice.level,
  effectLevel: choice.effectLevel,
  ...(choice.replaces ? { replaces: choice.replaces } : {}),
  options: choice.options.map((o) => o.name),
  optionsHash: createHash("sha256").update(JSON.stringify(choice.options)).digest("hex").slice(0, 16),
});

interface Baseline {
  /** Every distinct recorded choice, keyed by its id and a digest of its full content. */
  choices: Record<string, Recorded>;
  /** Per scenario, the offered choice keys in order and the ids that survive book gating. */
  scenarios: Record<string, { subclassRuleChoices: string[]; availableIds: string[] }>;
}

function captureAll(): Baseline {
  const modes: [string, () => Compendium][] = [
    ["srd", srdBaselineCompendium],
    ["integrated", integratedTestCompendium],
  ];
  const choices: Record<string, Recorded> = {};
  const scenarios: Baseline["scenarios"] = {};
  for (const [mode, compendium] of modes) {
    const comp = compendium();
    for (const { label, build } of SCENARIOS) {
      for (const level of LEVELS) {
        for (const books of BOOK_SETS) {
          const character = build(level);
          const key = `${mode} | ${label} | L${level} | books=${books ? books.join("+") || "none" : "all"}`;
          const keys = subclassRuleChoices(character, books, comp).map((choice) => {
            const entry = record(choice);
            const digest = createHash("sha256").update(JSON.stringify(entry)).digest("hex").slice(0, 12);
            const choiceKey = `${entry.id}|${digest}`;
            choices[choiceKey] = entry;
            return choiceKey;
          });
          scenarios[key] = {
            subclassRuleChoices: keys,
            availableIds: availableSubclassRuleChoices(character, books, comp).map((c) => c.id),
          };
        }
      }
    }
  }
  return { choices, scenarios };
}

test("class and subclass Rule Choices match the recorded baseline in SRD and integrated modes", () => {
  const actual = captureAll();
  if (process.env.UPDATE_SUBCLASS_CHOICE_BASELINE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(actual)}\n`);
  }
  const expected = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  assert.deepEqual(actual, expected);
});

test("the baseline exercises every subclass choice family", () => {
  const ids = new Set(Object.values(captureAll().choices).map((entry) => entry.id));
  for (const id of [
    "PHB__Druid__Circle of the Land__Biome",
    "XGE__Sorcerer__Divine Soul__Affinity",
    "TCE__Warlock__The Genie__Kind",
    "PHB__Cleric__Nature Domain__Acolyte of Nature",
    "DMG__Cleric__Death Domain__Reaper",
    "SCAG__Cleric__Arcana Domain__Arcane Initiate",
    "PHB__Monk__Way of the Four Elements__Discipline 17",
    "TCE__Barbarian__Primal Knowledge 10",
    "BGG__Barbarian__Path of the Giant__Giant Power",
    "PHB__Barbarian__Path of the Totem Warrior__Totemic Attunement 14",
  ]) {
    assert.ok(ids.has(id), `baseline never offers ${id}`);
  }
});
