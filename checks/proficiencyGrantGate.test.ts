import { test } from "node:test";
import assert from "node:assert/strict";
import { proficiencySheet } from "../src/rules/proficiencySheet.ts";
import type { Character } from "../src/types/character.ts";
import type { ProficiencyGrant, RaceData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";

// A subrace's fixed weapon grant that a Rule Choice option gates (ADR 0015): the grant is on the sheet only while the
// option is picked. Every name and sentence here is invented.

const SOURCE = "TST";
const KIN = "Sample Kin";
const LINE = "Sample Line";
const CHOICE = "TST__Sample Kin__Sample Line__Sample Option (Choose 1)";
const TRAINING = "Sample Training";
const CHARM = "Sample Charm";

const gatedWeapons: ProficiencyGrant = {
  id: `${SOURCE}/Subrace/${KIN} (${LINE})@0#weapons:fixed:Sample Blade`,
  kind: "fixed",
  category: "weapons",
  names: ["Sample Blade"],
  gatedBy: { choiceId: CHOICE, option: TRAINING },
};

const kin: RaceData = {
  name: KIN,
  source: SOURCE,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: [],
  grants: [],
  description: "Placeholder description for the race.",
  subraces: [
    {
      name: LINE,
      source: SOURCE,
      raceName: KIN,
      raceSource: SOURCE,
      darkvision: null,
      description: "Placeholder description for the subrace.",
      abilityScoreIncrease: [],
      traits: [
        {
          name: "Sample Option (Choose 1)",
          description: "Placeholder description for the choice.",
          choice: {
            pick: 1,
            level: 1,
            options: [
              { name: TRAINING, description: "Placeholder description." },
              { name: CHARM, description: "Placeholder description." },
            ],
          },
        },
      ],
      grants: [
        gatedWeapons,
        { id: `${SOURCE}/Subrace/${KIN} (${LINE})@0#languages:fixed:Sample Tongue`, kind: "fixed", category: "languages", names: ["Sample Tongue"] },
      ],
    },
  ],
} as RaceData;

const compendium = inMemoryCompendium({ races: [kin] }, { integrated: true });
const catalogs = { compendium, activeBooks: [SOURCE] };

/** A character of the invented subrace whose Rule Choice holds the given picks, or none when `picked` is absent. */
function lineage(picked?: string[]): Character {
  const character = makeChar({ race: { name: KIN, source: SOURCE, subraceName: LINE, subraceSource: SOURCE } }) as Character;
  if (!picked) return character;
  return {
    ...character,
    ruleChoices: [{ id: CHOICE, trait: "Sample Option (Choose 1)", origin: "race", choose: 1, from: [TRAINING, CHARM], picked }],
  };
}

const weaponsOf = (character: Character) => proficiencySheet(character, catalogs).weapons.map((entry) => entry.name);

test("a gated fixed weapon grant is on the sheet only while its option is picked", () => {
  assert.deepEqual(weaponsOf(lineage()), [], "with no pick the gated weapon is not held");
  assert.deepEqual(weaponsOf(lineage([CHARM])), [], "the other option does not give it");
  assert.deepEqual(weaponsOf(lineage([TRAINING])), ["Sample Blade"], "the gated option gives it");
});

test("an ungated grant of the same subrace stays on the sheet with no pick", () => {
  const languages = proficiencySheet(lineage(), catalogs).languages.map((entry) => entry.name);
  assert.ok(languages.includes("Sample Tongue"), "the language grant has no gate");
});
