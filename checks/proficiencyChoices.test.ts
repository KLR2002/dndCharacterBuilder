import test from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import type { SubclassData } from "../src/types/dnd5e.ts";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { pickerTitles, proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import type { ChoiceProficiencyGrant } from "../src/rules/proficiencyPools.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import {
  inMemoryCompendium,
  integratedTestCompendium,
  makeChar,
  srdBaselineCompendium,
} from "./testUtils.ts";
import { anyLanguageChoice, placeholderFeat, wardenClass } from "./proficiencySheetFixture.ts";

/**
 * Proficiency Choices. Invented rules (the Lampwright, the Lantern Scholar feat) carry
 * the fixtures; the Kensei brush is tested end to end against the integrated test compendium.
 */

const names = (entries: SheetEntry[]) => entries.map((entry) => entry.name);

const LAMP_ID = "FIX/Warden/Lampwright/Lamp Craft@3#0";
const LAMP_TONGUE_ID = "FIX/Warden/Lampwright/Lamp Tongue@3#0";
const SCHOLAR_ID = "FIX/Lantern Scholar@0#0";
const KENSEI_ID = "XGE/Monk/Way of the Kensei/Path of the Kensei@3#0";

const lampwright: SubclassData = {
  name: "Lampwright",
  shortName: "Lampwright",
  source: "PHB",
  className: "Warden",
  classSource: "PHB",
  description: "Placeholder description for the Lampwright.",
  features: [
    {
      name: "Lamp Craft",
      level: 3,
      description: "Placeholder description for Lamp Craft.",
      grants: [
        {
          id: LAMP_ID,
          kind: "choice",
          category: "tools",
          count: 1,
          pool: { kind: "names", names: ["lantern kit", "signal mirror"] },
        },
      ],
    },
    {
      name: "Lamp Tongue",
      level: 3,
      description: "Placeholder description for Lamp Tongue.",
      grants: [anyLanguageChoice(LAMP_TONGUE_ID, 1)],
    },
  ],
};

const lampCompendium = () => inMemoryCompendium({ classes: [wardenClass({ subclasses: [lampwright] })] });

const lampWarden = (level: number, extra: Partial<Character> = {}) =>
  makeChar({
    classes: [{ className: "Warden", source: "PHB", level, subclassName: "Lampwright", subclassSource: "PHB" }],
    ...extra,
  });

const offerFor = (character: Character, id: string, compendium = lampCompendium()) =>
  proficiencyChoiceOffers(character, { compendium }).find((offer) => offer.id === id);

test("a names-pool tool choice held by a subclass feature is offered with its pool, minus what is already held", () => {
  const offer = offerFor(lampWarden(3, { chosenTools: { background: ["Signal Mirror"] } }), LAMP_ID);
  assert.ok(offer, "the choice is offered at the feature's level");
  assert.equal(offer.pick, "proficiency");
  assert.equal(offer.choose, 1);
  assert.equal(offer.origin, "subclass");
  assert.deepEqual(
    offer.options.map((option) => option.name),
    ["Lantern Kit"],
    "the pool names Signal Mirror, which the background already gives, so it is hidden",
  );
});

test("a pick the character already has from the pool stays selectable in its own offer", () => {
  const offer = offerFor(
    lampWarden(3, { chosenTools: { background: ["Signal Mirror"] }, proficiencyPicks: { [LAMP_ID]: ["Signal Mirror"] } }),
    LAMP_ID,
  );
  assert.deepEqual(offer?.options.map((option) => option.name), ["Lantern Kit", "Signal Mirror"]);
});

test("the offer is absent below the feature's level and when its book is not active", () => {
  assert.equal(offerFor(lampWarden(2), LAMP_ID), undefined, "level 2 has no Lamp Craft yet");
  const compendium = lampCompendium();
  const inactive = proficiencyChoiceOffers(lampWarden(3), { compendium, activeBooks: ["XGE"] });
  assert.equal(inactive.find((offer) => offer.id === LAMP_ID), undefined, "the Lampwright is printed in PHB");
});

test("a saved pick reaches the sheet as rule-granted, and a name outside the pool does not", () => {
  const compendium = lampCompendium();
  const sheet = proficiencySheet(lampWarden(3, { proficiencyPicks: { [LAMP_ID]: ["Signal Mirror"] } }), { compendium });
  assert.deepEqual(sheet.tools, [{ name: "Signal Mirror", ruleGranted: true }]);

  const outside = proficiencySheet(lampWarden(3, { proficiencyPicks: { [LAMP_ID]: ["Dragon Dice"] } }), { compendium });
  assert.deepEqual(outside.tools, [], "a name the pool does not offer is not on the sheet");
});

test("a pick for a feature the character does not hold adds nothing to the sheet", () => {
  const sheet = proficiencySheet(lampWarden(2, { proficiencyPicks: { [LAMP_ID]: ["Signal Mirror"] } }), {
    compendium: lampCompendium(),
  });
  assert.deepEqual(sheet.tools, []);
});

