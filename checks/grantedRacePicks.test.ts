import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { ancestryRuleChoices, pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { applyAncestrySelection } from "../src/rules/ancestryEngine.ts";
import type { AbilityScores, Character, CharacterClass } from "../src/types/character.ts";
import type { InnateSpellProfile } from "../src/rules/innateMagic.ts";
import type { RaceData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, loadTestCatalogs, makeChar, srdBaselineCompendium } from "./testUtils.ts";
import { grantedSpellClasses, grantedSpellFeats, grantedSpellRaces, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// A race's pick of spells and its casting ability (ADR 0017). Every name is invented
// (checks/grantedSpellsFixture.ts), except the Half-Elf and High Elf cases, which read the catalogs the repo tracks.

const compendium = inMemoryCompendium({
  classes: grantedSpellClasses(),
  races: grantedSpellRaces(),
  feats: grantedSpellFeats(),
  spells: grantedSpellSpells(),
});
const catalogs = { compendium };

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });
const scores = (overrides: Partial<AbilityScores>): AbilityScores => ({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  ...overrides,
});
const sourceTitled = (sources: InnateSpellProfile[], title: string) => sources.find((source) => source.title === title);

const gifted = (level: number) =>
  makeChar({
    classes: [mage(level)],
    race: { name: "Sample Gifted", source: "TST" },
    baseAbilityScores: scores({ int: 16 }),
  });

const caller = (level: number, baseAbilityScores: Partial<AbilityScores> = {}) =>
  makeChar({
    classes: [mage(level)],
    race: { name: "Sample Caller", source: "TST" },
    baseAbilityScores: scores(baseAbilityScores),
  });

/** The one offered race pick whose trait name contains `text`, with the option named `option` among its options. */
function offeredPick(character: Character, option: string, activeCompendium = compendium) {
  const choice = raceSpellRuleChoices(character, activeCompendium).find((c) => c.options.some((o) => o.name === option));
  assert.ok(choice, `${option} is offered as a race pick`);
  return choice;
}

test("a race's cantrip pick is offered from its class list, and the picked cantrip is at will on the race card", () => {
  const before = evaluateCharacter(gifted(1), catalogs);
  const unpicked = sourceTitled(before.grantedSpellSources, "Sample Gifted");
  assert.ok(unpicked, "the race has a card before its pick");
  assert.equal(unpicked.ability, "int");
  assert.deepEqual(unpicked.notices, ["Needs review: pick 1 more spell"]);
  assert.equal(unpicked.spells.some((spell) => spell.name === "Sample Shot"), false, "nothing is invented before the pick");

  const choice = offeredPick(gifted(1), "Sample Shot");
  assert.equal(choice.choose, 1);
  assert.equal(choice.options.some((o) => o.name === "Sample Veil"), false, "a level 2 spell is not a cantrip choice");

  const picked = pickRuleChoice(gifted(1), choice, "Sample Shot", compendium);
  const card = sourceTitled(evaluateCharacter(picked, catalogs).grantedSpellSources, "Sample Gifted");
  const shot = card?.spells.find((spell) => spell.name === "Sample Shot");
  assert.ok(shot, "the picked cantrip is listed");
  assert.equal(shot.isCantrip, true);
  assert.equal(shot.resourceCounterId, undefined, "a cantrip is at will");
  assert.equal(card?.notices, undefined, "no review notice once the pick is made");
  assert.equal(picked.knownSpells?.some((spell) => spell.name === "Sample Shot"), false, "the pick is not a known spell of the class");
});

test("a race's casting ability is chosen once and the card uses it, with the spell save DC and attack bonus of that ability", () => {
  const unchosen = sourceTitled(evaluateCharacter(caller(3, { wis: 14 }), catalogs).grantedSpellSources, "Sample Caller");
  assert.ok(unchosen, "a race with a chosen ability has a card before the choice");
  assert.equal(unchosen.ability, undefined);
  assert.ok(unchosen.notices?.includes("Needs review: choose a casting ability"), "the card asks for the ability");

  const abilityChoice = raceSpellRuleChoices(caller(3, { wis: 14 }), compendium).find((c) => c.id.endsWith("__Casting Ability"));
  assert.ok(abilityChoice, "the ability is offered as a choice");
  assert.deepEqual(abilityChoice.options.map((o) => o.name), ["int", "wis", "cha"]);

  const chosen = pickRuleChoice(caller(3, { wis: 14 }), abilityChoice, "wis", compendium);
  const card = sourceTitled(evaluateCharacter(chosen, catalogs).grantedSpellSources, "Sample Caller");
  assert.equal(card?.ability, "wis");
  assert.equal(card?.spellSaveDc, 8 + 2 + 2, "8 + proficiency bonus + Wisdom modifier");
  assert.equal(card?.spellAttackBonus, 2 + 2, "proficiency bonus + Wisdom modifier");
});

