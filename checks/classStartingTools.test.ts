import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { fixedGrant, wardenClass } from "./proficiencySheetFixture.ts";
import type { ProficiencyGrant } from "../src/types/dnd5e.ts";

/**
 * A class's starting tools are its level-1 Proficiency Grants in the Catalog: a fixed tool and a tool
 * choice. Every name here is invented.
 */

const FIXED_ID = "FIX/Warden/Starting Proficiencies@1#0";
const CHOICE_ID = "FIX/Warden/Starting Proficiencies@1#1";
const POOL = ["Signal Mirror", "Dragon Dice", "Bell Kit"];

const startingGrants: ProficiencyGrant[] = [
  fixedGrant(FIXED_ID, "tools", ["lantern kit"]),
  { id: CHOICE_ID, kind: "choice", category: "tools", count: 2, pool: { kind: "names", names: POOL } },
];

const scribeClass = wardenClass({
  name: "Scribe",
  grants: [fixedGrant("FIX/Scribe/Starting Proficiencies@1#0", "tools", ["ink kit"])],
});

const compendium = () => inMemoryCompendium({ classes: [wardenClass({ grants: startingGrants }), scribeClass] });

const warden = (extra: Partial<Character> = {}, classes: Character["classes"] = [{ className: "Warden", source: "PHB", level: 1 }]) =>
  makeChar({ classes, ...extra });

const toolNames = (entries: SheetEntry[]) => entries.map((entry) => entry.name);

test("a class's starting tools come from its level-1 grants: the fixed tool is on the sheet, the choice is not until picked", () => {
  const sheet = proficiencySheet(warden(), { compendium: compendium(), activeBooks: ALL_BOOKS });
  assert.deepEqual(toolNames(sheet.tools), ["Lantern Kit"]);
});

test("only the first class's starting tools are granted; a later class adds none", () => {
  const sheet = proficiencySheet(
    warden({}, [
      { className: "Warden", source: "PHB", level: 1 },
      { className: "Scribe", source: "PHB", level: 1 },
    ]),
    { compendium: compendium(), activeBooks: ALL_BOOKS },
  );
  assert.deepEqual(toolNames(sheet.tools), ["Lantern Kit"]);
});

test("the starting tool choice is a Proficiency Choice at level 1, and its pick reaches the sheet", () => {
  const before = warden();
  const offer = proficiencyChoiceOffers(before, { compendium: compendium(), activeBooks: ALL_BOOKS }).find((o) => o.id === CHOICE_ID);
  assert.ok(offer, "the starting tool choice is offered at level 1");
  assert.equal(offer.pick, "proficiency");
  assert.equal(offer.origin, "class");
  assert.equal(offer.choose, 2);
  assert.deepEqual(offer.options.map((option) => option.name).sort(), [...POOL].sort());

  const picked = pickRuleChoice(before, offer, "Signal Mirror", compendium(), ALL_BOOKS);
  const sheet = proficiencySheet(picked, { compendium: compendium(), activeBooks: ALL_BOOKS });
  assert.ok(toolNames(sheet.tools).includes("Signal Mirror"), "the pick is on the sheet");
});

test("a saved class tool bucket still loads: its tools stay on the sheet, and reconciling moves them to the choice's pick", () => {
  const legacy = warden({ chosenTools: { class: ["Signal Mirror"] } });
  const before = proficiencySheet(legacy, { compendium: compendium(), activeBooks: ALL_BOOKS });
  assert.ok(toolNames(before.tools).includes("Signal Mirror"), "the bucket is read until it is migrated");

  const migrated = reconcile(legacy, compendium(), { activeBooks: ALL_BOOKS });
  assert.deepEqual(migrated.proficiencyPicks, { [CHOICE_ID]: ["Signal Mirror"] });
  assert.equal(migrated.chosenTools?.class, undefined, "the bucket is cleared once its picks are recorded");
  assert.deepEqual(proficiencySheet(migrated, { compendium: compendium(), activeBooks: ALL_BOOKS }).tools, before.tools, "the sheet does not change");
});

test("a pick on the starting tool choice is released with a notice when the character no longer holds the class", () => {
  const withPick = warden({ proficiencyPicks: { [CHOICE_ID]: ["Dragon Dice"] } });
  assert.deepEqual(reconcile(withPick, compendium(), { activeBooks: ALL_BOOKS }).proficiencyPicks, { [CHOICE_ID]: ["Dragon Dice"] }, "kept while the class is held");

  const withoutClass = warden({ proficiencyPicks: { [CHOICE_ID]: ["Dragon Dice"] } }, []);
  const released = reconcile(withoutClass, compendium(), { activeBooks: ALL_BOOKS });
  assert.equal(released.proficiencyPicks, undefined);
  assert.deepEqual(released.needsReview, ["Dragon Dice removed from Starting Proficiencies: no longer granted"]);
});
