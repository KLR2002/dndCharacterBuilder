import test from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import type { SubclassData } from "../src/types/dnd5e.ts";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { skills } from "../src/rules/skills.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { getAvailableExpertiseMilestones } from "../src/rules/expertise.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { moveExpertisePicksToGrants } from "../src/rules/proficiencyPicks.ts";
import { inMemoryCompendium, integratedTestCompendium, makeChar } from "./testUtils.ts";
import { fixedGrant, wardenClass } from "./proficiencySheetFixture.ts";

/**
 * Expertise from a skill grant. Every name and sentence is invented, except the real skill and class names the
 * integrated test Compendium already uses. Beacon Sight's choice and Beacon Lamp's fixed grant are marked expertise;
 * Beacon Charter's choice is not, so it is the control.
 */

const SIGHT_ID = "FIX/Warden/Beacon Keeper/Beacon Sight@3#skills:choice:from";
const LAMP_ID = "FIX/Warden/Beacon Keeper/Beacon Lamp@5#skills:fixed:Perception";
const CHARTER_ID = "FIX/Warden/Beacon Keeper/Beacon Charter@7#skills:choice:from";

const beaconKeeper: SubclassData = {
  name: "Beacon Keeper",
  shortName: "Beacon Keeper",
  source: "PHB",
  className: "Warden",
  classSource: "PHB",
  description: "Placeholder description for the Beacon Keeper.",
  features: [
    {
      name: "Beacon Sight",
      level: 3,
      description: "Placeholder description for Beacon Sight.",
      grants: [
        {
          id: SIGHT_ID,
          kind: "choice",
          category: "skills",
          count: 2,
          pool: { kind: "names", names: ["Nature", "Survival", "Insight"] },
          expertise: true,
        },
      ],
    },
    {
      name: "Beacon Lamp",
      level: 5,
      description: "Placeholder description for Beacon Lamp.",
      grants: [{ ...fixedGrant(LAMP_ID, "skills", ["Perception"]), expertise: true }],
    },
    {
      name: "Beacon Charter",
      level: 7,
      description: "Placeholder description for Beacon Charter.",
      grants: [{ id: CHARTER_ID, kind: "choice", category: "skills", count: 1, pool: { kind: "names", names: ["Stealth", "Athletics"] } }],
    },
  ],
};

const beaconCompendium = () => inMemoryCompendium({ classes: [wardenClass({ subclasses: [beaconKeeper] })] });

const beaconWarden = (level: number, extra: Partial<Character> = {}, subclass = true) =>
  makeChar({
    classes: [
      subclass
        ? { className: "Warden", source: "PHB", level, subclassName: "Beacon Keeper", subclassSource: "PHB" }
        : { className: "Warden", source: "PHB", level },
    ],
    ...extra,
  });

const sheetSkills = (character: Character, compendium = beaconCompendium()): SheetEntry[] =>
  proficiencySheet(character, { compendium }).skills;
const names = (entries: SheetEntry[]) => entries.map((entry) => entry.name).sort();
const expertiseNames = (entries: SheetEntry[]) => names(entries.filter((entry) => entry.expertise));

test("a choice of skills marked expertise gives Expertise on the two picked, and proficiency on no other skill", () => {
  const character = beaconWarden(3, { proficiencyPicks: { [SIGHT_ID]: ["Nature", "Insight"] } });
  assert.deepEqual(names(sheetSkills(character)), ["Insight", "Nature"]);
  assert.deepEqual(expertiseNames(sheetSkills(character)), ["Insight", "Nature"]);
});

test("a fixed skill grant marked expertise gives Expertise on its skills", () => {
  const character = beaconWarden(5);
  assert.deepEqual(names(sheetSkills(character)), ["Perception"]);
  assert.deepEqual(expertiseNames(sheetSkills(character)), ["Perception"]);
});

test("an unmarked skill grant gives proficiency and no Expertise", () => {
  const character = beaconWarden(7, { proficiencyPicks: { [CHARTER_ID]: ["Stealth"] } });
  assert.deepEqual(names(sheetSkills(character)), ["Perception", "Stealth"]);
  assert.deepEqual(expertiseNames(sheetSkills(character)), ["Perception"], "only the marked fixed grant carries Expertise");
});

