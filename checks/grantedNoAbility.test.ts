import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { grantedSpellSources } from "../src/rules/grantedSpells.ts";
import type { AsiSelection, CharacterClass } from "../src/types/character.ts";
import type { InnateSpellProfile } from "../src/rules/innateMagic.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedNoAbilityFeats, grantedSpellClasses, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// A feat whose grant names spells and no casting ability gets a card: its cantrips at will, its daily spells on Long Rest
// counters, and no ability, save DC or attack bonus (ADR 0017 amendment). A grant that names only ritual spells gets no card.
// Every name is invented (checks/grantedSpellsFixture.ts).

const compendium = inMemoryCompendium({
  classes: grantedSpellClasses(),
  feats: grantedNoAbilityFeats(),
  spells: grantedSpellSpells(),
});
const catalogs = { compendium, activeBooks: ALL_BOOKS };

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });

const takenFeat = (featName: string): AsiSelection => ({
  level: 4,
  type: "feat",
  featName,
  featSource: "TST",
});

const sourceTitled = (sources: InnateSpellProfile[], title: string): InnateSpellProfile | undefined =>
  sources.find((source) => source.title === title);

test("a feat that names spells and no ability is a card with its cantrip at will and its daily spell on a counter, with no DC or attack", () => {
  const character = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Charter")] });
  const card = sourceTitled(grantedSpellSources(character, catalogs), "Sample Charter");
  assert.ok(card, "the feat has its own card");
  assert.equal(card.ability, undefined, "no ability is named");
  assert.equal(card.spellSaveDc, undefined, "so there is no save DC");
  assert.equal(card.spellAttackBonus, undefined, "and no attack bonus");
  assert.equal(card.notices, undefined, "and nothing is owed");

  const ember = card.spells.find((spell) => spell.name === "Sample Ember");
  assert.ok(ember, "the cantrip is on the card");
  assert.equal(ember.resourceCounterId, undefined, "a cantrip is at will");

  const pulse = card.spells.find((spell) => spell.name === "Sample Pulse");
  assert.equal(pulse?.maxUses, 1, "the daily spell is cast once per Long Rest");
  assert.ok(pulse?.resourceCounterId, "and carries a Long Rest counter");
});

test("the card reaches the evaluated character with no ability, and a feat with only a daily spell gets one too", () => {
  const character = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Envoy")] });
  const evaluated = evaluateCharacter(character, catalogs);
  const card = sourceTitled(evaluated.grantedSpellSources, "Sample Envoy");
  assert.ok(card, "the evaluated character holds the card");
  assert.equal(card.ability, undefined);
  assert.equal(card.spellSaveDc, undefined);
  assert.equal(card.spellAttackBonus, undefined);
  assert.equal(card.spells.length, 1, "its one daily spell is on the card");
  assert.equal(card.spells[0].maxUses, 1);
});

test("a feat that names only ritual spells gives no card", () => {
  const character = makeChar({ classes: [mage(4)], asiSelections: [takenFeat("Sample Ledger")] });
  assert.equal(sourceTitled(grantedSpellSources(character, catalogs), "Sample Ledger"), undefined, "the ritual book is not modelled");
  assert.equal(sourceTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Ledger"), undefined);
});
