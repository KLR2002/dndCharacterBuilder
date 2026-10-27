import test from "node:test";
import assert from "node:assert/strict";
import { BACKGROUND_FEAT_SOURCE } from "../src/constants/rules.ts";
import { featSpellRuleChoices, heldFeatsOf } from "../src/rules/choices/featSpells.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import type { FeatData } from "../src/types/dnd5e.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import {
  grantedSpellBackgrounds,
  grantedSpellClasses,
  grantedSpellFeats,
  grantedSpellSpells,
} from "./grantedSpellsFixture.ts";

// Which record of a feat held in two books a background claim resolves to (ADR 0017, AC-15). Every name is invented
// (checks/grantedSpellsFixture.ts). "TST" and "TST2" are two invented books that each hold Sample Initiate.

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });
const sampleInitiate = grantedSpellFeats().find((feat) => feat.name === "Sample Initiate") as FeatData;

/** The sample feats, with a Sample Initiate record for each book given, in the order given. */
const catalogFeats = (...books: string[]): FeatData[] => [
  ...books.map((source): FeatData => ({ ...sampleInitiate, source })),
  ...grantedSpellFeats().filter((feat) => feat.name !== "Sample Initiate"),
];

/** A character whose background claims Sample Initiate, the background being the one given. */
const claimed = (background: { name: string; source: string }): Character =>
  makeChar({
    classes: [mage(4)],
    background: { name: background.name, source: background.source },
    originFeats: [{ level: 1, type: "feat", featName: "Sample Initiate", featSource: BACKGROUND_FEAT_SOURCE }],
  });

test("a background-claimed feat held in two books resolves to the background's own book before catalog order", () => {
  const held = heldFeatsOf(claimed({ name: "Sample Drifter", source: "TST2" }), catalogFeats("TST", "TST2"));
  assert.equal(held[0]?.feat.source, "TST2", "the book the background comes from is chosen before the first record listed");
});

test("an active book's record of a background-claimed feat outranks the background's own book and the catalog order", () => {
  const held = heldFeatsOf(claimed({ name: "Sample Drifter", source: "TST2" }), catalogFeats("TST2", "TST"), ["TST"]);
  assert.equal(held[0]?.feat.source, "TST", "the active book's record is chosen, though it is listed second and is not the background's book");
});

test("a pick made on a background-claimed feat is saved under the record it was made on, and every later load keeps it", () => {
  const compendium = inMemoryCompendium({
    classes: grantedSpellClasses(),
    feats: catalogFeats("TST", "TST2"),
    spells: grantedSpellSpells(),
    backgrounds: grantedSpellBackgrounds(),
  });
  const offered = (character: Character, option: string): AvailableRuleChoice => {
    const choice = featSpellRuleChoices(character, compendium).find((c) => c.options.some((o) => o.name === option));
    assert.ok(choice, `${option} is offered`);
    return choice;
  };
  let character = claimed({ name: "Sample Drifter", source: "TST2" });
  character = pickRuleChoice(character, offered(character, "Sample Mage Spells"), "Sample Mage Spells", compendium);
  character = pickRuleChoice(character, offered(character, "Sample Ember"), "Sample Ember", compendium);

  const saved = character.ruleChoices ?? [];
  assert.ok(
    saved.length > 0 && saved.every((entry) => entry.id.startsWith("TST2__Feat Spells__Sample Initiate__")),
    `the picks are keyed by the record they were made on: ${saved.map((entry) => entry.id).join(" | ")}`,
  );

  let loaded = character;
  for (let load = 0; load < 2; load += 1) loaded = reconcile(migrateCharacter(loaded, [], grantedSpellClasses()), compendium);
  assert.deepEqual(loaded.ruleChoices, character.ruleChoices, "the picks are kept as saved, with the same ids, on every load");
  assert.deepEqual(loaded.needsReview ?? [], [], "no notice is raised on load");
});

test("a background book switched off keeps the pick made on the record still offered, and reconciling without the active books keeps it too", () => {
  const compendium = inMemoryCompendium(
    {
      classes: grantedSpellClasses(),
      feats: catalogFeats("TST", "TST2"),
      spells: grantedSpellSpells(),
      backgrounds: grantedSpellBackgrounds(),
    },
    { integrated: true },
  );
  let character = claimed({ name: "Sample Drifter", source: "TST2" });
  const list = featSpellRuleChoices(character, compendium, ["TST"]).find((c) => c.options.some((o) => o.name === "Sample Mage Spells"));
  assert.ok(list, "the list is offered from the active book");
  character = pickRuleChoice(character, list, "Sample Mage Spells", compendium);
  assert.ok(
    character.ruleChoices?.some((entry) => entry.id.startsWith("TST__Feat Spells__Sample Initiate__")),
    "the pick is made on the record of the active book",
  );

  const reconciled = reconcile(character, compendium);
  assert.deepEqual(reconciled.ruleChoices, character.ruleChoices, "the pick is kept");
  assert.deepEqual(reconciled.needsReview ?? [], [], "no notice is raised");
});
