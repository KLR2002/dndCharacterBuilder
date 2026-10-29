import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { ruleGrantedSkills } from "../src/rules/proficiencySheet.ts";
import { skillPickOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { inMemoryCompendium, integratedTestCompendium, makeChar } from "./testUtils.ts";
import { anyLanguageChoice, lamplighterBackground, placeholderFeat, vellariRace, wardenClass } from "./proficiencySheetFixture.ts";
import type { ClassData, ProficiencyGrant, SubclassData } from "../src/types/dnd5e.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";

// Invented classes, subclasses and grants only. Nothing here is real 5e text.

const GAMMA = "GAMMA";
const names = (offer: { options: { name: string }[] }) => offer.options.map((option) => option.name).sort();

const feature = (name: string, level: number, grants: ProficiencyGrant[] = []) => ({
  name,
  level,
  description: `Placeholder description for ${name}.`,
  grants,
});

// A subclass feature with a language pick and a skill pick that doubles the bonus, as the Knowledge Domain has.
const insightId = "GAMMA/Warden/Lantern Keeper/Keeper's Insight@3#skills:choice";
const insightPick = (): ProficiencyGrant => ({
  id: insightId,
  kind: "choice",
  category: "skills",
  count: 2,
  pool: { kind: "names", names: ["Arcana", "History", "Nature", "Religion"] },
  expertise: true,
});

const lanternKeeper: SubclassData = {
  name: "Lantern Keeper",
  shortName: "Lantern Keeper",
  source: GAMMA,
  className: "Warden",
  classSource: GAMMA,
  description: "Placeholder description for the Lantern Keeper.",
  features: [
    feature("Keeper's Insight", 3, [
      anyLanguageChoice("GAMMA/Warden/Lantern Keeper/Keeper's Insight@3#languages:choice", 2),
      insightPick(),
    ]),
  ],
};

const warden = wardenClass({ name: "Warden", source: GAMMA, subclasses: [lanternKeeper] });
const keeperEntry: CharacterClass = { className: "Warden", source: GAMMA, level: 3, subclassName: "Lantern Keeper", subclassSource: GAMMA };
const fighter: CharacterClass = { className: "Fighter", source: "PHB", level: 1 };

// A later class whose record gives one skill pick from a short list as a multiclass proficiency.
const laterClass = (name: string, from: string[]): { entry: CharacterClass; record: ClassData } => ({
  entry: { className: name, source: GAMMA, level: 1 },
  record: wardenClass({
    name,
    source: GAMMA,
    multiclassing: { proficienciesGained: { skills: [{ choose: { from, count: 1 } }] } },
  }),
});
const sentinel = laterClass("Sentinel", ["stealth", "insight", "medicine"]);
const sage = laterClass("Sage", ["arcana", "nature", "insight"]);

const compendiumWith = (...extra: ClassData[]) => inMemoryCompendium({ classes: [warden, ...extra] });
const sentinelCompendium = () => compendiumWith(sentinel.record);

const keeper = (extra: Partial<Character> = {}): Character => makeChar({ classes: [keeperEntry], ...extra });

test("a subclass skill pick is a card pick named for its feature, and carries Expertise when its grant marks it", () => {
  const offers = skillPickOffers(keeper(), { compendium: compendiumWith(), activeBooks: ALL_BOOKS });
  assert.equal(offers.length, 1, "the language pick of the same feature is not a skill pick");
  const [pick] = offers;
  assert.equal(pick.traitName, "Keeper's Insight");
  assert.equal(pick.origin, "subclass");
  assert.equal(pick.choose, 2);
  assert.equal(pick.expertise, true);
  assert.deepEqual(names(pick), ["Arcana", "History", "Nature", "Religion"]);
});

test("a later class's multiclass skill pick is named for its class, with no Expertise", () => {
  const [pick] = skillPickOffers(makeChar({ classes: [fighter, sentinel.entry] }), { compendium: sentinelCompendium(), activeBooks: ALL_BOOKS });
  assert.equal(pick.traitName, "Sentinel multiclass skill");
  assert.equal(pick.origin, "class");
  assert.equal(pick.expertise, false);
  assert.deepEqual(names(pick), ["Insight", "Medicine", "Stealth"]);
});

test("a character holding neither feature has no skill pick to show", () => {
  assert.deepEqual(skillPickOffers(makeChar({ classes: [fighter] }), { compendium: compendiumWith(), activeBooks: ALL_BOOKS }), []);
});

test("a skill taken as a subclass pick is held for the starting skill picker", () => {
  const character = keeper({ proficiencyPicks: { [insightId]: ["Arcana", "History"] } });
  const held = ruleGrantedSkills(character, { compendium: compendiumWith(), activeBooks: ALL_BOOKS });
  assert.ok(held.includes("Arcana"));
  assert.ok(held.includes("History"));
});

test("a skill taken as a later class's multiclass pick is held for the starting skill picker", () => {
  const compendium = sentinelCompendium();
  const [offer] = skillPickOffers(makeChar({ classes: [fighter, sentinel.entry] }), { compendium, activeBooks: ALL_BOOKS });
  const character = makeChar({ classes: [fighter, sentinel.entry], proficiencyPicks: { [offer.id]: ["Stealth"] } });
  assert.ok(ruleGrantedSkills(character, { compendium, activeBooks: ALL_BOOKS }).includes("Stealth"));
});

test("a skill the starting picker holds is not offered to the subclass pick", () => {
  const [pick] = skillPickOffers(keeper({ chosenSkills: ["Nature"] }), { compendium: compendiumWith(), activeBooks: ALL_BOOKS });
  assert.deepEqual(names(pick), ["Arcana", "History", "Religion"]);
});

test("a skill picked on either card pick is not offered on the other, in both directions", () => {
  const compendium = compendiumWith(sage.record);
  const pickOf = (character: Character, traitName: string) =>
    skillPickOffers(character, { compendium, activeBooks: ALL_BOOKS }).find((offer) => offer.traitName === traitName);

  // The subclass pick holds Arcana, so the multiclass pick (which lists Arcana) does not offer it.
  const subclassFirst = makeChar({
    classes: [keeperEntry, sage.entry],
    proficiencyPicks: { [insightId]: ["Arcana", "History"] },
  });
  assert.deepEqual(names(pickOf(subclassFirst, "Sage multiclass skill")!), ["Insight", "Nature"]);

  // The multiclass pick holds Nature, so the subclass pick (which lists Nature) does not offer it.
  const multiclassFirstId = pickOf(makeChar({ classes: [keeperEntry, sage.entry] }), "Sage multiclass skill")!.id;
  const multiclassFirst = makeChar({
    classes: [keeperEntry, sage.entry],
    proficiencyPicks: { [multiclassFirstId]: ["Nature"] },
  });
  assert.deepEqual(names(pickOf(multiclassFirst, "Keeper's Insight")!), ["Arcana", "History", "Religion"]);
});

// A race, subrace or background skill pick is shown on the Race or Background tab, so it is not a Skills card pick.
// A feat's skill pick is one the Class tab owns, as a subclass's or a later class's is.
const skillChoice = (id: string, count: number): ProficiencyGrant => ({
  id,
  kind: "choice",
  category: "skills",
  count,
  pool: { kind: "names", names: ["Arcana", "History", "Nature"] },
});
const FEAT_SKILL_ID = "GAMMA/Feat/Sample Skilled@0#skills:choice";

test("a race, subrace or background skill pick is not a Skills card pick, and a feat's skill pick is", () => {
  const compendium = inMemoryCompendium({
    races: [vellariRace({ grants: [skillChoice("GAMMA/Race/Vellari@0#skills:choice", 1)] })],
    backgrounds: [lamplighterBackground({ grants: [skillChoice("GAMMA/Background/Lamplighter@0#skills:choice", 1)] })],
    feats: [placeholderFeat({ name: "Sample Skilled", grants: [skillChoice(FEAT_SKILL_ID, 1)] })],
  });
  const character = makeChar({
    race: { name: "Vellari", source: "PHB" },
    background: { name: "Lamplighter", source: "PHB" },
    classes: [fighter],
    asiSelections: [{ level: 4, type: "feat", featName: "Sample Skilled", featSource: "PHB" }],
  });
  const offers = skillPickOffers(character, { compendium, activeBooks: ALL_BOOKS });
  assert.deepEqual(offers.map((offer) => offer.id), [FEAT_SKILL_ID]);
  assert.equal(offers[0].origin, "feat");
});

test("the Variant Human's skill pick is not on the Skills card, which keeps the Cleric's and the Rogue's picks", () => {
  const variantKnowledgeRogue = makeChar({
    race: { name: "Human", source: "PHB", subraceName: "Variant", subraceSource: "PHB" },
    classes: [
      { className: "Cleric", source: "PHB", level: 1, subclassName: "Knowledge Domain", subclassSource: "PHB" },
      { className: "Rogue", source: "PHB", level: 1 },
    ],
  });
  const titles = skillPickOffers(variantKnowledgeRogue, { compendium: integratedTestCompendium(), activeBooks: ALL_BOOKS }).map((offer) => offer.traitName);
  assert.deepEqual(titles, ["Blessings of Knowledge", "Rogue multiclass skill"]);
});
