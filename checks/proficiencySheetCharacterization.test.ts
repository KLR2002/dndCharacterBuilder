import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import type { Character, CharacterClass } from "../src/types/character.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import type { Compendium } from "../src/services/compendium.ts";
import { integratedTestCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";

/**
 * Regression net for the tools and languages a character shows. Every representative character,
 * level and active book set is recorded in SRD and integrated modes, so a change to what the
 * card lists fails here. Lists are compared sorted, because the question is what the character
 * has, not the order the readers happen to produce it in.
 *
 * The baseline is never edited by hand. To re-record it deliberately:
 *   UPDATE_PROFICIENCY_SHEET_BASELINE=1 node --test checks/proficiencySheetCharacterization.test.ts
 */

const BASELINE_PATH = new URL("./fixtures/proficiencySheetBaseline.json", import.meta.url);
const LEVELS = [1, 3, 6, 11, 14, 17];
const BOOK_SETS: (string[] | undefined)[] = [
  undefined,
  ["PHB"],
  ["PHB", "XGE", "TCE", "FTD", "BGG", "SCAG", "DMG"],
];

const cls = (className: string, level: number, subclassName?: string, source = "PHB"): CharacterClass => ({
  className,
  source,
  level,
  ...(subclassName ? { subclassName, subclassSource: source } : {}),
});

const race = (name: string, subraceName?: string, source = "PHB") => ({
  name,
  source,
  ...(subraceName ? { subraceName, subraceSource: source } : {}),
});

const background = (name: string, source = "PHB") => ({ name, source });

const withClasses = (classes: CharacterClass[], overrides: Partial<Character> = {}): Character =>
  makeChar({ classes, ...overrides });

type Build = (level: number) => Character;

const SCENARIOS: { label: string; build: Build }[] = [
  {
    label: "human soldier champion",
    build: (l) => withClasses([cls("Fighter", l, "Champion")], { race: race("Human"), background: background("Soldier") }),
  },
  {
    label: "dwarf hill cleric life domain",
    build: (l) =>
      withClasses([cls("Cleric", l, "Life Domain")], { race: race("Dwarf", "Hill"), background: background("Acolyte") }),
  },
  {
    label: "high elf sage evoker with a picked language",
    build: (l) =>
      withClasses([cls("Wizard", l, "School of Evocation")], {
        race: race("Elf", "High"),
        background: background("Sage"),
        chosenLanguages: { race: ["Dwarvish"] },
      }),
  },
  {
    label: "half-elf criminal thief",
    build: (l) =>
      withClasses([cls("Rogue", l, "Thief")], {
        race: race("Half-Elf"),
        background: background("Criminal"),
        chosenLanguages: { race: ["Elvish"] },
      }),
  },
  {
    label: "rock gnome guild artisan alchemist artificer",
    build: (l) =>
      withClasses([cls("Artificer", l, "Alchemist", "TCE")], {
        race: race("Gnome", "Rock"),
        background: background("Guild Artisan"),
      }),
  },
  {
    label: "human soldier armorer artificer",
    build: (l) =>
      withClasses([cls("Artificer", l, "Armorer", "TCE")], { race: race("Human"), background: background("Soldier") }),
  },
  {
    label: "battle smith artificer with a picked artisan tool and expertise",
    build: (l) =>
      withClasses([cls("Artificer", l, "Battle Smith", "TCE")], {
        race: race("Human"),
        background: background("Acolyte"),
        chosenTools: { class: ["Calligrapher's Supplies"] },
        chosenExpertise: ["Smith's Tools"],
      }),
  },
  {
    label: "bard college of lore entertainer with picked instruments",
    build: (l) =>
      withClasses([cls("Bard", l, "College of Lore")], {
        race: race("Half-Elf"),
        background: background("Entertainer"),
        chosenTools: { class: ["Lute", "Dulcimer", "Viol"], background: ["Lute"] },
      }),
  },
  {
    label: "barbarian path of the giant folk hero",
    build: (l) =>
      withClasses([cls("Barbarian", l, "Path of the Giant", "BGG")], {
        race: race("Human"),
        background: background("Folk Hero"),
      }),
  },
  {
    label: "barbarian berserker outlander",
    build: (l) => withClasses([cls("Barbarian", l, "Path of the Berserker")], { race: race("Human"), background: background("Outlander") }),
  },
  {
    label: "druid circle of the land hermit",
    build: (l) => withClasses([cls("Druid", l, "Circle of the Land")], { race: race("Human"), background: background("Hermit") }),
  },
  {
    label: "druid circle of the shepherd hermit",
    build: (l) =>
      withClasses([cls("Druid", l, "Circle of the Shepherd", "XGE")], { race: race("Human"), background: background("Hermit") }),
  },
  {
    label: "monk way of the drunken master acolyte",
    build: (l) =>
      withClasses([cls("Monk", l, "Way of the Drunken Master", "XGE")], { race: race("Human"), background: background("Acolyte") }),
  },
  {
    label: "monk way of the kensei sailor",
    build: (l) =>
      withClasses([cls("Monk", l, "Way of the Kensei", "XGE")], { race: race("Human"), background: background("Sailor") }),
  },
  {
    label: "monk way of mercy acolyte",
    build: (l) => withClasses([cls("Monk", l, "Way of Mercy", "TCE")], { race: race("Human"), background: background("Acolyte") }),
  },
  {
    label: "monk way of the ascendant dragon",
    build: (l) =>
      withClasses([cls("Monk", l, "Way of the Ascendant Dragon", "FTD")], { race: race("Human"), background: background("Acolyte") }),
  },
  {
    label: "monk way of the open hand acolyte",
    build: (l) => withClasses([cls("Monk", l, "Way of the Open Hand")], { race: race("Human"), background: background("Acolyte") }),
  },
  {
    label: "ranger drakewarden outlander",
    build: (l) =>
      withClasses([cls("Ranger", l, "Drakewarden", "FTD")], { race: race("Human"), background: background("Outlander") }),
  },
  {
    label: "ranger hunter outlander",
    build: (l) => withClasses([cls("Ranger", l, "Hunter")], { race: race("Human"), background: background("Outlander") }),
  },
  {
    label: "rogue mastermind criminal",
    build: (l) =>
      withClasses([cls("Rogue", l, "Mastermind", "XGE")], { race: race("Human"), background: background("Criminal") }),
  },
  {
    label: "rogue assassin charlatan",
    build: (l) => withClasses([cls("Rogue", l, "Assassin")], { race: race("Human"), background: background("Charlatan") }),
  },
  {
    label: "dragonborn draconic sorcerer noble",
    build: (l) =>
      withClasses([cls("Sorcerer", l, "Draconic Bloodline")], { race: race("Dragonborn"), background: background("Noble") }),
  },
  {
    label: "sorcerer storm sorcery sailor",
    build: (l) =>
      withClasses([cls("Sorcerer", l, "Storm Sorcery", "XGE")], { race: race("Human"), background: background("Sailor") }),
  },
  {
    label: "cleric forge domain soldier",
    build: (l) =>
      withClasses([cls("Cleric", l, "Forge Domain", "XGE")], { race: race("Dwarf", "Mountain"), background: background("Soldier") }),
  },
  {
    label: "fighter rune knight noble",
    build: (l) =>
      withClasses([cls("Fighter", l, "Rune Knight", "TCE")], { race: race("Human"), background: background("Noble") }),
  },
  {
    label: "paladin oath of devotion acolyte",
    build: (l) => withClasses([cls("Paladin", l, "Oath of Devotion")], { race: race("Human"), background: background("Acolyte") }),
  },
  {
    label: "warlock the genie charlatan",
    build: (l) => withClasses([cls("Warlock", l, "The Genie", "TCE")], { race: race("Human"), background: background("Charlatan") }),
  },
  {
    label: "multiclass druid shepherd and ranger drakewarden",
    build: (l) =>
      withClasses([cls("Druid", 2, "Circle of the Shepherd", "XGE"), cls("Ranger", Math.max(1, l - 2), "Drakewarden", "FTD")], {
        race: race("Human"),
        background: background("Hermit"),
      }),
  },
  {
    label: "multiclass artificer alchemist and draconic sorcerer",
    build: (l) =>
      withClasses([cls("Artificer", 2, "Alchemist", "TCE"), cls("Sorcerer", Math.max(1, l - 2), "Draconic Bloodline")], {
        race: race("Human"),
        background: background("Guild Artisan"),
      }),
  },
  {
    label: "multiclass rogue with a recorded multiclass tool",
    build: (l) =>
      withClasses([cls("Fighter", l, "Champion"), cls("Rogue", 1, "Thief")], {
        race: race("Human"),
        background: background("Soldier"),
        multiclassProficiencies: [{ className: "Rogue", tools: ["Thieves' Tools"] }],
      }),
  },
  {
    label: "human acolyte with picked languages and tools",
    build: (l) =>
      withClasses([cls("Fighter", l, "Champion")], {
        race: race("Human"),
        background: background("Acolyte"),
        chosenLanguages: { race: ["Elvish"], background: ["Infernal"] },
        chosenTools: { background: ["Thieves' Tools"] },
      }),
  },
  {
    label: "no race, background or class",
    build: () => makeChar(),
  },
  {
    label: "legacy languages only",
    build: () => makeChar({ languages: ["Elvish", "Common"] }),
  },
];

interface Recorded {
  tools: string[];
  expertise: string[];
  languages: string[];
}

function captureAll(): Record<string, Recorded> {
  const modes: [string, () => Compendium][] = [
    ["srd", srdBaselineCompendium],
    ["integrated", integratedTestCompendium],
  ];
  const out: Record<string, Recorded> = {};
  for (const [mode, compendium] of modes) {
    const comp = compendium();
    for (const { label, build } of SCENARIOS) {
      for (const level of LEVELS) {
        for (const books of BOOK_SETS) {
          const character = build(level);
          const key = `${mode} | ${label} | L${level} | books=${books ? books.join("+") : "all"}`;
          const evaluated = evaluateCharacter(character, { compendium: comp, activeBooks: books });
          out[key] = {
            tools: [...evaluated.proficiencies.tools].sort(),
            expertise: evaluated.tools.filter((t) => t.isExpertise).map((t) => t.name).sort(),
            languages: [...evaluated.proficiencies.languages].sort(),
          };
        }
      }
    }
  }
  return out;
}

test("tools and languages match the recorded baseline in SRD and integrated modes", () => {
  const actual = captureAll();
  if (process.env.UPDATE_PROFICIENCY_SHEET_BASELINE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(actual, null, 1)}\n`);
  }
  const expected = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, Recorded>;
  assert.deepEqual(actual, expected);
});

test("the baseline records every scenario in both modes", () => {
  const keys = Object.keys(JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, Recorded>);
  for (const mode of ["srd", "integrated"]) {
    for (const { label } of SCENARIOS) {
      assert.ok(
        keys.some((key) => key.startsWith(`${mode} | ${label} | `)),
        `baseline has no ${mode} rows for "${label}"`,
      );
    }
  }
});