test("a race's pick that unlocks at a level is offered only from that level", () => {
  const offeredAt = (level: number) => raceSpellRuleChoices(caller(level), compendium).some((c) => c.options.some((o) => o.name === "Sample Lure"));
  assert.equal(offeredAt(2), false, "the level 1 spell pick waits for level 3");
  assert.equal(offeredAt(3), true, "level 3 unlocks the first-level spell pick");

  const cantripAt1 = raceSpellRuleChoices(caller(1), compendium).some((c) => c.options.some((o) => o.name === "Sample Shot"));
  assert.equal(cantripAt1, true, "the cantrip pick is offered at level 1");
});

test("changing race releases the race's spell picks and raises a review notice", () => {
  const character = pickRuleChoice(gifted(1), offeredPick(gifted(1), "Sample Shot"), "Sample Shot", compendium);
  const kin = (grantedSpellRaces() as RaceData[]).find((race) => race.name === "Sample Kin")!;
  const switched = applyAncestrySelection(character, kin, undefined, catalogs);

  assert.equal(switched.ruleChoices?.some((entry) => entry.picked.includes("Sample Shot")), false, "the old race's pick is released");
  assert.ok(
    switched.needsReview?.includes("Sample Gifted Cantrip removed: ancestry no longer grants it"),
    `a notice names the released pick: ${JSON.stringify(switched.needsReview)}`
  );
});

test("on the SRD Baseline alone, a High Elf picks its wizard cantrip, and the card lists it at will with Intelligence", () => {
  const highElf = makeChar({
    classes: [mage(1)],
    race: { name: "Elf", source: "SRD", subraceName: "High", subraceSource: "SRD" },
    baseAbilityScores: scores({ int: 16 }),
  });
  const srd = { compendium: srdBaselineCompendium() };

  const before = sourceTitled(evaluateCharacter(highElf, srd).grantedSpellSources, "High");
  assert.ok(before, "the High Elf has a card before the pick");
  assert.equal(before.ability, "int");
  assert.deepEqual(before.notices, ["Needs review: pick 1 more spell"]);

  const choice = raceSpellRuleChoices(highElf, srdBaselineCompendium()).find((c) => c.options.some((o) => o.name === "Fire Bolt"));
  assert.ok(choice, "the wizard cantrips are offered on the SRD Baseline");
  const picked = pickRuleChoice(highElf, choice, "Fire Bolt", srdBaselineCompendium());
  const card = sourceTitled(evaluateCharacter(picked, srd).grantedSpellSources, "High");
  assert.ok(card?.spells.some((spell) => spell.name === "Fire Bolt" && spell.isCantrip));
});

// The descent choice's Cantrip option gives the wizard cantrip; the other options give nothing. The catalog lists the
// cantrip on the subrace whatever the pick, so the grant is read only once the player picks Cantrip.
test("a Half-Elf of high descent gets the wizard cantrip only once the descent choice is Cantrip", () => {
  const tracked = loadTestCatalogs();
  const real = { compendium: inMemoryCompendium(tracked) };
  const halfElf = makeChar({
    classes: [mage(1)],
    race: { name: "Half-Elf", source: "PHB", subraceName: "Moon Elf or Sun Elf Descent", subraceSource: "SCAG" },
    baseAbilityScores: scores({ int: 16 }),
  });
  assert.equal(sourceTitled(evaluateCharacter(halfElf, real).grantedSpellSources, "Moon Elf or Sun Elf Descent"), undefined, "no card before Cantrip is picked");

  const descent = ancestryRuleChoices(halfElf, tracked.races as RaceData[]).find((c) => c.options.some((o) => o.name === "Cantrip"));
  assert.ok(descent, "the descent choice offers Cantrip");
  const withCantrip = pickRuleChoice(halfElf, descent, "Cantrip", real.compendium);
  const unpicked = sourceTitled(evaluateCharacter(withCantrip, real).grantedSpellSources, "Moon Elf or Sun Elf Descent");
  assert.equal(unpicked?.ability, "int");
  assert.deepEqual(unpicked?.notices, ["Needs review: pick 1 more spell"]);

  const spellChoice = raceSpellRuleChoices(withCantrip, real.compendium).find((c) => c.options.some((o) => o.name === "Fire Bolt"));
  assert.ok(spellChoice, "the wizard cantrips are offered once Cantrip is picked");
  const withSpell = pickRuleChoice(withCantrip, spellChoice, "Fire Bolt", real.compendium);
  assert.ok(sourceTitled(evaluateCharacter(withSpell, real).grantedSpellSources, "Moon Elf or Sun Elf Descent")?.spells.some((spell) => spell.name === "Fire Bolt"));

  const otherDescent = pickRuleChoice(withSpell, descent, "Skill Versatility", real.compendium);
  assert.equal(sourceTitled(evaluateCharacter(otherDescent, real).grantedSpellSources, "Moon Elf or Sun Elf Descent"), undefined, "the card goes when Cantrip is not picked");
  assert.equal(otherDescent.ruleChoices?.some((entry) => entry.picked.includes("Fire Bolt")), false, "and the wizard cantrip pick is released");
});