test("an any-pool language pick is accepted only for a known language", () => {
  const compendium = lampCompendium();
  const accepted = proficiencySheet(lampWarden(3, { proficiencyPicks: { [LAMP_TONGUE_ID]: ["elvish"] } }), { compendium });
  assert.deepEqual(names(accepted.languages), ["Common", "Elvish"], "a known language is matched to its own spelling");

  const rejected = proficiencySheet(lampWarden(3, { proficiencyPicks: { [LAMP_TONGUE_ID]: ["Zorvish"] } }), { compendium });
  assert.deepEqual(names(rejected.languages), ["Common"], "an unknown language is not accepted; Common stays");
});

test("picking records under the grant id, toggles off, replaces at a count of one, and leaves the old buckets alone", () => {
  const compendium = lampCompendium();
  const before = lampWarden(3, {
    chosenTools: { background: ["Signal Mirror"] },
    chosenLanguages: { background: ["Elvish"] },
  });
  const offer = offerFor(before, LAMP_ID, compendium);
  assert.ok(offer);

  const picked = pickRuleChoice(before, offer, "Lantern Kit", compendium);
  assert.deepEqual(picked.proficiencyPicks, { [LAMP_ID]: ["Lantern Kit"] });
  assert.deepEqual(picked.chosenTools, before.chosenTools, "the old tool bucket is never rewritten");
  assert.deepEqual(picked.chosenLanguages, before.chosenLanguages, "the old language bucket is never rewritten");
  assert.deepEqual(picked.ruleChoices ?? [], [], "no ruleChoices entry is written for a proficiency pick");

  const replaced = pickRuleChoice(picked, offer, "Signal Mirror", compendium);
  assert.deepEqual(replaced.proficiencyPicks, { [LAMP_ID]: ["Signal Mirror"] });

  const cleared = pickRuleChoice(replaced, offer, "Signal Mirror", compendium);
  assert.equal(cleared.proficiencyPicks?.[LAMP_ID], undefined, "picking the same name again deselects it");
});

test("a feat's language choice is offered from the feat and picked onto the sheet", () => {
  const compendium = inMemoryCompendium({
    feats: [
      placeholderFeat({
        name: "Lantern Scholar",
        grants: [anyLanguageChoice(SCHOLAR_ID, 1)],
      }),
    ],
  });
  const scholar = makeChar({ asiSelections: [{ level: 4, type: "feat", featName: "Lantern Scholar", featSource: "PHB" }] });
  const offer = proficiencyChoiceOffers(scholar, { compendium }).find((o) => o.id === SCHOLAR_ID);
  assert.equal(offer?.origin, "feat");

  const picked = pickRuleChoice(scholar, offer!, "Elvish", compendium);
  assert.deepEqual(names(proficiencySheet(picked, { compendium }).languages), ["Common", "Elvish"]);
});

// Kensei brush, end to end against the integrated test compendium.

const monk3 = (extra: Partial<Character> = {}) =>
  makeChar({
    classes: [{ className: "Monk", source: "PHB", level: 3, subclassName: "Way of the Kensei", subclassSource: "XGE" }],
    ...extra,
  });

test("a Way of the Kensei monk is offered calligrapher's or painter's supplies at 3rd level", () => {
  const compendium = integratedTestCompendium();
  const offer = proficiencyChoiceOffers(monk3(), { compendium }).find((o) => o.id === KENSEI_ID);
  assert.ok(offer, "the Path of the Kensei choice is offered");
  assert.equal(offer.choose, 1);
  assert.equal(offer.traitName, "Path of the Kensei: Tool");
  assert.deepEqual(offer.options.map((option) => option.name), ["Calligrapher's Supplies", "Painter's Supplies"]);
});

test("the three Kensei choices at 3rd level get three distinct picker titles", () => {
  const compendium = integratedTestCompendium();
  const titles = proficiencyChoiceOffers(monk3(), { compendium })
    .filter((o) => o.id.startsWith("XGE/Monk/Way of the Kensei/Path of the Kensei@3"))
    .map((o) => o.traitName);
  assert.deepEqual(titles, ["Path of the Kensei: Tool", "Path of the Kensei: Melee weapon", "Path of the Kensei: Ranged weapon"]);
});

test("a feature with a single choice keeps its plain name", () => {
  assert.equal(offerFor(lampWarden(3), LAMP_ID)?.traitName, "Lamp Craft");
  assert.equal(offerFor(lampWarden(3), LAMP_TONGUE_ID)?.traitName, "Lamp Tongue");
});