test("removing the subclass removes its skills and their Expertise", () => {
  const withSubclass = beaconWarden(7, {
    proficiencyPicks: { [SIGHT_ID]: ["Nature", "Insight"], [CHARTER_ID]: ["Stealth"] },
  });
  assert.deepEqual(expertiseNames(sheetSkills(withSubclass)), ["Insight", "Nature", "Perception"]);

  const without = beaconWarden(7, { proficiencyPicks: { [SIGHT_ID]: ["Nature", "Insight"], [CHARTER_ID]: ["Stealth"] } }, false);
  assert.deepEqual(names(sheetSkills(without)), []);
  assert.deepEqual(expertiseNames(sheetSkills(without)), []);
});

test("a skill held from two sources keeps Expertise if either grant marks it", () => {
  const character = beaconWarden(5, { chosenSkills: ["Perception"] });
  const entries = sheetSkills(character);
  assert.deepEqual(names(entries), ["Perception"], "one entry for a skill held twice");
  assert.deepEqual(expertiseNames(entries), ["Perception"]);

  const unmarked = beaconWarden(7, { chosenSkills: ["Stealth"], proficiencyPicks: { [CHARTER_ID]: ["Stealth"] } });
  const stealth = sheetSkills(unmarked).find((entry) => entry.name === "Stealth");
  assert.ok(stealth, "Stealth is held from two sources");
  assert.equal(stealth.expertise, undefined, "no grant marks Stealth, so it has no Expertise");
});

test("the skill rows and the evaluated card agree with the sheet on Expertise", () => {
  const character = beaconWarden(3, { proficiencyPicks: { [SIGHT_ID]: ["Nature", "Insight"] } });
  const compendium = beaconCompendium();
  const rows = skills(character, sheetSkills(character, compendium));
  assert.deepEqual(rows.filter((row) => row.isExpertise).map((row) => row.name).sort(), ["Insight", "Nature"]);
  assert.deepEqual(rows.filter((row) => row.isProficient).map((row) => row.name).sort(), ["Insight", "Nature"]);

  const card = evaluateCharacter(character, { compendium }).skills;
  assert.deepEqual(card.filter((row) => row.isExpertise).map((row) => row.name).sort(), ["Insight", "Nature"]);
});

test("a Knowledge Domain Cleric has no Expertise milestone, and its Blessings picks carry Expertise", () => {
  const compendium = integratedTestCompendium();
  const BLESSINGS_ID = "PHB/Cleric/Knowledge Domain/Blessings of Knowledge@1#skills:choice:from";
  const cleric = makeChar({
    classes: [{ className: "Cleric", source: "PHB", level: 1, subclassName: "Knowledge Domain", subclassSource: "PHB" }],
    proficiencyPicks: { [BLESSINGS_ID]: ["Arcana", "History"] },
  });
  assert.equal(
    getAvailableExpertiseMilestones(cleric, { compendium }).some((m) => m.id === "cleric_knowledge_1"),
    false,
    "the hand-written milestone is gone",
  );
  const entries = proficiencySheet(cleric, { compendium }).skills;
  assert.deepEqual(names(entries), ["Arcana", "History"]);
  assert.deepEqual(expertiseNames(entries), ["Arcana", "History"]);
});

test("Expertise on a skill the character holds from no grant is not proficiency", () => {
  const character = beaconWarden(3, { chosenExpertise: ["Nature"] });
  assert.deepEqual(names(sheetSkills(character)), []);
});

test("an old Knowledge Cleric save keeps its skills and Expertise: the Expertise on Knowledge skills moves into the free Blessings picks", () => {
  const compendium = integratedTestCompendium();
  const old = makeChar({
    classes: [{ className: "Cleric", source: "PHB", level: 1, subclassName: "Knowledge Domain", subclassSource: "PHB" }],
    chosenExpertise: ["Arcana", "History"],
  });
  const migrated = reconcile(old, compendium);
  assert.deepEqual(migrated.chosenExpertise, []);
  const entries = proficiencySheet(migrated, { compendium }).skills;
  assert.deepEqual(names(entries), ["Arcana", "History"]);
  assert.deepEqual(expertiseNames(entries), ["Arcana", "History"]);
});

test("the Expertise moved into a grant's picks: a name the free slots cannot take is released with a notice", () => {
  const old = beaconWarden(3, {
    proficiencyPicks: { [SIGHT_ID]: ["Survival", "Insight"] },
    chosenExpertise: ["Nature"],
  });
  const migrated = reconcile(old, beaconCompendium());
  assert.deepEqual(migrated.chosenExpertise, [], "the Expertise pass drops the pick that has no slot");
  assert.deepEqual(names(sheetSkills(migrated)), ["Insight", "Survival"], "no free slot, so Nature is not held");
  assert.ok(migrated.needsReview?.some((note) => note.includes("Nature")), "the release is reported");
});

