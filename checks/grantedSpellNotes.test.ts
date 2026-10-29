import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { grantedPreparedSpells } from "../src/rules/grantedSpells.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import type { Character, CharacterClass, RuleChoiceEntry } from "../src/types/character.ts";
import type { FeatData, RaceData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedArtificerClass, grantedSpellClasses, grantedSpellSpells } from "./grantedSpellsFixture.ts";
import { preparedGrantSpells } from "./grantedPreparedFixture.ts";

// A reviewed note on a granted spell is carried on that spell's entry, whichever path the grant takes: a plain prepared group, a
// prepared pick, or a pick of an Innate Magic card (ADR 0017). The note key matches the spell's name in any letter case. Every
// name and sentence here is invented.

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });

const feat = (name: string, extra: Partial<FeatData>): FeatData => ({
  name,
  source: "TST",
  prerequisite: null,
  abilityScoreIncrease: null,
  description: "Placeholder description for the feat.",
  ...extra,
});

const race = (name: string, extra: Partial<RaceData>): RaceData => ({
  name,
  source: "TST",
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [],
  description: "Placeholder description for the race.",
  ...extra,
});

const compendium = inMemoryCompendium({
  classes: [...grantedSpellClasses(), grantedArtificerClass()],
  spells: [...grantedSpellSpells(), ...preparedGrantSpells()],
  feats: [
    feat("Sample Note Mark", {
      additionalSpells: [{ prepared: { _: ["sample bulwark"] }, notes: { "Sample Bulwark": "self only" } }],
    }),
    feat("Sample Note Pick", {
      additionalSpells: [{ prepared: { _: [{ choose: "level=1|class=Sample Mage" }] }, notes: { "sample lure": "self only" } }],
    }),
  ],
  races: [
    race("Sample Noted", {
      additionalSpells: [
        { ability: "int", known: { "1": { _: [{ choose: "level=0|class=Sample Mage" }] } }, notes: { "Sample Ember": "self only" } },
      ],
    }),
  ],
});
const catalogs = { compendium, activeBooks: ALL_BOOKS };

test("a plain prepared spell of a held feat carries its reviewed note, whatever the letter case of the key", () => {
  const character = makeChar({
    classes: [mage(4)],
    originFeats: [{ level: 1, type: "feat", featName: "Sample Note Mark", featSource: "TST" }],
  });
  const granted = grantedPreparedSpells(character, catalogs).find((entry) => entry.spell.name === "Sample Bulwark");
  assert.equal(granted?.note, "self only");
});

test("a prepared pick of a held feat carries its reviewed note once the player has picked it", () => {
  const character = makeChar({
    classes: [mage(4)],
    originFeats: [{ level: 1, type: "feat", featName: "Sample Note Pick", featSource: "TST" }],
  });
  const pick: RuleChoiceEntry = {
    id: "TST__Feat Spells__Sample Note Pick__-__0",
    trait: "Sample Note Pick Spell",
    origin: "feat",
    choose: 1,
    from: ["Sample Lure", "Sample Fetch"],
    picked: ["Sample Lure"],
  };
  const granted = grantedPreparedSpells({ ...character, ruleChoices: [pick] }, catalogs).find(
    (entry) => entry.spell.name === "Sample Lure",
  );
  assert.equal(granted?.note, "self only");
});

test("a picked cantrip of a race's Innate Magic card carries its reviewed note, whatever the letter case of the key", () => {
  const character: Character = makeChar({ classes: [mage(4)], race: { name: "Sample Noted", source: "TST" } });
  const choice = raceSpellRuleChoices(character, compendium, ALL_BOOKS).find((c) => c.options.some((o) => o.name === "Sample Ember"));
  assert.ok(choice, "the race offers Sample Ember");
  const picked = pickRuleChoice(character, choice, "Sample Ember", compendium, ALL_BOOKS);
  const card = evaluateCharacter(picked, catalogs).grantedSpellSources.find((source) => source.title === "Sample Noted");
  assert.equal(card?.spells.find((spell) => spell.name === "Sample Ember")?.note, "self only");
});
