import test from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import type { SubclassData } from "../src/types/dnd5e.ts";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { getAvailableExpertiseMilestones } from "../src/rules/expertise.ts";
import { inMemoryCompendium, integratedTestCompendium, loadTestCatalog, makeChar } from "./testUtils.ts";
import { fixedGrant, placeholderFeat, wardenClass } from "./proficiencySheetFixture.ts";

/**
 * Skill proficiencies on the Proficiency Sheet (ticket 11). Invented fixtures (Lampwright, Lantern
 * Scholar) carry the grants; the Drunken Master, Scout and Prodigy tests run against the integrated
 * test Compendium. Skills are read from the sheet, and a skill pick is keyed by its grant id.
 */

const names = (entries: SheetEntry[]) => entries.map((entry) => entry.name);

const LORE_ID = "FIX/Warden/Lampwright/Lamp Lore@3#0";
const STUDY_ID = "FIX/Warden/Lampwright/Lamp Study@3#0";
const SCHOLAR_FIXED_ID = "FIX/Lantern Scholar@0#0";
const SCHOLAR_CHOICE_ID = "FIX/Lantern Scholar@0#1";

const lampwright: SubclassData = {
  name: "Lampwright",
  shortName: "Lampwright",
  source: "PHB",
  className: "Warden",
  classSource: "PHB",
  description: "Placeholder description for the Lampwright.",
  features: [
    {
      name: "Lamp Lore",
      level: 3,
      description: "Placeholder description for Lamp Lore.",
      grants: [fixedGrant(LORE_ID, "skills", ["Arcana"])],
    },
    {
      name: "Lamp Study",
      level: 3,
      description: "Placeholder description for Lamp Study.",
      grants: [
        {
          id: STUDY_ID,
          kind: "choice",
          category: "skills",
          count: 1,
          pool: { kind: "names", names: ["Nature", "Survival"] },
        },
      ],
    },
  ],
};

const scholarFeat = placeholderFeat({
  name: "Lantern Scholar",
  grants: [
    fixedGrant(SCHOLAR_FIXED_ID, "skills", ["History"]),
    { id: SCHOLAR_CHOICE_ID, kind: "choice", category: "skills", count: 1, pool: { kind: "any" } },
  ],
});

const lampCompendium = () =>
  inMemoryCompendium({ classes: [wardenClass({ subclasses: [lampwright] })], feats: [scholarFeat] });

const lampWarden = (level: number, extra: Partial<Character> = {}) =>
  makeChar({
    classes: [{ className: "Warden", source: "PHB", level, subclassName: "Lampwright", subclassSource: "PHB" }],
    ...extra,
  });

const skillsOf = (character: Character, compendium = lampCompendium()) =>
  names(proficiencySheet(character, { compendium }).skills);

test("a subclass fixed skill grant is on the sheet from its level, and goes with the subclass", () => {
  assert.equal(skillsOf(lampWarden(2)).includes("Arcana"), false, "Lamp Lore is gained at 3rd level");
  assert.equal(skillsOf(lampWarden(3)).includes("Arcana"), true);
  const unsubclassed = makeChar({ classes: [{ className: "Warden", source: "PHB", level: 3 }] });
  assert.equal(skillsOf(unsubclassed).includes("Arcana"), false, "the grant goes with its subclass");
});

test("a feat's fixed skill grant is on the sheet while the feat is held", () => {
  const withFeat = lampWarden(4, { asiSelections: [{ level: 4, type: "feat", featName: "Lantern Scholar" }] });
  assert.equal(skillsOf(withFeat).includes("History"), true);
  assert.equal(skillsOf(lampWarden(4)).includes("History"), false, "the grant goes with the feat");
});

test("a skill the character already holds from another source is kept once", () => {
  const character = lampWarden(3, { chosenSkills: ["Arcana"] });
  const arcana = skillsOf(character).filter((name) => name === "Arcana");
  assert.equal(arcana.length, 1);
});

