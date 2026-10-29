import { ORIGIN_CUSTOMIZATION_BOOK } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, inMemoryCompendium } from "./testUtils.ts";
import { applyAncestrySelection } from "../src/rules/ancestryEngine.ts";
import { changeRace, resetOriginSwaps, setProficiencySwap } from "../src/rules/builderTransitions.ts";
import { reconcile, reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { proficiencySheet, proficiencySwapViews } from "../src/rules/proficiencySheet.ts";
import type { Character } from "../src/types/character.ts";
import type { BackgroundData, ItemData, OriginRuleRecord, ProficiencyGrant, RaceData } from "../src/types/dnd5e.ts";
import type { FeatureInstance } from "../src/rules/types.ts";
import { proficiencySwapSlots, withProficiencySwaps } from "../src/rules/proficiencySources/proficiencySwaps.ts";
import { recordProficiencyPick } from "../src/rules/proficiencyPools.ts";
import { swapId } from "../src/rules/proficiencySources/swapIds.ts";

// Proficiency swaps: a Race or Subrace fixed skill, tool, weapon or armor grant, or the pick of a narrower choice, is replaced
// by what the swap table allows for its kind. Every race, background, item and grant name here is invented.

const SOURCE = "TST";
const ACTIVE = [SOURCE, ORIGIN_CUSTOMIZATION_BOOK];
const WITHOUT_TCE = [SOURCE];

const SCOUT = "Sample Scout";
const BRAWLER = "Sample Brawler";
const DUELIST = "Sample Duelist";
const TINKER = "Sample Tinker";
const PLATED = "Sample Plated";
const ARTISAN = "Sample Artisan";
const WANDERER = "Sample Wanderer";
const BLADE = "Sample Blade";
const SAGE = "Sample Sage";
const FORGE = "Sample Forge";

const ALL_SIX: Record<string, number>[] = [{ str: 1 }, { dex: 1 }, { con: 1 }, { int: 1 }, { wis: 1 }, { cha: 1 }];

const ITEMS: ItemData[] = [
  item("Sample Club", "simple"),
  item("Sample Dagger", "simple"),
  item("Sample Maul", "martial"),
];

function item(name: string, weaponCategory: "simple" | "martial"): ItemData {
  return { name, source: SOURCE, itemCategory: "Weapon", weaponCategory, type: "Melee Weapon", properties: [] } as unknown as ItemData;
}

const fixed = (grantId: string, category: ProficiencyGrant["category"], names: string[]): ProficiencyGrant => ({
  id: grantId,
  kind: "fixed",
  category,
  names,
});

const race = (name: string, abilityScoreIncrease: Record<string, number>[], grants: ProficiencyGrant[], traits: { name: string; description: string }[] = []): RaceData => ({
  name,
  source: SOURCE,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease,
  darkvision: null,
  traits,
  languages: [],
  subraces: [],
  grants,
  description: "Placeholder description for the race.",
});

const background = (name: string, grants: ProficiencyGrant[]): BackgroundData =>
  ({
    name,
    source: SOURCE,
    skillProficiencies: [],
    languageProficiencies: [],
    toolProficiencies: [],
    grants,
    description: "Placeholder description for the background.",
  }) as unknown as BackgroundData;

const PAIR = "Sample Pair";
const VARIANT = "Sample Variant";

const records: RaceData[] = [
  { ...race(PAIR, [{ dex: 2 }], [fixed(`${SOURCE}/Race/${PAIR}@0#skills:fixed:Perception,Stealth`, "skills", ["Perception", "Stealth"])]), subraces: [
    {
      name: VARIANT,
      source: SOURCE,
      raceName: PAIR,
      raceSource: SOURCE,
      darkvision: null,
      description: "Placeholder description for the subrace.",
      abilityScoreIncrease: [],
      grants: [fixed(`${SOURCE}/Subrace/${VARIANT}@0#skills:fixed:Perception`, "skills", ["Perception"])],
      traits: [],
    },
  ] } as RaceData,
  race(SCOUT, [{ dex: 2 }], [fixed(`${SOURCE}/Race/${SCOUT}@0#skills:fixed:Perception`, "skills", ["Perception"])], [
    { name: "Sample Eyes", description: "You are proficient in the Perception skill." },
  ]),
  race(BRAWLER, [{ str: 2 }], [fixed(`${SOURCE}/Race/${BRAWLER}@0#weapons:fixed:Sample Club`, "weapons", ["Sample Club"])]),
  race(DUELIST, [{ str: 2 }], [fixed(`${SOURCE}/Race/${DUELIST}@0#weapons:fixed:Sample Maul`, "weapons", ["Sample Maul"])]),
  race(TINKER, [{ int: 2 }], [fixed(`${SOURCE}/Race/${TINKER}@0#tools:fixed:Sample Kit`, "tools", ["Sample Kit"])]),
  race(PLATED, [{ con: 2 }], [fixed(`${SOURCE}/Race/${PLATED}@0#armor:fixed:Sample Mail`, "armor", ["Sample Mail"])]),
  race(ARTISAN, [{ int: 2 }], [
    { id: `${SOURCE}/Race/${ARTISAN}@0#tools:choice:names`, kind: "choice", category: "tools", count: 1, pool: { kind: "names", names: ["Sample Kit", "Sample Tool B", "Sample Tool C"] } },
  ]),
  race(WANDERER, ALL_SIX, [
    { id: `${SOURCE}/Race/${WANDERER}@0#tools:choice:any`, kind: "choice", category: "tools", count: 1, pool: { kind: "any" } },
  ]),
  race(BLADE, [{ wis: 2 }], [fixed(`${SOURCE}/Race/${BLADE}@0#weapons:fixed:Sample Blade`, "weapons", ["Sample Blade"])]),
];
const backgrounds: BackgroundData[] = [
  background(SAGE, [fixed(`${SOURCE}/Background/${SAGE}@0#skills:fixed:Perception`, "skills", ["Perception"])]),
  background(FORGE, [fixed(`${SOURCE}/Background/${FORGE}@0#skills:fixed:Insight`, "skills", ["Insight"])]),
];

const rule: OriginRuleRecord = {
  name: "Sample Origin Customization",
  source: ORIGIN_CUSTOMIZATION_BOOK,
  proficiencySwaps: [
    { from: "skill", to: ["skill"] },
    { from: "tool", to: ["tool", "simple weapon"] },
    { from: "armor", to: ["simple weapon", "tool"] },
    { from: "simple weapon", to: ["simple weapon", "tool"] },
    { from: "martial weapon", to: ["simple weapon", "martial weapon", "tool"] },
  ],
};

const compendium = inMemoryCompendium({ races: records, backgrounds, items: ITEMS, originRules: [rule] }, { integrated: true });
const catalogs = { compendium, activeBooks: ACTIVE };

/** A character holding the named race, with its ability increases applied by the ancestry transition. */
function holding(name: string, overrides: Partial<Character> = {}): Character {
  const raceRecord = records.find((r) => r.name === name)!;
  return applyAncestrySelection(makeChar(overrides), raceRecord, undefined, catalogs);
}

/** The swap row of the held race whose original is the given name. */
function rowOf(character: Character, original: string) {
  const row = proficiencySwapViews(character, catalogs).find((view) => view.original === original);
  assert.ok(row, `a swap row for ${original}`);
  return row;
}

const namesIn = (character: Character, category: "skills" | "tools" | "weapons" | "armor") =>
  proficiencySheet(character, catalogs)[category].map((entry) => entry.name);

test("a fixed skill swap lands on the sheet and drops the trait's skill too", () => {
  const scout = holding(SCOUT);
  assert.ok(namesIn(scout, "skills").includes("Perception"));

  const swapped = setProficiencySwap(scout, rowOf(scout, "Perception").id, "Insight", catalogs);
  assert.ok(namesIn(swapped, "skills").includes("Insight"));
  assert.ok(!namesIn(swapped, "skills").includes("Perception"), "neither the grant nor the trait text keeps Perception");
});

test("a simple weapon swap picks a simple weapon, and a martial weapon swap may pick a martial one", () => {
  const brawler = holding(BRAWLER);
  assert.ok(rowOf(brawler, "Sample Club").options.includes("Sample Dagger"));
  assert.ok(!rowOf(brawler, "Sample Club").options.includes("Sample Club"));

  const duelist = holding(DUELIST);
  const options = rowOf(duelist, "Sample Maul").options;
  assert.ok(options.includes("Sample Club") && options.includes("Sample Dagger"), "a simple weapon is offered");
  assert.ok(!options.includes("Sample Maul"), "the original is not offered");
  const swapped = setProficiencySwap(duelist, rowOf(duelist, "Sample Maul").id, "Sample Club", catalogs);
  assert.ok(namesIn(swapped, "weapons").includes("Sample Club"));
  assert.ok(!namesIn(swapped, "weapons").includes("Sample Maul"));
});

test("a tool grant swaps to a tool from the table's tool list", () => {
  const tinker = holding(TINKER);
  const swapped = setProficiencySwap(tinker, rowOf(tinker, "Sample Kit").id, "Smith's Tools", catalogs);
  assert.ok(namesIn(swapped, "tools").includes("Smith's Tools"));
  assert.ok(!namesIn(swapped, "tools").includes("Sample Kit"));
});

test("an armor grant swaps to a weapon of the allowed kind and lands in the weapon category", () => {
  const plated = holding(PLATED);
  const row = rowOf(plated, "Sample Mail");
  assert.ok(row.options.includes("Sample Club") && row.options.includes("Sample Dagger"), "a simple weapon is offered");
  assert.ok(row.options.includes("Smith's Tools"), "a tool is offered");
  const swapped = setProficiencySwap(plated, row.id, "Sample Dagger", catalogs);
  assert.ok(namesIn(swapped, "weapons").includes("Sample Dagger"));
  assert.ok(!namesIn(swapped, "armor").includes("Sample Mail"));
});

test("a narrower choice's pick is swapped, and the sheet holds the replacement instead", () => {
  const artisan = holding(ARTISAN, { proficiencyPicks: { [`${SOURCE}/Race/${ARTISAN}@0#tools:choice:names`]: ["Sample Kit"] } });
  const row = rowOf(artisan, "Sample Kit");
  assert.ok(row.options.includes("Smith's Tools"));
  const swapped = setProficiencySwap(artisan, row.id, "Smith's Tools", catalogs);
  assert.ok(namesIn(swapped, "tools").includes("Smith's Tools"));
  assert.ok(!namesIn(swapped, "tools").includes("Sample Kit"));
});

test("an 'any' choice and a grant the Compendium cannot classify offer no swap", () => {
  const wanderer = holding(WANDERER, { proficiencyPicks: { [`${SOURCE}/Race/${WANDERER}@0#tools:choice:any`]: ["Smith's Tools"] } });
  assert.deepEqual(proficiencySwapViews(wanderer, catalogs).map((row) => row.original), []);

  const blade = holding(BLADE);
  assert.deepEqual(proficiencySwapViews(blade, catalogs).map((row) => row.original), []);
});

test("a kind with no table row offers no swap", () => {
  const tinker = holding(TINKER);
  const onlySkills = { ...rule, proficiencySwaps: [{ from: "skill" as const, to: ["skill" as const] }] };
  const narrow = inMemoryCompendium({ races: records, backgrounds, items: ITEMS, originRules: [onlySkills] }, { integrated: true });
  assert.deepEqual(proficiencySwapViews(tinker, { compendium: narrow, activeBooks: ACTIVE }), []);
});

test("a background that grants the same skill is untouched, and no swap is offered on it", () => {
  const scout = holding(SCOUT, { background: { name: SAGE, source: SOURCE } });
  const swapped = setProficiencySwap(scout, rowOf(scout, "Perception").id, "Insight", catalogs);

  assert.ok(namesIn(swapped, "skills").includes("Perception"), "the background still grants Perception");
  assert.deepEqual(proficiencySwapViews(scout, catalogs).map((row) => row.original), ["Perception"]);
});

test("the pool leaves out what another source holds and the replacements of other swaps", () => {
  const scout = holding(SCOUT, { background: { name: FORGE, source: SOURCE } });
  assert.ok(!rowOf(scout, "Perception").options.includes("Insight"), "a background skill is excluded");
});

test("with TCE off the saved swap is kept, and the sheet shows the original", () => {
  const scout = holding(SCOUT);
  const swapped = setProficiencySwap(scout, rowOf(scout, "Perception").id, "Insight", catalogs);

  const off = reconcileForActiveBooks(swapped, compendium, WITHOUT_TCE);
  assert.deepEqual(off.proficiencyPicks, swapped.proficiencyPicks);
  assert.ok(proficiencySheet(off, { compendium, activeBooks: WITHOUT_TCE }).skills.map((entry) => entry.name).includes("Perception"));

  assert.deepEqual(reconcileForActiveBooks(off, compendium, ACTIVE).proficiencyPicks, swapped.proficiencyPicks);
});

test("a race change releases the swap with a notice", () => {
  const scout = holding(SCOUT);
  const swapped = setProficiencySwap(scout, rowOf(scout, "Perception").id, "Insight", catalogs);

  const changed = changeRace(swapped, compendium, ACTIVE);
  assert.equal(changed.proficiencyPicks, undefined);
  assert.deepEqual(changed.needsReview, ["Skill swap to Insight removed: ancestry no longer grants Perception"]);
});

test("a replacement another source now grants is dropped with a notice", () => {
  const scout = holding(SCOUT);
  const swapped = setProficiencySwap(scout, rowOf(scout, "Perception").id, "Insight", catalogs);

  const forged = reconcile({ ...swapped, background: { name: FORGE, source: SOURCE } }, compendium, { activeBooks: ACTIVE });
  assert.equal(forged.proficiencyPicks, undefined);
  assert.deepEqual(forged.needsReview, ["Skill swap to Insight removed: Insight is no longer available"]);
});

test("a swap equal to its default is not stored", () => {
  const scout = holding(SCOUT);
  assert.equal(setProficiencySwap(scout, rowOf(scout, "Perception").id, "Perception", catalogs).proficiencyPicks, undefined);
});

test("Reset clears every swap on the card, and reconciling again changes nothing", () => {
  const scout = holding(SCOUT);
  const swapped = setProficiencySwap(scout, rowOf(scout, "Perception").id, "Insight", catalogs);
  assert.ok(swapped.proficiencyPicks);

  const reset = resetOriginSwaps(swapped, catalogs);
  assert.equal(reset.proficiencyPicks, undefined);
  assert.deepEqual(reconcile(reset, compendium, { activeBooks: ACTIVE }), reset);
});

test("normal Proficiency Choice offers never list a swap", () => {
  const artisan = holding(ARTISAN, { proficiencyPicks: { [`${SOURCE}/Race/${ARTISAN}@0#tools:choice:names`]: ["Sample Kit"] } });
  const swapped = setProficiencySwap(artisan, rowOf(artisan, "Sample Kit").id, "Smith's Tools", catalogs);
  const offers = proficiencyChoiceOffers(swapped, { compendium, activeBooks: ACTIVE });
  assert.ok(!JSON.stringify(offers).includes("#swap:"));
});

test("a skill that the race and its subrace both name has one swap row", () => {
  const pair = holding(PAIR, { race: { name: PAIR, source: SOURCE, subraceName: VARIANT, subraceSource: SOURCE } });
  const rows = proficiencySwapViews(pair, catalogs).filter((row) => row.original === "Perception");
  assert.equal(rows.length, 1);
});

test("one swap's replacement is excluded from another swap's pool", () => {
  const pair = holding(PAIR);
  const swapped = setProficiencySwap(pair, rowOf(pair, "Perception").id, "Athletics", catalogs);
  const stealth = proficiencySwapViews(swapped, catalogs).find((row) => row.original === "Stealth");
  assert.ok(stealth, "a swap row for Stealth");
  assert.ok(!stealth.options.includes("Athletics"), "Athletics is taken by the Perception swap");
  assert.ok(stealth.options.includes("Acrobatics"));
});

test("a swap of a race skill leaves a same-named Rule Choice skill pick on the sheet", () => {
  const scout = holding(SCOUT, {
    ruleChoices: [
      { id: `${SOURCE}__Sample Barbarian__Primal Knowledge 3`, trait: "Primal Knowledge", origin: "class", choose: 1, from: [], picked: ["Perception"] },
    ],
  });
  const swapped = setProficiencySwap(scout, rowOf(scout, "Perception").id, "Arcana", catalogs);

  assert.ok(namesIn(swapped, "skills").includes("Arcana"), "the swap's replacement is held");
  assert.ok(namesIn(swapped, "skills").includes("Perception"), "the Rule Choice pick still grants Perception");
});

test("a swap's pick is saved under its grant id, the swap mark, and the original name", () => {
  const scout = holding(SCOUT);
  const row = rowOf(scout, "Perception");
  const swapped = setProficiencySwap(scout, row.id, "Insight", catalogs);

  assert.equal(row.id, `${SOURCE}/Race/${SCOUT}@0#skills:fixed:Perception#swap:Perception`);
  assert.deepEqual(Object.keys(swapped.proficiencyPicks ?? {}), [row.id]);
  assert.deepEqual(swapped.proficiencyPicks?.[row.id], ["Insight"]);
});

test("a held race missing from the catalog keeps its saved skill swap until the race is found again", () => {
  const scout = holding(SCOUT);
  const swapped = setProficiencySwap(scout, rowOf(scout, "Perception").id, "Insight", catalogs);
  const withoutScout = inMemoryCompendium({ races: records.filter((r) => r.name !== SCOUT), backgrounds, items: ITEMS, originRules: [rule] }, { integrated: true });

  const absent = reconcile(swapped, withoutScout, { activeBooks: ACTIVE });
  assert.deepEqual(absent.proficiencyPicks, swapped.proficiencyPicks);
  assert.deepEqual(absent.needsReview, undefined);

  const back = reconcile(absent, compendium, { activeBooks: ACTIVE });
  assert.deepEqual(back.proficiencyPicks, swapped.proficiencyPicks);
});

const TWO_SKILLS = "Sample Two Skills";

test("a multi-name background sharing the race's skill keeps it, and offers no swap on a skill only the background names", () => {
  const twoSkills = { ...background(TWO_SKILLS, [fixed(`${SOURCE}/Background/${TWO_SKILLS}@0#skills:fixed:Perception,Insight`, "skills", ["Perception", "Insight"])]) };
  const twoSkillCatalogs = {
    compendium: inMemoryCompendium({ races: records, backgrounds: [...backgrounds, twoSkills], items: ITEMS, originRules: [rule] }, { integrated: true }),
    activeBooks: ACTIVE,
  };
  const scout = applyAncestrySelection(makeChar({ background: { name: TWO_SKILLS, source: SOURCE } }), records.find((r) => r.name === SCOUT)!, undefined, twoSkillCatalogs);

  assert.deepEqual(proficiencySwapViews(scout, twoSkillCatalogs).map((row) => row.original), ["Perception"], "Insight is not a race skill, so no row offers it");

  const perception = proficiencySwapViews(scout, twoSkillCatalogs)[0];
  const swapped = setProficiencySwap(scout, perception.id, "Arcana", twoSkillCatalogs);
  const names = proficiencySheet(swapped, twoSkillCatalogs).skills.map((entry) => entry.name);
  assert.ok(names.includes("Perception"), "the background's own Perception stays on the sheet");
  assert.ok(names.includes("Insight"), "the background's other skill stays on the sheet");
  assert.ok(names.includes("Arcana"), "the race's replacement is on the sheet");
});

const feature = (id: string, origin: FeatureInstance["origin"], grants: ProficiencyGrant[]): FeatureInstance =>
  ({ id, name: id, source: SOURCE, description: "Placeholder description.", origin, grants }) as FeatureInstance;

test("only the race's own grant is swapped: a Class or Feat feature of the same skill keeps it", () => {
  // The Class and Feat features come first, so a candidate filter that admitted them would see the name first.
  const features = [
    feature("class", "Class", [fixed("class-grant", "skills", ["Perception"])]),
    feature("feat", "Feat", [fixed("feat-grant", "skills", ["Perception"])]),
    feature("race", "Race", [fixed("race-grant", "skills", ["Perception"])]),
  ];
  const slots = proficiencySwapSlots({
    features,
    items: ITEMS,
    rows: [{ from: "skill", to: ["skill"] }],
    held: () => false,
    picks: { [swapId("race-grant", "Perception")]: ["Arcana"] },
    available: true,
  });
  assert.deepEqual(slots.map((slot) => [slot.featureId, slot.grantId, slot.original]), [["race", "race-grant", "Perception"]]);

  const swapped = withProficiencySwaps(features, slots);
  const namesOn = (id: string) => swapped.find((f) => f.id === id)!.grants!.flatMap((grant) => (grant.kind === "fixed" ? grant.names : []));
  assert.deepEqual(namesOn("class"), ["Perception"]);
  assert.deepEqual(namesOn("feat"), ["Perception"]);
  assert.deepEqual(namesOn("race"), ["Arcana"]);
});

test("re-picking the narrower choice to another value releases its swap with a notice, and the original does not bring it back", () => {
  const grant = `${SOURCE}/Race/${ARTISAN}@0#tools:choice:names`;
  const artisan = holding(ARTISAN, { proficiencyPicks: { [grant]: ["Sample Kit"] } });
  const swapped = setProficiencySwap(artisan, rowOf(artisan, "Sample Kit").id, "Smith's Tools", catalogs);

  const repicked = reconcile(recordProficiencyPick(swapped, { id: grant, choose: 1 }, "Sample Tool B"), compendium, { activeBooks: ACTIVE });
  assert.deepEqual(repicked.proficiencyPicks, { [grant]: ["Sample Tool B"] });
  assert.deepEqual(repicked.needsReview, ["Tool swap to Smith's Tools removed: ancestry no longer grants Sample Kit"]);
  assert.ok(!namesIn(repicked, "tools").includes("Smith's Tools"));

  const originalAgain = reconcile(recordProficiencyPick(repicked, { id: grant, choose: 1 }, "Sample Kit"), compendium, { activeBooks: ACTIVE });
  assert.equal(originalAgain.proficiencyPicks?.[`${grant}#swap:Sample Kit`], undefined);
});