test("picker titles name each grant's category, and number grants that still share one", () => {
  const tool: ChoiceProficiencyGrant = { id: "t", kind: "choice", category: "tools", count: 1, pool: { kind: "any" } };
  const language: ChoiceProficiencyGrant = { id: "l", kind: "choice", category: "languages", count: 1, pool: { kind: "any" } };
  const skill: ChoiceProficiencyGrant = { id: "s", kind: "choice", category: "skills", count: 2, pool: { kind: "any" } };
  const save: ChoiceProficiencyGrant = { id: "v", kind: "choice", category: "savingThrows", count: 1, pool: { kind: "any" } };
  const weapon: ChoiceProficiencyGrant = {
    id: "w",
    kind: "choice",
    category: "weapons",
    count: 1,
    pool: { kind: "weapons", base: ["simple"], withoutProperties: [], plus: [] },
  };
  assert.deepEqual(pickerTitles("Blessings of Knowledge", [language, skill]), [
    "Blessings of Knowledge: Language",
    "Blessings of Knowledge: Skill",
  ]);
  assert.deepEqual(pickerTitles("Kit", [tool, language, tool]), ["Kit: Tool 1", "Kit: Language", "Kit: Tool 2"]);
  assert.deepEqual(pickerTitles("Oath", [save, weapon]), ["Oath: Saving throw", "Oath: Weapon"]);
});

test("the Kensei brush pick shows on the sheet, and a monk below 3rd level is offered nothing", () => {
  const compendium = integratedTestCompendium();
  const character = monk3();
  const offer = proficiencyChoiceOffers(character, { compendium }).find((o) => o.id === KENSEI_ID);
  const picked = pickRuleChoice(character, offer!, "Painter's Supplies", compendium);
  assert.ok(names(proficiencySheet(picked, { compendium }).tools).includes("Painter's Supplies"));

  const monk2 = makeChar({
    classes: [{ className: "Monk", source: "PHB", level: 2, subclassName: "Way of the Kensei", subclassSource: "XGE" }],
  });
  assert.equal(proficiencyChoiceOffers(monk2, { compendium }).find((o) => o.id === KENSEI_ID), undefined);
});

test("the Kensei choice is offered only while the Xanathar's book is active", () => {
  const compendium = integratedTestCompendium();
  const offers = proficiencyChoiceOffers(monk3(), { compendium, activeBooks: ["PHB"] });
  assert.equal(offers.find((o) => o.id === KENSEI_ID), undefined);
});

test("with no catalog that holds the Kensei, the pick is kept and takes effect when the catalog returns", () => {
  const picked = monk3({ proficiencyPicks: { [KENSEI_ID]: ["Calligrapher's Supplies"] } });
  const withoutCatalog = reconcile(picked, srdBaselineCompendium());
  assert.deepEqual(withoutCatalog.proficiencyPicks, picked.proficiencyPicks);
  assert.deepEqual(withoutCatalog.needsReview ?? [], []);

  const back = proficiencySheet(withoutCatalog, { compendium: integratedTestCompendium() });
  assert.ok(names(back.tools).includes("Calligrapher's Supplies"));
});

// Reconciler: release with a notice, and leave a valid character unchanged.

test("changing the subclass releases the Kensei pick through reconcile() with a notice", () => {
  const compendium = integratedTestCompendium();
  const picked = monk3({ proficiencyPicks: { [KENSEI_ID]: ["Calligrapher's Supplies"] } });
  const changed: Character = {
    ...picked,
    classes: [{ ...picked.classes[0], subclassName: "Way of the Four Elements", subclassSource: "PHB" }],
  };
  const out = reconcile(changed, compendium);
  assert.equal(out.proficiencyPicks?.[KENSEI_ID], undefined);
  assert.ok(
    out.needsReview?.some((note) => note.includes("Calligrapher's Supplies")),
    "the release is recorded in needsReview",
  );
});

test("reconciling a valid character with a proficiency pick returns it unchanged", () => {
  const compendium = integratedTestCompendium();
  const picked = monk3({ proficiencyPicks: { [KENSEI_ID]: ["Calligrapher's Supplies"] } });
  const once = reconcile(picked, compendium);
  assert.deepEqual(once.proficiencyPicks, picked.proficiencyPicks, "the pick is kept as saved");
  assert.deepEqual(once.needsReview ?? [], [], "no notice is added");
  assert.deepEqual(reconcile(once, compendium), once, "idempotent");
});

test("removing the feat that grants a language choice releases its pick with a notice", () => {
  const compendium = inMemoryCompendium({
    feats: [placeholderFeat({ name: "Lantern Scholar", grants: [anyLanguageChoice(SCHOLAR_ID, 1)] })],
  });
  const scholar = makeChar({
    asiSelections: [{ level: 4, type: "feat", featName: "Lantern Scholar", featSource: "PHB" }],
    proficiencyPicks: { [SCHOLAR_ID]: ["Elvish"] },
  });
  assert.deepEqual(reconcile(scholar, compendium).proficiencyPicks, { [SCHOLAR_ID]: ["Elvish"] }, "held feat keeps its pick");

  const dropped: Character = { ...scholar, asiSelections: [] };
  const out = reconcile(dropped, compendium);
  assert.equal(out.proficiencyPicks?.[SCHOLAR_ID], undefined);
  assert.ok(out.needsReview?.some((note) => note.includes("Elvish")));
});