test("a skill choice grant is on the sheet once picked, and a name outside its pool does not count", () => {
  const picked = lampWarden(3, { proficiencyPicks: { [STUDY_ID]: ["Nature"] } });
  assert.equal(skillsOf(picked).includes("Nature"), true);
  const outside = lampWarden(3, { proficiencyPicks: { [STUDY_ID]: ["Stealth"] } });
  assert.equal(skillsOf(outside).includes("Stealth"), false);
  assert.equal(skillsOf(lampWarden(3)).includes("Nature"), false, "an unmade pick grants nothing");
});

test("a skill choice grant is offered as a proficiency choice, with held skills hidden from its pool", () => {
  const compendium = lampCompendium();
  const offer = proficiencyChoiceOffers(lampWarden(3, { chosenSkills: ["Survival"] }), { compendium }).find(
    (o) => o.id === STUDY_ID,
  );
  assert.ok(offer, "the choice is offered at the feature's level");
  assert.equal(offer.pick, "proficiency");
  assert.equal(offer.choose, 1);
  assert.deepEqual(offer.options.map((option) => option.name), ["Nature"], "Survival is already held, so it is hidden");
});

test("the skills the buckets hold, Primal Knowledge picks and Knowledge Domain Expertise are still on the sheet", () => {
  const compendium = lampCompendium();
  const primal = makeChar({
    classes: [{ className: "Barbarian", source: "PHB", level: 3 }],
    ruleChoices: [
      { id: "TCE__Barbarian__Primal Knowledge 3", trait: "Primal Knowledge (3rd Level)", origin: "class", choose: 1, from: [], picked: ["Survival"] },
    ],
  });
  assert.equal(names(proficiencySheet(primal, { compendium }).skills).includes("Survival"), true);

  const bucket = makeChar({ chosenSkills: ["Stealth"] });
  assert.equal(names(proficiencySheet(bucket, { compendium }).skills).includes("Stealth"), true);

  const knowledge = makeChar({
    classes: [{ className: "Cleric", source: "PHB", level: 1, subclassName: "Knowledge Domain", subclassSource: "PHB" }],
    chosenExpertise: ["Arcana"],
  });
  assert.equal(names(proficiencySheet(knowledge, { compendium }).skills).includes("Arcana"), true);
});

test("the Drunken Master's Performance is on the sheet from 3rd level in the integrated Compendium", () => {
  const compendium = integratedTestCompendium();
  const monk = (level: number) =>
    makeChar({ classes: [{ className: "Monk", source: "PHB", level, subclassName: "Way of the Drunken Master", subclassSource: "XGE" }] });
  assert.equal(names(proficiencySheet(monk(2), { compendium }).skills).includes("Performance"), false);
  assert.equal(names(proficiencySheet(monk(3), { compendium }).skills).includes("Performance"), true);
});

test("a skill granted by a Scout's Survivalist is an Expertise option for a Rogue", () => {
  const compendium = integratedTestCompendium();
  const scout = makeChar({
    classes: [
      { className: "Rogue", source: "PHB", level: 3, subclassName: "Scout", subclassSource: "XGE" },
    ],
  });
  const rogue = getAvailableExpertiseMilestones(scout, { compendium }).find((m) => m.id === "rogue_1");
  assert.ok(rogue?.options.includes("Nature"), "Survivalist gives Nature, so Nature is eligible");
  assert.ok(rogue?.options.includes("Survival"), "Survivalist gives Survival, so Survival is eligible");
});

test("the card's skill proficiencies are the sheet's, so the evaluated skill rows agree with the sheet", () => {
  const compendium = integratedTestCompendium();
  const character = makeChar({
    classes: [{ className: "Monk", source: "PHB", level: 3, subclassName: "Way of the Drunken Master", subclassSource: "XGE" }],
    chosenSkills: ["Stealth"],
  });
  const evaluated = evaluateCharacter(character, { compendium });
  const proficient = evaluated.skills.filter((s) => s.isProficient).map((s) => s.name).sort();
  assert.deepEqual(proficient, [...names(proficiencySheet(character, { compendium }).skills)].sort());
  assert.ok(proficient.includes("Performance"));
});

