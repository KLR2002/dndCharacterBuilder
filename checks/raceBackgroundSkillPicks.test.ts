import test from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import type { SubraceData } from "../src/types/dnd5e.ts";
import { proficiencySheet, skillChoiceOffers, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { picksOnlyLanguages, proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { clearBackground, setCustomBackground } from "../src/rules/builderTransitions.ts";
import { ancestryRuleChoices, pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { ALL_LANGUAGE_NAMES, ALL_TOOLS } from "../src/rules/proficienciesAndLanguages.ts";
import { anyLanguageChoice, vellariRace } from "./proficiencySheetFixture.ts";
import { inMemoryCompendium, integratedTestCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";

// Race, subrace and background skill picks are Proficiency Choices read from the Catalog's choice grants.
// The integrated examples (Investigator, Cloistered Scholar, the Half-Elf descents, Orc and Tortle) run
// on the tracked data through the integrated Compendium, as the neighbouring tests do. The custom background
// runs on the SRD Baseline, which has no Custom Background record, so its picks come from the app alone.

const names = (entries: SheetEntry[]) => entries.map((entry) => entry.name).sort();
const SKILLS = ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"];

const INVESTIGATOR_ID = "VRGR/Background/Investigator@0#skills:choice:from";
const SCHOLAR_ID = "SCAG/Background/Cloistered Scholar@0#skills:choice:from";
const CUSTOM_SKILLS_ID = "Custom/Background/Custom Background@0#skills:choice:any";
const CUSTOM_LANGUAGES_ID = "Custom/Background/Custom Background@0#languages:choice:any";
const HALF_ELF_ID = "PHB/Race/Half-Elf@0#skills:choice:any";
const DROW_SKILLS_ID = "SCAG/Subrace/Half-Elf (Drow Descent)@0#skills:choice:any";

const skillOffers = (character: Character, compendium = integratedTestCompendium()) =>
  proficiencyChoiceOffers(character, { compendium }).filter((offer) => offer.id.includes("#skills:"));

const sheetSkills = (character: Character, compendium = integratedTestCompendium()) =>
  names(proficiencySheet(character, { compendium }).skills);

test("Investigator offers its two-skill pool of Insight, Investigation and Perception", () => {
  const offers = skillOffers(makeChar({ background: { name: "Investigator", source: "VRGR" } }));
  assert.equal(offers.length, 1, "one skill pool");
  assert.equal(offers[0].id, INVESTIGATOR_ID);
  assert.equal(offers[0].choose, 2);
  assert.deepEqual(offers[0].options.map((option) => option.name), ["Insight", "Investigation", "Perception"]);
  assert.equal(offers[0].origin, "background");
});

test("Investigator's picks from its pool are on the sheet, and a skill outside the pool is not", () => {
  const picked = makeChar({
    background: { name: "Investigator", source: "VRGR" },
    proficiencyPicks: { [INVESTIGATOR_ID]: ["Insight", "Perception"] },
  });
  assert.deepEqual(sheetSkills(picked).filter((skill) => ["Insight", "Investigation", "Perception"].includes(skill)), ["Insight", "Perception"]);
  const outside = makeChar({
    background: { name: "Investigator", source: "VRGR" },
    proficiencyPicks: { [INVESTIGATOR_ID]: ["Stealth"] },
  });
  assert.equal(sheetSkills(outside).includes("Stealth"), false);
});

test("Cloistered Scholar keeps History and offers one pick from Arcana, Nature and Religion", () => {
  const scholar = makeChar({ background: { name: "Cloistered Scholar", source: "SCAG" } });
  assert.equal(sheetSkills(scholar).includes("History"), true, "History is a fixed grant");
  const offers = skillOffers(scholar);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].id, SCHOLAR_ID);
  assert.equal(offers[0].choose, 1);
  assert.deepEqual(offers[0].options.map((option) => option.name), ["Arcana", "Nature", "Religion"]);
  assert.ok(proficiencyChoiceOffers(scholar, { compendium: integratedTestCompendium() }).some((offer) => offer.traitName === "Cloistered Scholar: Skill"));
});

test("Cloistered Scholar's pick is on the sheet beside History", () => {
  const scholar = makeChar({
    background: { name: "Cloistered Scholar", source: "SCAG" },
    proficiencyPicks: { [SCHOLAR_ID]: ["Nature"] },
  });
  assert.deepEqual(sheetSkills(scholar).filter((skill) => ["History", "Nature"].includes(skill)), ["History", "Nature"]);
});

test("a custom background offers two skill picks and two language picks, and the sheet is the same with none made", () => {
  const compendium = srdBaselineCompendium();
  const custom = setCustomBackground(makeChar({ classes: [{ className: "Fighter", source: "PHB", level: 1 }] }), "Lamp Warden", []);
  const offers = proficiencyChoiceOffers(custom, { compendium });
  const skillOffer = offers.find((offer) => offer.id === CUSTOM_SKILLS_ID);
  const languageOffer = offers.find((offer) => offer.id === CUSTOM_LANGUAGES_ID);
  assert.ok(skillOffer, "the custom background offers its skill picks");
  assert.equal(skillOffer.choose, 2);
  assert.deepEqual(skillOffer.options.map((option) => option.name).sort(), [...SKILLS].sort());
  assert.equal(skillOffer.origin, "background");
  assert.ok(languageOffer, "the custom background offers its language picks");
  assert.equal(languageOffer.choose, 2);
});

test("the custom background's two skill picks are its skill pick on the sheet, and are not written to the old skill buckets", () => {
  const compendium = srdBaselineCompendium();
  const custom = setCustomBackground(makeChar(), "Lamp Warden", ["Arcana", "Nature"]);
  assert.deepEqual(custom.proficiencyPicks?.[CUSTOM_SKILLS_ID], ["Arcana", "Nature"]);
  assert.equal(custom.skillChoices?.some((entry) => entry.origin === "background"), false);
  assert.deepEqual(custom.chosenSkills, []);
  assert.deepEqual(names(proficiencySheet(custom, { compendium }).skills), ["Arcana", "Nature"]);
});

test("a custom background's picks survive reconciling, and clearing the background releases them with a notice", () => {
  const compendium = srdBaselineCompendium();
  const custom = setCustomBackground(makeChar(), "Lamp Warden", ["Arcana", "Nature"]);
  assert.deepEqual(reconcile(custom, compendium).proficiencyPicks, custom.proficiencyPicks);
  const cleared = clearBackground(custom, { compendium });
  assert.equal(cleared.proficiencyPicks?.[CUSTOM_SKILLS_ID], undefined);
  assert.ok(cleared.needsReview?.some((notice) => notice.includes("Arcana") && notice.includes("Custom Background")));
  assert.equal(names(proficiencySheet(cleared, { compendium }).skills).includes("Arcana"), false);
});

test("a custom background saved with the old skill bucket moves its picks into its pick on reconcile, and the sheet does not change", () => {
  const compendium = srdBaselineCompendium();
  const before = makeChar({
    background: { name: "Lamp Warden", source: "Custom" },
    chosenSkills: ["Arcana", "Nature", "Athletics"],
    skillChoices: [{ id: "background_skills", origin: "background", choose: 2, from: ["Arcana", "Nature"], picked: ["Arcana", "Nature"] }],
  });
  const after = reconcile(before, compendium);
  assert.deepEqual(after.proficiencyPicks?.[CUSTOM_SKILLS_ID], ["Arcana", "Nature"]);
  assert.equal(after.skillChoices?.some((entry) => entry.origin === "background"), false);
  assert.deepEqual(after.chosenSkills, ["Athletics"], "only the unattributed skill stays in the old bucket");
  assert.deepEqual(names(proficiencySheet(after, { compendium }).skills), names(proficiencySheet(before, { compendium }).skills));
});

// The custom background's second Proficiency Choice draws from tools and languages together: one pick of two.
const customWith = (picks: string[], extra: Partial<Character> = {}) =>
  makeChar({
    background: { name: "Lamp Warden", source: "Custom" },
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    proficiencyPicks: { [CUSTOM_LANGUAGES_ID]: picks },
    ...extra,
  });

const toolOrLanguageOffer = (character: Character) =>
  proficiencyChoiceOffers(character, { compendium: srdBaselineCompendium() }).find((offer) => offer.id === CUSTOM_LANGUAGES_ID);

test("a custom background's second choice offers two picks from tools and languages together, titled Tool or language", () => {
  const offer = toolOrLanguageOffer(makeChar({ background: { name: "Lamp Warden", source: "Custom" } }));
  assert.ok(offer, "the custom background offers its tool or language picks");
  assert.equal(offer.choose, 2);
  assert.equal(offer.traitName, "Custom Background: Tool or language");
  // Every character holds Common, so it is not offered; the rest of both lists is.
  const offered = [...ALL_TOOLS, ...ALL_LANGUAGE_NAMES.filter((name) => name !== "Common")];
  assert.deepEqual(offer.options.map((option) => option.name).sort(), offered.sort());
});

test("a custom background's skill choice keeps its two skill picks of any", () => {
  const offers = proficiencyChoiceOffers(makeChar({ background: { name: "Lamp Warden", source: "Custom" } }), { compendium: srdBaselineCompendium() });
  const skillOffer = offers.find((offer) => offer.id === CUSTOM_SKILLS_ID);
  assert.equal(skillOffer?.choose, 2);
  assert.equal(skillOffer?.traitName, "Custom Background: Skill");
});

test("a pick on the custom background's tool or language choice moves its counter, and a third pick makes way for the newest", () => {
  const base = makeChar({ background: { name: "Lamp Warden", source: "Custom" } });
  const offer = toolOrLanguageOffer(base);
  if (!offer) throw new Error("expected the tool or language offer");
  const first = pickRuleChoice(base, offer, "Smith's Tools");
  assert.deepEqual(first.proficiencyPicks?.[CUSTOM_LANGUAGES_ID], ["Smith's Tools"]);
  const second = pickRuleChoice(first, offer, "Elvish");
  assert.deepEqual(second.proficiencyPicks?.[CUSTOM_LANGUAGES_ID], ["Smith's Tools", "Elvish"]);
  const third = pickRuleChoice(second, offer, "Thieves' tools");
  assert.deepEqual(third.proficiencyPicks?.[CUSTOM_LANGUAGES_ID], ["Elvish", "Thieves' tools"]);
});

test("a tool pick on the custom background is among the sheet's tools, and a language pick among its languages", () => {
  const compendium = srdBaselineCompendium();
  const sheet = proficiencySheet(customWith(["Smith's Tools", "Elvish"]), { compendium });
  assert.ok(names(sheet.tools).includes("Smith's Tools"), "the tool pick is a tool");
  assert.equal(names(sheet.tools).includes("Elvish"), false, "a language is not a tool");
  assert.ok(names(sheet.languages).includes("Elvish"), "the language pick is a language");
  assert.equal(names(sheet.languages).includes("Smith's Tools"), false, "a tool is not a language");
});

test("a tool or language the character holds from another source is not offered again on the custom background's choice", () => {
  const held = makeChar({
    background: { name: "Lamp Warden", source: "Custom" },
    race: { name: "Dwarf", source: "PHB" },
    addedTools: ["Smith's Tools"],
  });
  const offer = toolOrLanguageOffer(held);
  if (!offer) throw new Error("expected the tool or language offer");
  const options = offer.options.map((option) => option.name);
  assert.equal(options.includes("Smith's Tools"), false, "a tool held by hand is not offered");
  assert.equal(options.includes("Dwarvish"), false, "a language the race grants is not offered");
  assert.ok(options.includes("Elvish"), "a language nothing holds is still offered");
});

test("a saved language pick under the old id stays valid, and is still a language on the sheet", () => {
  const compendium = srdBaselineCompendium();
  const saved = customWith(["Elvish"]);
  assert.deepEqual(names(proficiencySheet(saved, { compendium }).languages).filter((language) => language === "Elvish"), ["Elvish"]);
  const offer = toolOrLanguageOffer(saved);
  assert.equal(offer?.options.some((option) => option.name === "Elvish"), true, "the saved pick stays selectable");
});

const halfElf = (subraceName?: string) =>
  makeChar({
    race: { name: "Half-Elf", source: "PHB", ...(subraceName ? { subraceName, subraceSource: subraceName.startsWith("Mark") ? "ERLW" : "SCAG" } : {}) },
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
  });

/** The variant descent's Variant Feature choice, with the option picked. */
function variantPicking(subraceName: string, option: string): Character {
  const character = halfElf(subraceName);
  const choice = ancestryRuleChoices(character, integratedTestCompendium().for().races())[0];
  if (!choice) throw new Error("expected a descent choice");
  return { ...character, ruleChoices: [{ id: choice.id, trait: choice.traitName, origin: "race", choose: 1, from: choice.options.map((o) => o.name), picked: [option] }] };
}

test("a base Half-Elf offers Skill Versatility as two picks from any skill", () => {
  const offers = skillOffers(halfElf());
  assert.equal(offers.length, 1);
  assert.equal(offers[0].id, HALF_ELF_ID);
  assert.equal(offers[0].choose, 2);
  assert.equal(offers[0].options.length, SKILLS.length);
});

test("a Half-Elf descent that picks Skill Versatility keeps the two picks, and one that picks another feature offers none", () => {
  assert.equal(skillOffers(variantPicking("Drow Descent", "Skill Versatility")).length, 1);
  assert.equal(skillOffers(variantPicking("Drow Descent", "Drow Magic")).length, 0);
  assert.equal(skillOffers(variantPicking("Aquatic Elf Descent", "Swim")).length, 0);
});

test("a Half-Elf descent with no pick, and a Mark, offer no Skill Versatility picks", () => {
  assert.equal(skillOffers(halfElf("Drow Descent")).length, 0, "no pick is made yet");
  assert.equal(skillOffers(halfElf("Mark of Detection")).length, 0, "a Mark has no Skill Versatility");
});

test("a Skill Versatility pick is on the sheet under the descent that carries it, and under the race for a descent that does not", () => {
  const drow = variantPicking("Drow Descent", "Skill Versatility");
  const drowPicked = { ...drow, proficiencyPicks: { [DROW_SKILLS_ID]: ["Stealth", "History"] } };
  assert.deepEqual(sheetSkills(drowPicked).filter((skill) => ["History", "Stealth"].includes(skill)), ["History", "Stealth"]);
  const aquatic = variantPicking("Aquatic Elf Descent", "Skill Versatility");
  assert.equal(skillOffers(aquatic)[0].id, HALF_ELF_ID, "the Aquatic descent has no skill choice, so the race offers it");
  const aquaticPicked = { ...aquatic, proficiencyPicks: { [HALF_ELF_ID]: ["Stealth", "History"] } };
  assert.deepEqual(sheetSkills(aquaticPicked).filter((skill) => ["History", "Stealth"].includes(skill)), ["History", "Stealth"]);
  const mark = makeChar({
    race: { name: "Half-Elf", source: "PHB", subraceName: "Mark of Detection", subraceSource: "ERLW" },
    proficiencyPicks: { [HALF_ELF_ID]: ["Stealth"] },
  });
  assert.equal(sheetSkills(mark).includes("Stealth"), false);
});

test("Orc offers two picks from its seven-skill list, from its book's record", () => {
  const offers = skillOffers(makeChar({ race: { name: "Orc", source: "VGM" } }));
  assert.equal(offers.length, 1);
  assert.equal(offers[0].choose, 2);
  assert.deepEqual(offers[0].options.map((option) => option.name), ["Animal Handling", "Insight", "Intimidation", "Medicine", "Nature", "Perception", "Survival"]);
});

test("Tortle offers one pick from its six-skill list", () => {
  const offers = skillOffers(makeChar({ race: { name: "Tortle", source: "MPMM" } }));
  assert.equal(offers.length, 1);
  assert.equal(offers[0].choose, 1);
  assert.deepEqual(offers[0].options.map((option) => option.name), ["Animal Handling", "Medicine", "Nature", "Perception", "Stealth", "Survival"]);
});

test("the Builder's race skill offers come from choice grants, not from the text of a trait", () => {
  const textOnly = inMemoryCompendium({
    races: [
      {
        name: "Sample Folk",
        source: "TST",
        size: ["Medium"],
        speed: { walk: 30 },
        abilityScoreIncrease: [],
        darkvision: null,
        traits: [{ name: "Lore", description: "You gain proficiency in two skills of your choice." }],
        languages: [],
        subraces: [],
        description: "Placeholder description for the Sample Folk.",
      },
    ],
  });
  const character = makeChar({ race: { name: "Sample Folk", source: "TST" } });
  assert.deepEqual(skillChoiceOffers(character, { compendium: textOnly }).filter((offer) => offer.source.startsWith("Race")), []);
});

test("a race skill pick saved in the old skill bucket moves into its Proficiency Choice on reconcile, and the sheet does not change", () => {
  const compendium = integratedTestCompendium();
  const before = makeChar({
    race: { name: "Half-Elf", source: "PHB" },
    chosenSkills: ["Insight", "Stealth"],
    skillChoices: [{ id: "Race: Skill Versatility", origin: "race", choose: 2, from: SKILLS, picked: ["Insight", "Stealth"] }],
  });
  const after = reconcile(before, compendium);
  assert.deepEqual(after.proficiencyPicks?.[HALF_ELF_ID], ["Insight", "Stealth"]);
  assert.equal(after.skillChoices?.some((entry) => entry.origin === "race"), false);
  assert.deepEqual(after.chosenSkills, []);
  assert.deepEqual(sheetSkills(after, compendium), sheetSkills(before, compendium));
});

test("a background skill pick saved in the old bucket moves into its pick up to the count, and the rest stays where the sheet reads it", () => {
  const compendium = integratedTestCompendium();
  const before = makeChar({
    background: { name: "Cloistered Scholar", source: "SCAG" },
    chosenSkills: ["History", "Arcana", "Nature"],
    skillChoices: [{ id: "Background: Cloistered Scholar", origin: "background", choose: 1, from: ["Arcana", "Nature", "Religion"], picked: ["Arcana", "Nature"] }],
  });
  const after = reconcile(before, compendium);
  assert.deepEqual(after.proficiencyPicks?.[SCHOLAR_ID], ["Arcana"]);
  assert.deepEqual(after.chosenSkills, ["History", "Nature"]);
  assert.deepEqual(after.skillChoices, [{ id: "Background: Cloistered Scholar", origin: "background", choose: 1, from: ["Arcana", "Nature", "Religion"], picked: ["Nature"] }], "the pick no choice took stays in its entry");
  assert.deepEqual(sheetSkills(after, compendium), sheetSkills(before, compendium));
});

test("a saved background pick outside the pool stays in the old bucket, and the sheet still shows it", () => {
  const compendium = integratedTestCompendium();
  const before = makeChar({
    background: { name: "Cloistered Scholar", source: "SCAG" },
    chosenSkills: ["Stealth"],
    skillChoices: [{ id: "Background: Cloistered Scholar", origin: "background", choose: 1, from: ["Stealth"], picked: ["Stealth"] }],
  });
  const after = reconcile(before, compendium);
  assert.equal(after.proficiencyPicks?.[SCHOLAR_ID], undefined);
  assert.deepEqual(after.chosenSkills, ["Stealth"]);
  assert.ok(sheetSkills(after, compendium).includes("Stealth"));
});

test("migrating a race or background pick twice changes nothing, and a class skill pick stays where it was", () => {
  const compendium = integratedTestCompendium();
  const before = makeChar({
    race: { name: "Half-Elf", source: "PHB" },
    classes: [{ className: "Rogue", source: "PHB", level: 1 }],
    chosenSkills: ["Insight", "Athletics"],
    skillChoices: [
      { id: "Race: Skill Versatility", origin: "race", choose: 2, from: SKILLS, picked: ["Insight"] },
      { id: "Class: Rogue", origin: "class", choose: 1, from: ["Athletics"], picked: ["Athletics"] },
    ],
  });
  const once = reconcile(before, compendium);
  assert.deepEqual(once.skillChoices, [{ id: "Class: Rogue", origin: "class", choose: 1, from: ["Athletics"], picked: ["Athletics"] }]);
  assert.deepEqual(reconcile(once, compendium), once);
});

// The Race tab shows a race's and its subrace's picks together, so each is titled by what it picks.
const raceOfferTitles = (character: Character, compendium = integratedTestCompendium()) =>
  proficiencyChoiceOffers(character, { compendium })
    .filter((offer) => offer.origin === "race")
    .map((offer) => offer.traitName);

test("a Variant Human's picks are titled Language and Skill, not the name of the race or the subrace", () => {
  const variantHuman = makeChar({ race: { name: "Human", source: "PHB", subraceName: "Variant", subraceSource: "PHB" } });
  assert.deepEqual(raceOfferTitles(variantHuman), ["Language", "Skill"]);
});

test("race and subrace picks that share a descriptor are numbered across the race and its subrace, in grant order", () => {
  const sampleDescent: SubraceData = {
    name: "Sample Descent",
    source: "GAMMA",
    raceName: "Vellari",
    raceSource: "GAMMA",
    abilityScoreIncrease: [],
    darkvision: null,
    traits: [],
    description: "Placeholder description for the Sample Descent.",
    grants: [
      anyLanguageChoice("GAMMA/Subrace/Sample Descent@0#languages:choice:any", 1),
      { id: "GAMMA/Subrace/Sample Descent@0#skills:choice:any", kind: "choice", category: "skills", count: 1, pool: { kind: "any" } },
    ],
  };
  const compendium = inMemoryCompendium({
    races: [vellariRace({ source: "GAMMA", grants: [anyLanguageChoice("GAMMA/Race/Vellari@0#languages:choice:any", 1)], subraces: [sampleDescent] })],
  });
  const character = makeChar({ race: { name: "Vellari", source: "GAMMA", subraceName: "Sample Descent", subraceSource: "GAMMA" } });
  assert.deepEqual(raceOfferTitles(character, compendium), ["Language 1", "Language 2", "Skill"]);
});

test("a card of picks that are all languages is told apart from one holding a skill, a tool or a tool-or-language pick", () => {
  const compendium = integratedTestCompendium();
  const raceOffers = (character: Character) => proficiencyChoiceOffers(character, { compendium }).filter((offer) => offer.origin === "race");
  assert.equal(picksOnlyLanguages(raceOffers(makeChar({ race: { name: "Human", source: "PHB" } }))), true, "Human's language pick");
  const variant = makeChar({ race: { name: "Human", source: "PHB", subraceName: "Variant", subraceSource: "PHB" } });
  assert.equal(picksOnlyLanguages(raceOffers(variant)), false, "Variant Human's skill pick");
  const custom = setCustomBackground(makeChar(), "Lamp Warden", []);
  const customOffers = proficiencyChoiceOffers(custom, { compendium: srdBaselineCompendium() }).filter((offer) => offer.origin === "background");
  assert.equal(picksOnlyLanguages(customOffers.filter((offer) => offer.id === CUSTOM_LANGUAGES_ID)), false, "a tool or language pick");
  const acolyte = proficiencyChoiceOffers(makeChar({ background: { name: "Acolyte", source: "PHB" } }), { compendium }).filter((offer) => offer.origin === "background");
  assert.equal(picksOnlyLanguages(acolyte), true, "Acolyte's language picks");
});
