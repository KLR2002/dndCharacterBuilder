import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { grantedPreparedSpells, grantedSpellSources } from "../src/rules/grantedSpells.ts";
import { heldExpandedSpellNames } from "../src/rules/backgroundSpells.ts";
import { featSpellRuleChoices, raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import type { Character } from "../src/types/character.ts";
import { integratedTestCompendium, makeChar } from "./testUtils.ts";

// Characterization of the owners that grant spells (ADR 0017), on the integrated test catalog. The snapshots pin what the
// readers return today: a Tiefling (race grants), and a High Elf with its cantrip picked, Magic Initiate with its list picked,
// Fey Touched with its ability, and a Strixhaven background (expanded lists). Owner discovery may move; these outputs may not.

const compendium = integratedTestCompendium();
const catalogs = { compendium, activeBooks: ALL_BOOKS };

/** Picks the first offered option not yet taken of every spell choice the character is offered, until none is open. */
function pickEverything(character: Character): Character {
  let current = character;
  for (let round = 0; round < 40; round++) {
    const open = [...raceSpellRuleChoices(current, compendium, ALL_BOOKS), ...featSpellRuleChoices(current, compendium, ALL_BOOKS)].find(
      (choice) => (current.ruleChoices?.find((entry) => entry.id === choice.id)?.picked.length ?? 0) < choice.choose,
    );
    if (!open) break;
    const taken = current.ruleChoices?.find((entry) => entry.id === open.id)?.picked ?? [];
    const next = open.options.find((option) => !taken.includes(option.name));
    if (!next) break;
    current = pickRuleChoice(current, open, next.name, compendium, ALL_BOOKS);
  }
  return current;
}

/** The choices in the compact form the snapshots pin: the id, the trait, the level and the names offered. */
const compactChoices = (choices: AvailableRuleChoice[]) =>
  choices.map((choice) => ({
    id: choice.id,
    traitName: choice.traitName,
    choose: choice.choose,
    level: choice.level,
    origin: choice.origin,
    options: choice.options.map((option) => option.name),
  }));

/** Everything the five readers return for a character, in the compact form the snapshots pin. */
function readersOf(character: Character) {
  return {
    grantedSpellSources: grantedSpellSources(character, catalogs),
    grantedPreparedSpells: grantedPreparedSpells(character, catalogs).map((prepared) => ({
      name: prepared.spell.name,
      source: prepared.source,
      minCharacterLevel: prepared.minCharacterLevel,
      ...(prepared.minSpellLevel !== undefined ? { minSpellLevel: prepared.minSpellLevel } : {}),
    })),
    heldExpandedSpellNames: heldExpandedSpellNames(character, compendium, ALL_BOOKS),
    featSpellRuleChoices: compactChoices(featSpellRuleChoices(character, compendium, ALL_BOOKS)),
    raceSpellRuleChoices: compactChoices(raceSpellRuleChoices(character, compendium, ALL_BOOKS)),
  };
}

const wizard = (level: number) => ({ className: "Wizard", source: "PHB", level });

const tiefling = makeChar({
  classes: [wizard(3)],
  race: { name: "Tiefling", source: "PHB" },
  baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
});

const highElfKit = makeChar({
  classes: [wizard(8)],
  race: { name: "Elf", source: "PHB", subraceName: "High", subraceSource: "PHB" },
  baseAbilityScores: { str: 10, dex: 12, con: 10, int: 16, wis: 10, cha: 14 },
  background: { name: "Lorehold Student", source: "SCC" },
  asiSelections: [
    { level: 4, type: "feat", featName: "Magic Initiate", featSource: "PHB" },
    { level: 8, type: "feat", featName: "Fey Touched", featSource: "TCE", featAbility: "cha" },
  ],
});

test("a Tiefling's race grants read as they do today: the cantrip at will, the daily spell from level 3", () => {
  assert.deepEqual(readersOf(tiefling), {
    "grantedSpellSources": [
      {
        "title": "Tiefling",
        "origin": "race",
        "ability": "cha",
        "spellSaveDc": 13,
        "spellAttackBonus": 5,
        "spells": [
          {
            "name": "Thaumaturgy",
            "level": 0,
            "minCharacterLevel": 1,
            "castingTime": "1 action",
            "source": "PHB",
            "isCantrip": true
          },
          {
            "name": "Hellish Rebuke",
            "level": 2,
            "minCharacterLevel": 3,
            "castingTime": "1 reaction, which you take in response to being damaged by a creature within 60 feet of you that you can see",
            "source": "PHB",
            "isCantrip": false,
            "resourceCounterId": "innate_spell_hellish_rebuke",
            "maxUses": 1
          }
        ]
      }
    ],
    "grantedPreparedSpells": [],
    "heldExpandedSpellNames": [],
    "featSpellRuleChoices": [],
    "raceSpellRuleChoices": []
  });
});

test("a High Elf with its cantrip picked, Magic Initiate, Fey Touched and a Strixhaven background read as they do today", () => {
  assert.deepEqual(readersOf(pickEverything(highElfKit)), {
    "grantedSpellSources": [
      {
        "title": "High Elf",
        "origin": "race",
        "ability": "int",
        "spellSaveDc": 14,
        "spellAttackBonus": 6,
        "spells": [
          {
            "name": "Acid Splash",
            "level": 0,
            "minCharacterLevel": 1,
            "castingTime": "1 action",
            "source": "PHB",
            "isCantrip": true
          }
        ]
      },
      {
        "title": "Magic Initiate (Bard)",
        "origin": "feat",
        "ability": "cha",
        "spellSaveDc": 13,
        "spellAttackBonus": 5,
        "spells": [
          {
            "name": "Blade Ward",
            "level": 0,
            "minCharacterLevel": 1,
            "castingTime": "1 action",
            "source": "PHB",
            "isCantrip": true
          },
          {
            "name": "Dancing Lights",
            "level": 0,
            "minCharacterLevel": 1,
            "castingTime": "1 action",
            "source": "PHB",
            "isCantrip": true
          },
          {
            "name": "Animal Friendship",
            "level": 1,
            "minCharacterLevel": 1,
            "castingTime": "1 action",
            "source": "PHB",
            "isCantrip": false,
            "resourceCounterId": "innate_feat__magic_initiate__bard_spells__animal_friendship",
            "maxUses": 1
          }
        ]
      },
      {
        "title": "Fey Touched",
        "origin": "feat",
        "ability": "cha",
        "spellSaveDc": 13,
        "spellAttackBonus": 5,
        "spells": [
          {
            "name": "Misty Step",
            "level": 2,
            "minCharacterLevel": 1,
            "castingTime": "1 bonus",
            "source": "PHB",
            "isCantrip": false,
            "resourceCounterId": "innate_feat__fey_touched__misty_step",
            "maxUses": 1
          },
          {
            "name": "Animal Friendship",
            "level": 1,
            "minCharacterLevel": 1,
            "castingTime": "1 action",
            "source": "PHB",
            "isCantrip": false,
            "resourceCounterId": "innate_feat__fey_touched__animal_friendship",
            "maxUses": 1
          }
        ]
      }
    ],
    "grantedPreparedSpells": [],
    "heldExpandedSpellNames": [
      "comprehend languages",
      "identify",
      "borrowed knowledge",
      "locate object",
      "speak with dead",
      "spirit guardians",
      "arcane eye",
      "stone shape",
      "flame strike",
      "legend lore"
    ],
    "featSpellRuleChoices": [
      {
        "id": "PHB__Feat Spells__Magic Initiate__Spell List",
        "traitName": "Magic Initiate Spell List",
        "choose": 1,
        "level": 1,
        "origin": "feat",
        "options": [
          "Bard Spells",
          "Cleric Spells",
          "Druid Spells",
          "Sorcerer Spells",
          "Warlock Spells",
          "Wizard Spells"
        ]
      },
      {
        "id": "PHB__Feat Spells__Magic Initiate__Bard Spells__0",
        "traitName": "Magic Initiate Cantrip",
        "choose": 2,
        "level": 1,
        "origin": "feat",
        "options": [
          "Blade Ward",
          "Dancing Lights",
          "Friends",
          "Light",
          "Mage Hand",
          "Mending",
          "Message",
          "Minor Illusion",
          "Prestidigitation",
          "Thunderclap",
          "True Strike",
          "Vicious Mockery"
        ]
      },
      {
        "id": "PHB__Feat Spells__Magic Initiate__Bard Spells__1",
        "traitName": "Magic Initiate Spell",
        "choose": 1,
        "level": 1,
        "origin": "feat",
        "options": [
          "Animal Friendship",
          "Bane",
          "Charm Person",
          "Color Spray",
          "Command",
          "Comprehend Languages",
          "Cure Wounds",
          "Detect Magic",
          "Disguise Self",
          "Dissonant Whispers",
          "Distort Value",
          "Earth Tremor",
          "Faerie Fire",
          "Feather Fall",
          "Healing Word",
          "Heroism",
          "Identify",
          "Illusory Script",
          "Longstrider",
          "Silent Image",
          "Silvery Barbs",
          "Sleep",
          "Speak with Animals",
          "Tasha's Hideous Laughter",
          "Thunderwave",
          "Unseen Servant"
        ]
      },
      {
        "id": "TCE__Feat Spells__Fey Touched__-__0",
        "traitName": "Fey Touched Spell",
        "choose": 1,
        "level": 1,
        "origin": "feat",
        "options": [
          "Animal Friendship",
          "Bane",
          "Beast Bond",
          "Bless",
          "Charm Person",
          "Command",
          "Compelled Duel",
          "Comprehend Languages",
          "Detect Evil and Good",
          "Detect Magic",
          "Detect Poison and Disease",
          "Dissonant Whispers",
          "Gift of Alacrity",
          "Heroism",
          "Hex",
          "Hunter's Mark",
          "Identify",
          "Silvery Barbs",
          "Sleep",
          "Speak with Animals",
          "Tasha's Hideous Laughter"
        ]
      }
    ],
    "raceSpellRuleChoices": [
      {
        "id": "-__Race Spells__High__-__0",
        "traitName": "High Elf Cantrip",
        "choose": 1,
        "level": 1,
        "origin": "race",
        "options": [
          "Acid Splash",
          "Blade Ward",
          "Booming Blade",
          "Chill Touch",
          "Control Flames",
          "Create Bonfire",
          "Dancing Lights",
          "Fire Bolt",
          "Friends",
          "Frostbite",
          "Green-Flame Blade",
          "Gust",
          "Infestation",
          "Light",
          "Lightning Lure",
          "Mage Hand",
          "Mending",
          "Message",
          "Mind Sliver",
          "Minor Illusion",
          "Mold Earth",
          "Poison Spray",
          "Prestidigitation",
          "Ray of Frost",
          "Shape Water",
          "Shocking Grasp",
          "Sword Burst",
          "Thunderclap",
          "Toll the Dead",
          "True Strike"
        ]
      }
    ]
  });
});