test("an Expertise pick on a skill a Prodigy pick gave is released with a notice when the pick goes, and is not re-marked", () => {
  const compendium = integratedTestCompendium();
  const PRODIGY_ID = "XGE/Feat/Prodigy@0#0";
  const rogue = (extra: Partial<Character>) =>
    makeChar({
      classes: [{ className: "Rogue", source: "PHB", level: 1, subclassName: "Thief", subclassSource: "PHB" }],
      chosenExpertise: ["Nature"],
      ...extra,
    });
  const held = rogue({
    asiSelections: [{ level: 4, type: "feat", featName: "Prodigy", featSource: "XGE" }],
    proficiencyPicks: { [PRODIGY_ID]: ["Nature"] },
  });
  assert.deepEqual(reconcile(held, compendium).chosenExpertise, ["Nature"], "a valid pick is kept");

  const released = reconcile(rogue({ proficiencyPicks: { [PRODIGY_ID]: ["Nature"] } }), compendium);
  assert.deepEqual(released.chosenExpertise, [], "the Prodigy feat is not held, so the pick and its Expertise go");
  assert.ok(released.needsReview?.some((note) => note.includes("Nature") && note.includes("Expertise removed")));

  const back = reconcile(
    { ...released, asiSelections: [{ level: 4, type: "feat", featName: "Prodigy", featSource: "XGE" }], proficiencyPicks: { [PRODIGY_ID]: ["Nature"] } },
    compendium,
  );
  assert.deepEqual(back.chosenExpertise, [], "nothing re-marks Expertise when the proficiency returns");
});

/**
 * The scraped class catalog, unchanged. The integrated test Compendium swaps in a fixture Totem Warrior
 * with no grants, so the Totem tests read the real one.
 */
const totemCompendium = () => inMemoryCompendium({ classes: loadTestCatalog("classes") }, { integrated: true });
const TIGER_ID = "PHB/Barbarian/Path of the Totem Warrior/Tiger@6#0";
const ASPECT_6 = "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6";

const totemAt6 = (aspect: string[] | undefined, extra: Partial<Character> = {}) =>
  makeChar({
    classes: [{ className: "Barbarian", source: "PHB", level: 6, subclassName: "Path of the Totem Warrior", subclassSource: "PHB" }],
    ruleChoices: aspect
      ? [{ id: ASPECT_6, trait: "Aspect of the Beast (6th Level)", origin: "subclass", choose: 1, from: [], picked: aspect }]
      : [],
    ...extra,
  });

test("the Tiger aspect's skills at 6th level are granted only while the Aspect of the Beast pick is Tiger", () => {
  const compendium = totemCompendium();
  const bear = totemAt6(["Bear"], { proficiencyPicks: { [TIGER_ID]: ["Stealth", "Survival"] } });
  assert.deepEqual(names(proficiencySheet(bear, { compendium }).skills), [], "the Bear aspect grants no skills");
  assert.equal(proficiencyChoiceOffers(bear, { compendium }).some((offer) => offer.id === TIGER_ID), false);

  const tiger = totemAt6(["Tiger"], { proficiencyPicks: { [TIGER_ID]: ["Stealth", "Survival"] } });
  assert.deepEqual(names(proficiencySheet(tiger, { compendium }).skills).sort(), ["Stealth", "Survival"]);
  assert.equal(proficiencyChoiceOffers(totemAt6(["Tiger"]), { compendium }).some((offer) => offer.id === TIGER_ID), true);
});

test("a Tiger pick is released with a notice when the aspect changes away from Tiger", () => {
  const compendium = totemCompendium();
  const tiger = totemAt6(["Tiger"], { proficiencyPicks: { [TIGER_ID]: ["Stealth", "Survival"] } });
  const changed = reconcile({ ...tiger, ruleChoices: [{ ...tiger.ruleChoices![0], picked: ["Bear"] }] }, compendium);
  assert.equal(changed.proficiencyPicks?.[TIGER_ID], undefined, "the Tiger skills are no longer granted, so the pick goes");
  assert.ok(changed.needsReview?.some((note) => note.includes("Stealth") && note.includes("no longer granted")));
});
