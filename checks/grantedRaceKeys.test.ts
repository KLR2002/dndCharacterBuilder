import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import type { CharacterClass } from "../src/types/character.ts";
import type { RaceData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedSpellBackgrounds, grantedSpellClasses, grantedSpellFeats, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// Race picks across catalogs (ADR 0017). Every name is invented (checks/grantedSpellsFixture.ts). "SRD" is the
// SRD-like catalog's source; "TST" is the integrated-like catalog's source of the same race.

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });

// A race whose subrace grants one cantrip from the Sample Mage class list, under the given book.
const sampleRace = (source: string): RaceData => ({
  name: "Sample Elf",
  source,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [
    {
      name: "Sample High",
      source,
      raceName: "Sample Elf",
      raceSource: source,
      isVariant: false,
      abilityScoreIncrease: [],
      darkvision: null,
      traits: [],
      description: "Placeholder description for the subrace.",
      additionalSpells: [{ ability: "int", known: { _: [{ choose: "level=0|class=Sample Mage", count: 1 }] } }],
    },
  ],
  description: "Placeholder description for the race.",
});

const srdLike = () =>
  inMemoryCompendium({ classes: grantedSpellClasses(), races: [sampleRace("SRD")], feats: grantedSpellFeats(), spells: grantedSpellSpells(), backgrounds: grantedSpellBackgrounds() });
const integratedLike = () =>
  inMemoryCompendium(
    { classes: grantedSpellClasses(), races: [sampleRace("TST")], feats: grantedSpellFeats(), spells: grantedSpellSpells(), backgrounds: grantedSpellBackgrounds() },
    { integrated: true },
  );

test("a cantrip picked for a race on the SRD-like catalog stands after the integrated catalog loads, with no release and no notice", () => {
  const first = srdLike();
  const saved = makeChar({
    classes: [mage(1)],
    race: { name: "Sample Elf", source: "SRD", subraceName: "Sample High", subraceSource: "SRD" },
  });
  const choice = raceSpellRuleChoices(saved, first).find((c) => c.options.some((o) => o.name === "Sample Shot"));
  assert.ok(choice, "the cantrip pick is offered on the SRD-like catalog");
  const picked = pickRuleChoice(saved, choice, "Sample Shot", first);
  assert.equal(picked.ruleChoices?.length, 1);

  const loaded = migrateCharacter(picked, [sampleRace("TST")], grantedSpellClasses());
  const opened = reconcile(loaded, integratedLike());
  assert.deepEqual(opened.ruleChoices, picked.ruleChoices, "the pick is kept with its id");
  assert.deepEqual(opened.needsReview ?? [], [], "no notice is raised");
  const card = evaluateCharacter(opened, { compendium: integratedLike() }).grantedSpellSources.find((source) => source.title === "Sample High");
  assert.ok(card?.spells.some((spell) => spell.name === "Sample Shot" && spell.isCantrip), "the cantrip is still listed at will on the race's card");
});

test("a save that keys a race pick by its source loads with the pick under the race's key, and the card lists it", () => {
  const legacy = makeChar({
    classes: [mage(1)],
    race: { name: "Sample Elf", source: "SRD", subraceName: "Sample High", subraceSource: "SRD" },
    ruleChoices: [
      {
        id: "SRD__Race Spells__Sample High__-__0",
        trait: "Sample High Cantrip",
        origin: "race",
        choose: 1,
        from: ["Sample Shot"],
        picked: ["Sample Shot"],
      },
    ],
  });
  const loaded = migrateCharacter(legacy, [sampleRace("SRD")], grantedSpellClasses());
  assert.deepEqual(
    loaded.ruleChoices?.map((entry) => [entry.id, entry.picked]),
    [["-__Race Spells__Sample High__-__0", ["Sample Shot"]]],
    "the pick is kept under the key the race now has",
  );
  const card = evaluateCharacter(loaded, { compendium: srdLike() }).grantedSpellSources.find((source) => source.title === "Sample High");
  assert.ok(card?.spells.some((spell) => spell.name === "Sample Shot" && spell.isCantrip), "the cantrip is listed on the race's card");
});

test("a cantrip picked on the integrated catalog stands after the SRD-like catalog loads, with no release and no notice", () => {
  const integrated = integratedLike();
  const saved = makeChar({
    classes: [mage(1)],
    race: { name: "Sample Elf", source: "TST", subraceName: "Sample High", subraceSource: "TST" },
  });
  const choice = raceSpellRuleChoices(saved, integrated).find((c) => c.options.some((o) => o.name === "Sample Shot"));
  assert.ok(choice, "the cantrip pick is offered on the integrated catalog");
  const picked = pickRuleChoice(saved, choice, "Sample Shot", integrated);

  const opened = reconcile(migrateCharacter(picked, [sampleRace("SRD")], grantedSpellClasses()), srdLike());
  assert.deepEqual(opened.ruleChoices, picked.ruleChoices, "the pick is kept with its id");
  assert.deepEqual(opened.needsReview ?? [], [], "no notice is raised");
});
