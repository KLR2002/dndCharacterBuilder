import { test } from "node:test";
import assert from "node:assert/strict";
import { integratedTestCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";
import {
  artificerInfusionChoices,
  battleMasterManeuverChoices,
  fightingStyleRuleChoices,
  isSpellEligibleForRitualBook,
  warlockInvocationChoices,
  warlockMysticArcanumChoices,
  warlockPactBoonChoices,
} from "../src/rules/ruleChoices.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import type { SpellData } from "../src/types/dnd5e.ts";

const BOOKS = ["PHB", "XGE", "TCE"];
const compendium = integratedTestCompendium();

const warlock = (level: number) => makeChar({ classes: [{ className: "Warlock", source: "PHB", level }] });
const fighter = (level: number, subclassName?: string) =>
  makeChar({ classes: [{ className: "Fighter", source: "PHB", level, subclassName }] });
const artificer = (level: number) => makeChar({ classes: [{ className: "Artificer", source: "PHB", level }] });

const offeredNames = (choices: AvailableRuleChoice[]) => choices.flatMap((c) => c.options.map((o) => o.name));

test("characterization: Pact Boon offers the PHB boons and the TCE boon with books PHB, XGE, TCE", () => {
  const [choice] = warlockPactBoonChoices(warlock(3), BOOKS, compendium);
  assert.deepEqual(offeredNames([choice]), [
    "Pact of the Blade",
    "Pact of the Chain",
    "Pact of the Talisman",
    "Pact of the Tome",
  ]);
});

test("characterization: Eldritch Invocations at level 2 offer the prerequisite-eligible PHB, XGE and TCE invocations", () => {
  const [choice] = warlockInvocationChoices(warlock(2), BOOKS, compendium);
  assert.equal(choice.id, "PHB__Warlock__Invocations 2");
  assert.deepEqual(offeredNames([choice]), [
    "Armor of Shadows",
    "Beast Speech",
    "Beguiling Influence",
    "Devil's Sight",
    "Eldritch Mind",
    "Eldritch Sight",
    "Eyes of the Rune Keeper",
    "Fiendish Vigor",
    "Gaze of Two Minds",
    "Mask of Many Faces",
    "Misty Visions",
    "Thief of Five Fates",
  ]);
});

test("characterization: Fighter's Fighting Style offers the PHB, XGE and TCE styles", () => {
  const [choice] = fightingStyleRuleChoices(fighter(1), BOOKS, compendium);
  assert.equal(choice.id, "PHB__Fighter__Fighting Style");
  assert.deepEqual(offeredNames([choice]), [
    "Archery",
    "Blind Fighting",
    "Defense",
    "Dueling",
    "Great Weapon Fighting",
    "Interception",
    "Protection",
    "Superior Technique",
    "Thrown Weapon Fighting",
    "Two-Weapon Fighting",
    "Unarmed Fighting",
  ]);
});

test("characterization: Battle Master maneuvers offer the same list at level 3 and level 7", () => {
  const expected = [
    "Ambush",
    "Bait and Switch",
    "Brace",
    "Commander's Strike",
    "Commanding Presence",
    "Disarming Attack",
    "Distracting Strike",
    "Evasive Footwork",
    "Feinting Attack",
    "Goading Attack",
    "Grappling Strike",
    "Lunging Attack",
    "Maneuvering Attack",
    "Menacing Attack",
    "Parry",
    "Precision Attack",
    "Pushing Attack",
    "Quick Toss",
    "Rally",
    "Riposte",
    "Sweeping Attack",
    "Tactical Assessment",
    "Trip Attack",
  ];
  const level3 = battleMasterManeuverChoices(fighter(3, "Battle Master"), BOOKS, compendium);
  assert.equal(level3[0].id, "PHB__Fighter__Battle Master__Maneuvers 3");
  assert.deepEqual(offeredNames([level3[0]]), expected);

  const level7 = battleMasterManeuverChoices(fighter(7, "Battle Master"), BOOKS, compendium);
  assert.deepEqual(offeredNames([level7[0]]), expected);
});

test("characterization: Artificer infusions at level 6 offer the TCE infusions with books PHB, XGE, TCE", () => {
  const choices = artificerInfusionChoices(artificer(6), BOOKS, compendium);
  const [level2] = choices.filter((c) => c.id === "TCE__Artificer__Infusions 2");
  assert.deepEqual(offeredNames([level2]), [
    "Armor of Magical Strength",
    "Boots of the Winding Path",
    "Enhanced Arcane Focus",
    "Enhanced Defense",
    "Enhanced Weapon",
    "Homunculus Servant",
    "Mind Sharpener",
    "Radiant Weapon",
    "Repeating Shot",
    "Replicate Magic Item",
    "Repulsion Shield",
    "Resistant Armor",
    "Returning Weapon",
    "Spell-Refueling Ring",
  ]);
});

test("an empty book list offers no Artificer infusion", () => {
  assert.deepEqual(artificerInfusionChoices(artificer(6), [], compendium), []);
});

test("an empty book list offers no Pact Boon, Eldritch Invocation, Fighting Style or maneuver", () => {
  const none: string[] = [];
  assert.deepEqual(offeredNames(warlockPactBoonChoices(warlock(3), none, compendium)), []);
  assert.deepEqual(offeredNames(warlockInvocationChoices(warlock(18), none, compendium)), []);
  assert.deepEqual(offeredNames(fightingStyleRuleChoices(fighter(1), none, compendium)), []);
  assert.deepEqual(offeredNames(battleMasterManeuverChoices(fighter(3, "Battle Master"), none, compendium)), []);
});

test("book codes compare without regard to case in every class option family", () => {
  const lower = ["phb", "xge", "tce"];
  const offers = (choices: AvailableRuleChoice[]) => choices.map((c) => [c.id, c.options.map((o) => o.name)]);

  assert.deepEqual(
    offers(warlockPactBoonChoices(warlock(3), lower, compendium)),
    offers(warlockPactBoonChoices(warlock(3), BOOKS, compendium)),
  );
  assert.deepEqual(
    offers(warlockInvocationChoices(warlock(18), lower, compendium)),
    offers(warlockInvocationChoices(warlock(18), BOOKS, compendium)),
  );
  assert.deepEqual(
    offers(warlockMysticArcanumChoices(warlock(11), lower, compendium)),
    offers(warlockMysticArcanumChoices(warlock(11), BOOKS, compendium)),
  );
  assert.deepEqual(
    offers(fightingStyleRuleChoices(fighter(1), lower, compendium)),
    offers(fightingStyleRuleChoices(fighter(1), BOOKS, compendium)),
  );
  assert.deepEqual(
    offers(battleMasterManeuverChoices(fighter(3, "Battle Master"), lower, compendium)),
    offers(battleMasterManeuverChoices(fighter(3, "Battle Master"), BOOKS, compendium)),
  );
  assert.deepEqual(
    offers(artificerInfusionChoices(artificer(6), lower, compendium)),
    offers(artificerInfusionChoices(artificer(6), BOOKS, compendium)),
  );
});

/** A ritual of the given book, invented from a full catalog record so it carries every spell field. */
function bookRitual(source: string, level: number): SpellData {
  const base = compendium.findSpell("Identify", "PHB");
  if (!base) throw new Error("the integrated catalog holds Identify");
  return { ...base, name: "Tiny Servant", level, source, ritual: true };
}

test("the Ritual Book admits an SRD spell with books PHB, and a book's spell in any case", () => {
  const detectMagic = srdBaselineCompendium().findSpell("Detect Magic", "SRD");
  assert.ok(detectMagic, "the SRD holds Detect Magic");
  assert.equal(isSpellEligibleForRitualBook(detectMagic, 3, ["PHB"], compendium), true);
  assert.equal(isSpellEligibleForRitualBook(bookRitual("XGE", 3), 5, ["xge"], compendium), true);
  assert.equal(isSpellEligibleForRitualBook(bookRitual("XGE", 3), 5, ["phb"], compendium), false);
});

test("an empty book list refuses a book's ritual and still admits the SRD ritual", () => {
  const detectMagic = srdBaselineCompendium().findSpell("Detect Magic", "SRD");
  assert.ok(detectMagic, "the SRD holds Detect Magic");
  assert.equal(isSpellEligibleForRitualBook(bookRitual("XGE", 3), 5, [], compendium), false);
  assert.equal(isSpellEligibleForRitualBook(detectMagic, 3, [], compendium), true);
});