test("an Expertise name moves into the grant only when the grant is held at its level", () => {
  const notYet = beaconWarden(2, { chosenExpertise: ["Nature"] });
  const migrated = moveExpertisePicksToGrants(notYet, beaconCompendium());
  assert.equal(migrated, notYet, "Beacon Sight is gained at 3rd level, so nothing moves");
});

test("a character with no Expertise picks is returned unchanged", () => {
  const character = beaconWarden(3, { proficiencyPicks: { [SIGHT_ID]: ["Nature", "Insight"] } });
  assert.equal(moveExpertisePicksToGrants(character, beaconCompendium()), character);
});

test("Rogue, Bard and feat milestones do not offer a skill whose Expertise a grant gives", () => {
  const character = makeChar({
    classes: [
      { className: "Warden", source: "PHB", level: 5, subclassName: "Beacon Keeper", subclassSource: "PHB" },
      { className: "Rogue", source: "PHB", level: 6 },
      { className: "Bard", source: "PHB", level: 10 },
    ],
    asiSelections: [{ level: 4, type: "feat", featName: "Skill Expert", featSource: "PHB" }],
    chosenSkills: ["Survival"],
    proficiencyPicks: { [SIGHT_ID]: ["Nature", "Insight"] },
  });
  const milestones = getAvailableExpertiseMilestones(character, { compendium: beaconCompendium() });
  assert.deepEqual(milestones.map((m) => m.id), ["rogue_1", "rogue_6", "bard_3", "bard_10", "feat_skill_expert"]);
  for (const milestone of milestones) {
    assert.deepEqual(milestone.options, ["Survival"], `${milestone.id} offers only the skill with no Expertise from a grant`);
  }
});

test("a saved Expertise pick on a skill a grant already gives Expertise is released, with a notice that names that reason", () => {
  const character = makeChar({
    classes: [
      { className: "Warden", source: "PHB", level: 5, subclassName: "Beacon Keeper", subclassSource: "PHB" },
      { className: "Rogue", source: "PHB", level: 1 },
    ],
    chosenExpertise: ["Perception"],
  });
  const migrated = reconcile(character, beaconCompendium());
  assert.deepEqual(migrated.chosenExpertise, [], "the fixed grant already gives Perception Expertise, so the pick is released");
  const notices = migrated.needsReview ?? [];
  assert.ok(notices.includes("Perception Expertise removed: Perception already has Expertise from a grant"), notices.join("; "));
  assert.ok(!notices.some((note) => note.includes("no longer a proficient")), "Perception is still proficient");
});

test("a Rogue Expertise pick on a skill in a marked choice's pool stays in the Rogue milestone while the choice has a free slot", () => {
  const compendium = beaconCompendium();
  const character = makeChar({
    classes: [
      { className: "Warden", source: "PHB", level: 3, subclassName: "Beacon Keeper", subclassSource: "PHB" },
      { className: "Rogue", source: "PHB", level: 1 },
    ],
    chosenSkills: ["Nature"],
    chosenExpertise: ["Nature"],
    proficiencyPicks: { [SIGHT_ID]: ["Insight"] },
  });
  assert.equal(moveExpertisePicksToGrants(character, compendium), character, "the Rogue milestone holds Nature, so nothing moves");
  const migrated = reconcile(character, compendium);
  assert.deepEqual(migrated.chosenExpertise, ["Nature"]);
  assert.deepEqual(migrated.proficiencyPicks, { [SIGHT_ID]: ["Insight"] }, "Blessings keeps its one pick and its free slot");
  const rows = skills(migrated, sheetSkills(migrated, compendium));
  assert.deepEqual(rows.filter((row) => row.isExpertise).map((row) => row.name).sort(), ["Insight", "Nature"]);
});

test("an old Expertise pick on a skill in a marked choice's pool moves into the free slot when no milestone holds it", () => {
  const migrated = reconcile(beaconWarden(3, { chosenExpertise: ["Nature"] }), beaconCompendium());
  assert.deepEqual(migrated.chosenExpertise, []);
  assert.deepEqual(migrated.proficiencyPicks, { [SIGHT_ID]: ["Nature"] });
});
