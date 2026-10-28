import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, loadTestCatalog, inMemoryCompendium, integratedTestCompendium } from "./testUtils.ts";
import type { CharacterClass } from "../src/types/character.ts";
import { effectiveScores, getAbilityModifier, formatModifier } from "../src/rules/abilities.ts";
import { maxHp, hitDiceByType } from "../src/rules/hp.ts";
import { armorClass } from "../src/rules/ac.ts";
import { speed, carryingWeight } from "../src/rules/speed.ts";
import { savingThrows } from "../src/rules/saves.ts";
import { proficiencySheet } from "../src/rules/proficiencySheet.ts";
import { skills } from "../src/rules/skills.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { multiclassSlots, pactSlots } from "../src/rules/slots.ts";
import { proficiencyBonus, totalLevel } from "../src/rules/proficiencies.ts";
import { classBaseProficiencies as proficiencies } from "../src/rules/proficiencySources/classBase.ts";
import { grantedFeatures } from "../src/rules/grantedFeatures.ts";
import { hitDieOf, PHB_HALF_CASTER_SLOTS, PHB_THIRD_CASTER_SLOTS, spellcastingAbility, asiLevels } from "../src/rules/classData.ts";

// Use the test catalog fixture; production rules receive only resolved plain data.
const readCatalog = (name: string) => loadTestCatalog(name);
const catalog = { classes: readCatalog("classes"), races: readCatalog("races"), backgrounds: readCatalog("backgrounds"), feats: readCatalog("feats") };
const cl = (className: string, level: number, subclassName?: string): CharacterClass => ({ className, source: "PHB", level, subclassName });
const scores = (values = {}) => ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...values });
const item = (armorCategory: string, ac?: number) => ({ id: armorCategory, name: "Unnamed gear", source: "PHB", quantity: 1, isEquipped: true, section: "equipped" as const, ac, armorCategory });

test("2014 ASI schedules are class-level based, including fighter and rogue extras", () => {
  assert.deepEqual(asiLevels("Fighter"), [4, 6, 8, 12, 14, 16, 19]);
  assert.deepEqual(asiLevels("Rogue"), [4, 8, 10, 12, 16, 19]);
  assert.deepEqual(asiLevels("Wizard"), [4, 8, 12, 16, 19]);
});

// Brief Step 1 scenarios, verbatim.
test("ranger 4 / wizard 3 multiclass slots", () => {
  const c = makeChar({ classes: [{ className: "Ranger", source: "PHB", level: 4 }, { className: "Wizard", source: "PHB", level: 3 }] });
  const s = multiclassSlots(c);
  assert.deepEqual(s.slots, [4, 3, 2]);
});
test("single-class paladin uses own half-caster table", () => {
  const c = makeChar({ classes: [{ className: "Paladin", source: "PHB", level: 5 }] });
  const s = multiclassSlots(c);
  assert.deepEqual(s.slots, [4, 2]); // PHB paladin 5: 4×1st, 2×2nd
});
test("channel divinity pools across cleric/paladin do not stack uses", () => {
  const c = makeChar({ classes: [cl("Cleric", 6), cl("Paladin", 3)] });
  const f = grantedFeatures(c, catalog);
  const cd = f.filter(x => x.name === "Channel Divinity");
  assert.equal(cd.length, 1);
  assert.equal(cd[0].max, 2); // cleric 6 threshold; paladin's 1 use folds in
});
test("extra attack does not stack fighter 5 / barbarian 5", () => {
  const c = makeChar({ classes: [cl("Fighter", 5), cl("Barbarian", 5)] });
  const f = grantedFeatures(c, catalog);
  assert.equal(f.filter(x => x.name === "Extra Attack").length, 1);
});
test("unarmored defense: first class in acquisition order wins", () => {
  const barbFirst = makeChar({ classes: [cl("Barbarian", 1), cl("Monk", 1)] });
  const monkFirst = makeChar({ classes: [cl("Monk", 1), cl("Barbarian", 1)] });
  assert.match(armorClass(barbFirst, {items:[]}).breakdown, /Con/);
  assert.match(armorClass(monkFirst, {items:[]}).breakdown, /Wis/);
});

test("ability scores use configured racial bonuses and ASIs without mutating choices", () => {
  const c = makeChar({ baseAbilityScores: scores({ str: 14, con: 12 }), racialAbilityBonuses: { str: 1, con: 1 }, asiSelections: [{ level: 4, type: "asi", asi: { str: 1, con: 1 } }] });
  const before = structuredClone(c);
  const result = effectiveScores(c);
  assert.equal(result.scores.str, 16);
  assert.equal(result.scores.con, 14);
  assert.equal(result.modifiers.str, 3);
  assert.deepEqual(c, before);
  assert.equal(getAbilityModifier(9), -1);
  assert.equal(formatModifier(0), "+0");
  assert.equal(formatModifier(-1), "-1");
});
test("resolved race/subrace fixed bonuses are fallback, configured racial bonuses override", () => {
  const opts = { race: { abilityScoreIncrease: [{ dex: 2 }] }, subrace: { abilityScoreIncrease: [{ wis: 1 }] } };
  assert.equal(effectiveScores(makeChar(), opts).scores.dex, 12);
  assert.equal(effectiveScores(makeChar(), opts).scores.wis, 11);
  assert.equal(effectiveScores(makeChar({ racialAbilityBonuses: { dex: 1 } }), opts).scores.dex, 11);
});
test("first hit die is full only once; later class levels use fixed averages", () => {
  assert.equal(maxHp(makeChar({ classes: [cl("Fighter", 5)], baseAbilityScores: scores({ con: 14 }) })), 44);
  assert.equal(maxHp(makeChar({ classes: [cl("Wizard", 1)] })), 6);
  assert.equal(maxHp(makeChar({ classes: [cl("Monk", 2), cl("Paladin", 2)] })), 25);
});
test("Tough feat adds two HP per level, CON applies retroactively, override wins", () => {
  const c = makeChar({ classes: [cl("Fighter", 5)], asiSelections: [{ level: 4, type: "feat", featName: "Tough", featSource: "PHB" }] });
  assert.equal(maxHp(c), 44);
  assert.equal(maxHp({ ...c, baseAbilityScores: scores({ con: 16 }) }), 59);
  assert.equal(maxHp({ ...c, maxHpOverride: 42 }), 42);
});
test("shared d8 hit dice are pooled once; paladin keeps its d10 and spent dice counted once", () => {
  const c = makeChar({ classes: [cl("Monk", 2), cl("Bard", 3), cl("Paladin", 2)], usedHitDice: { d8: 2, d10: 1 } });
  assert.deepEqual(hitDiceByType(c), { d8: { total: 5, used: 2, remaining: 3 }, d10: { total: 2, used: 1, remaining: 1 } });
  assert.equal(hitDieOf(cl("Paladin", 2)), 10);
});
test("multiclass Barbarian 1 / Bard 1 has separate 1d12 and 1d8 hit dice pools", () => {
  const c = makeChar({ classes: [cl("Barbarian", 1), cl("Bard", 1)] });
  assert.deepEqual(hitDiceByType(c), {
    d12: { total: 1, used: 0, remaining: 1 },
    d8: { total: 1, used: 0, remaining: 1 },
  });
});
test("armorCategory overrides misleading names, caps medium Dex, and recognizes unnamed shields", () => {
  const c = makeChar({ baseAbilityScores: scores({ dex: 16 }) });
  assert.equal(armorClass({ ...c, items: [item("light", 11)] }).ac, 14);
  assert.equal(armorClass({ ...c, items: [item("medium", 14)] }).ac, 16);
  assert.equal(armorClass({ ...c, items: [item("heavy", 16)] }).ac, 16);
  assert.equal(armorClass({ ...c, items: [item("light", 11), item("shield", 2)] }).ac, 16);
  assert.equal(armorClass({ ...c, items: [{ ...item("light", 11), name: "Plate" }] }).ac, 14);
  assert.equal(armorClass({ ...c, baseAbilityScores: scores({ dex: 8 }), items: [item("medium", 14)] }).ac, 13);
});
test("legacy half plate is medium; no armor uses 10+Dex", () => {
  const c = makeChar({ baseAbilityScores: scores({ dex: 16 }) });
  assert.equal(armorClass(c).ac, 13);
  assert.equal(armorClass({ ...c, items: [{ ...item("", 15), name: "Half Plate" }] }).ac, 17);
});
test("Unarmored Defense order also works when neither granting class is initial", () => {
  const c = makeChar({ classes: [cl("Fighter", 1), cl("Monk", 1), cl("Barbarian", 1)], baseAbilityScores: scores({ dex: 14, wis: 16, con: 18 }) });
  assert.equal(armorClass(c).ac, 15);
  assert.equal(armorClass({ ...c, items: [item("shield", 2)] }).ac, 14);
  const ud = grantedFeatures(c, catalog).filter(x => x.name === "Unarmored Defense");
  assert.equal(ud.length, 1);
  assert.equal(ud[0].className, "Monk");
});
test("speed uses resolved race and equipment restrictions on monk/barbarian movement", () => {
  const c = makeChar({ classes: [cl("Monk", 6)] });
  assert.equal(speed(c, { race: { speed: { walk: 35 } } }), 50);
  assert.equal(speed({ ...c, items: [item("shield")] }), 30);
  assert.equal(speed(makeChar({ classes: [cl("Barbarian", 5)], items: [item("heavy", 18)] })), 30);
  assert.equal(speed(makeChar({ classes: [cl("Barbarian", 5)], items: [item("medium", 14)] })), 40);
});
test("carrying weight includes quantity and coins, with STR capacity", () => {
  const c = makeChar({ items: [{ ...item(""), quantity: 2, weight: 30 }], pouch: { cp: 0, sp: 0, ep: 0, gp: 50, pp: 0 } });
  assert.deepEqual(carryingWeight(c), { currentWeight: 61, maxCapacity: 150, encumbered: true, heavilyEncumbered: false });
});
test("saves use first class only and total-level proficiency", () => {
  const c = makeChar({ classes: [cl("Fighter", 1), cl("Wizard", 4)] });
  const saves = savingThrows(c, proficiencySheet(c, { compendium: inMemoryCompendium() }).savingThrows);
  assert.equal(saves.str.proficient, true);
  assert.equal(saves.con.isProficient, true);
  assert.equal(saves.int.proficient, false);
  assert.equal(saves.str.bonus, 3);
  assert.equal(totalLevel(c), 5);
  assert.deepEqual([1, 5, 9, 13, 17, 20].map(proficiencyBonus), [2, 3, 4, 5, 6, 6]);
});
test("initial armor proficiencies differ from multiclass grants", () => {
  const c = makeChar({ classes: [cl("Wizard", 1), cl("Fighter", 1)] });
  const p = proficiencies(c, catalog.classes);
  assert.ok(p.armor.includes("Medium armor"));
  assert.ok(!p.armor.includes("Heavy armor"));
  assert.ok(proficiencies(makeChar({ classes: [cl("Fighter", 1)] }), catalog.classes).armor.some(x => /heavy|all armor/i.test(x)));
});
test("skills distinguish expertise and Jack of All Trades; passive trio and Observant", () => {
  const c = makeChar({ classes: [cl("Bard", 5)], baseAbilityScores: scores({ wis: 16, int: 14 }), chosenSkills: ["Perception", "Insight"], chosenExpertise: ["Perception"] });
  const row = (name: string, char = c) => skills(char, proficiencySheet(char, { compendium: inMemoryCompendium() }).skills).find(x => x.name === name)!;
  assert.equal(row("Perception").bonus, 9);
  assert.equal(row("Perception").isExpertise, true);
  assert.equal(row("Perception").halfProficiency === "Jack of All Trades", false);
  assert.equal(row("Investigation").halfProficiency === "Jack of All Trades", true);
  assert.equal(row("Investigation").bonus, 3);
  assert.deepEqual(["Perception", "Investigation", "Insight"].map(n => row(n).passiveBonus), [19, 13, 16]);
  const observant = { ...c, asiSelections: [{ level: 4, type: "feat" as const, featName: "Observant" }] };
  assert.deepEqual(["Perception", "Investigation", "Insight"].map(n => row(n, observant).passiveBonus), [24, 18, 16]);
});
test("individual half caster table vs multiclass contributions rounded per class", () => {
  for (const name of ["Paladin", "Ranger"]) {
    for (const [level, slots] of Object.entries(PHB_HALF_CASTER_SLOTS)) assert.deepEqual(multiclassSlots(makeChar({ classes: [cl(name, Number(level))] })).slots, slots);
    assert.deepEqual(multiclassSlots(makeChar({ classes: [cl(name, 5), cl("Fighter", 1)] })).slots, [4, 2]);
    assert.deepEqual(multiclassSlots(makeChar({ classes: [cl(name, 5), cl("Wizard", 1)] })).slots, [4, 2]);
  }
  assert.deepEqual(multiclassSlots(makeChar({ classes: [cl("Paladin", 3), cl("Ranger", 3)] })).slots, [3]);
  assert.deepEqual(multiclassSlots(makeChar({ classes: [cl("Paladin", 1)] })).slots, []);
  assert.deepEqual(multiclassSlots(makeChar({ classes: [cl("Ranger", 3)] })).slots, [3]);
});
test("Artificer casts from level 1 on its own table, and rounds its levels up in a multiclass sum", () => {
  const artificer = (level: number): CharacterClass => ({ className: "Artificer", source: "TCE", level });
  const slotsOf = (...classes: CharacterClass[]) => multiclassSlots(makeChar({ classes }), catalog.classes);
  assert.deepEqual(slotsOf(artificer(1)).slots, [2]);
  assert.deepEqual(slotsOf(artificer(2)).slots, [2]);
  assert.deepEqual(slotsOf(artificer(5)).slots, [4, 2]);
  assert.deepEqual(slotsOf(artificer(9)).slots, [4, 3, 2]);
  assert.deepEqual(slotsOf(artificer(17)).slots, [4, 3, 3, 3, 1]);
  assert.equal(slotsOf(artificer(1)).isSpellcaster, true);
  assert.equal(slotsOf(cl("Wizard", 3), artificer(3)).casterLevel, 5);
  assert.deepEqual(slotsOf(cl("Wizard", 3), artificer(3)).slots, [4, 3, 2]);
  assert.equal(slotsOf(cl("Wizard", 1), artificer(1)).casterLevel, 2);
  assert.deepEqual(slotsOf(cl("Wizard", 1), artificer(1)).slots, [3]);
  assert.equal(slotsOf(artificer(3), cl("Paladin", 3)).casterLevel, 3);
  assert.deepEqual(slotsOf(artificer(3), cl("Paladin", 3)).slots, [4, 2]);
});
test("third caster individual table differs from multiclass; correct subclass ability", () => {
  assert.deepEqual(multiclassSlots(makeChar({ classes: [cl("Fighter", 3, "Eldritch Knight")] })).slots, [2]);
  assert.deepEqual(multiclassSlots(makeChar({ classes: [cl("Fighter", 4, "Eldritch Knight")] })).slots, [3]);
  const c = makeChar({ classes: [cl("Fighter", 5, "Eldritch Knight"), cl("Rogue", 5, "Arcane Trickster")] });
  assert.equal(multiclassSlots(c).casterLevel, 2);
  assert.equal(spellcastingAbility(c.classes[0]), "int");
  assert.equal(spellcastingAbility(cl("Rogue", 3, "Arcane Trickster")), "int");
});
test("pact slots remain separate; lone Spellcasting class keeps individual progression despite pact", () => {
  const c = makeChar({ classes: [cl("Paladin", 5), cl("Warlock", 5)] });
  assert.deepEqual(multiclassSlots(c).slots, [4, 2]);
  assert.deepEqual(multiclassSlots(c).pact, { count: 2, level: 3 });
  assert.deepEqual(pactSlots(c), { count: 2, level: 3 });
  const ek = makeChar({ classes: [cl("Fighter", 5, "Eldritch Knight"), cl("Warlock", 5)] });
  assert.deepEqual(multiclassSlots(ek).slots, PHB_THIRD_CASTER_SLOTS[5]);
  assert.deepEqual(multiclassSlots(ek).pact, { count: 2, level: 3 });
  assert.deepEqual(multiclassSlots(makeChar()).slots, []);
  assert.equal(pactSlots(makeChar()), null);
});
test("Channel Divinity class thresholds, never combined character level", () => {
  for (const [level, uses] of [[2, 1], [5, 1], [6, 2], [17, 2], [18, 3]]) {
    assert.equal(grantedFeatures(makeChar({ classes: [cl("Cleric", level), cl("Paladin", 3)] }), catalog).find(x => x.name === "Channel Divinity")!.max, uses);
  }
  assert.equal(grantedFeatures(makeChar({ classes: [cl("Cleric", 1), cl("Paladin", 2)] }), catalog).filter(x => x.name === "Channel Divinity").length, 0);
});
test("Extra Attack keeps fighter progression, Channel Divinity effects, excludes optional features", () => {
  const f = grantedFeatures(makeChar({ classes: [cl("Fighter", 11), cl("Barbarian", 5), cl("Cleric", 2)] }), catalog);
  assert.equal(f.filter(x => x.name === "Extra Attack").length, 1);
  assert.equal(f.find(x => x.name === "Extra Attack")!.attacks, 3);
  assert.ok(f.some(x => x.name === "Channel Divinity: Turn Undead"));
  assert.ok(!f.some(x => x.name.includes("Harness Divine Power")));
});
test("granted features resolve actual race/subrace/background/class/subclass/feat identities", () => {
  const c = makeChar({ race: { name: "Elf", source: "PHB", subraceName: "High", subraceSource: "PHB" }, background: { name: "Soldier", source: "PHB" }, classes: [cl("Fighter", 3, "Champion")], asiSelections: [{ level: 1, type: "feat", featName: "Tough", featSource: "PHB" }] });
  const f = grantedFeatures(c, catalog);
  for (const origin of ["Race", "Subrace", "Background", "Class", "Subclass", "Feat"]) assert.ok(f.some(x => x.origin === origin), origin);
  assert.equal(f.find(x => x.name === "Tough")!.source, "PHB");
  assert.equal(new Set(f.map(x => x.id)).size, f.length);
});

test("skills includes racial and background proficiencies and matches case-insensitively", () => {
  // 1. Bugbear has Stealth without picking it; Acolyte has Insight & Religion
  const bugbearAcolyte = makeChar({
    race: { name: "Bugbear", source: "VGM" },
    background: { name: "Acolyte", source: "PHB" },
    chosenSkills: ["animal handling", "sleight of hand"], // Lowercase input!
  });

  const skillList = skills(bugbearAcolyte, proficiencySheet(bugbearAcolyte, { compendium: integratedTestCompendium() }).skills);
  const byName = (n: string) => skillList.find(s => s.name === n);

  // Bugbear trait
  assert.equal(byName("Stealth")?.isProficient, true);
  // Background skills
  assert.equal(byName("Insight")?.isProficient, true);
  assert.equal(byName("Religion")?.isProficient, true);
  // Case-insensitive chosen skills
  assert.equal(byName("Animal Handling")?.isProficient, true);
  assert.equal(byName("Sleight of Hand")?.isProficient, true);
  // Non-proficient skill
  assert.equal(byName("Athletics")?.isProficient, false);
});

test("grantedFeatures respects optional feature replacements (e.g., TCoE Ranger)", () => {
  const baseRanger = makeChar({
    classes: [cl("Ranger", 1)],
    optionalFeatureReplacements: {},
  });
  const baseFeatures = grantedFeatures(baseRanger, catalog);
  assert.ok(baseFeatures.some(f => f.name === "Favored Enemy"));
  assert.ok(!baseFeatures.some(f => f.name === "Favored Foe"));
  assert.ok(baseFeatures.some(f => f.name === "Natural Explorer"));
  assert.ok(!baseFeatures.some(f => f.name === "Deft Explorer"));

  // Now enable Favored Foe and Deft Explorer replacements
  const tashaRanger = makeChar({
    classes: [cl("Ranger", 1)],
    optionalFeatureReplacements: {
      "Favored Foe": true,
      "Deft Explorer": true,
    },
  });
  const tashaFeatures = grantedFeatures(tashaRanger, catalog);
  assert.ok(!tashaFeatures.some(f => f.name === "Favored Enemy"));
  assert.ok(tashaFeatures.some(f => f.name === "Favored Foe"));
  assert.ok(!tashaFeatures.some(f => f.name === "Natural Explorer"));
  assert.ok(tashaFeatures.some(f => f.name === "Deft Explorer"));
});

test("race skill picks are Proficiency Choices from the Catalog's choice grants, in any book, and trait text offers none", () => {
  const compendium = integratedTestCompendium();
  const skillOffer = (race: { name: string; source: string }) =>
    proficiencyChoiceOffers(makeChar({ race }), { compendium }).filter((offer) => offer.id.includes("#skills:"));

  // Lizardfolk (Volo's Guide): 2 from its five-skill list.
  const liz = skillOffer({ name: "Lizardfolk", source: "VGM" });
  assert.equal(liz.length, 1);
  assert.equal(liz[0].choose, 2);
  assert.deepEqual(liz[0].options.map((o) => o.name), ["Animal Handling", "Nature", "Perception", "Stealth", "Survival"]);

  // Base Half-Elf has Skill Versatility: 2 from all 18 skills.
  const heOffer = skillOffer({ name: "Half-Elf", source: "PHB" });
  assert.equal(heOffer.length, 1);
  assert.equal(heOffer[0].choose, 2);
  assert.equal(heOffer[0].options.length, 18);

  // Mark of Detection Half-Elf has no Skill Versatility.
  const mark = proficiencyChoiceOffers(
    makeChar({ race: { name: "Half-Elf", source: "PHB", subraceName: "Mark of Detection", subraceSource: "ERLW" } }),
    { compendium },
  ).filter((offer) => offer.id.includes("#skills:"));
  assert.equal(mark.length, 0);

  // A race that only names its skill pick in trait text is offered nothing: the text is not a grant.
  const textOnly = inMemoryCompendium({
    races: [
      {
        name: "Custom Beastfolk",
        source: "Homebrew",
        size: ["Medium"],
        speed: { walk: 30 },
        abilityScoreIncrease: [],
        darkvision: null,
        traits: [
          {
            name: "Wild Senses",
            description: "You gain proficiency with two of the following skills of your choice: Perception, Stealth, or Survival.",
          },
        ],
        languages: [],
        subraces: [],
        description: "Placeholder description for the Custom Beastfolk.",
      },
    ],
  });
  assert.deepEqual(proficiencyChoiceOffers(makeChar({ race: { name: "Custom Beastfolk", source: "Homebrew" } }), { compendium: textOnly }).filter((offer) => offer.id.includes("#skills:")), []);
});

test("grantedFeatures includes both base race traits and subrace traits", () => {
  const hillDwarf = makeChar({
    race: { name: "Dwarf", source: "PHB", subraceName: "Hill", subraceSource: "PHB" },
    classes: [cl("Fighter", 1)],
  });
  const dwarfFeatures = grantedFeatures(hillDwarf, catalog);
  assert.ok(dwarfFeatures.some(f => f.name === "Dwarven Resilience" && f.origin === "Race"));
  assert.ok(dwarfFeatures.some(f => f.name === "Stonecunning" && f.origin === "Race"));
  assert.ok(dwarfFeatures.some(f => f.name === "Dwarven Toughness" && f.origin === "Subrace"));

  const highElf = makeChar({
    race: { name: "Elf", source: "PHB", subraceName: "High", subraceSource: "PHB" },
    classes: [cl("Wizard", 1)],
  });
  const elfFeatures = grantedFeatures(highElf, catalog);
  assert.ok(elfFeatures.some(f => f.name === "Keen Senses" && f.origin === "Race"));
  assert.ok(elfFeatures.some(f => f.name === "Elf Weapon Training" && f.origin === "Subrace"));
});

test("grantedFeatures with lineageReplacement suppresses base/subrace traits and grants lineage traits", () => {
  const dhampirDwarf = makeChar({
    race: { name: "Dwarf", source: "PHB", subraceName: "Hill", subraceSource: "PHB" },
    lineageReplacement: "Dhampir",
    classes: [cl("Fighter", 1)],
  });
  const features = grantedFeatures(dhampirDwarf, catalog);

  // Suppressed base race & subrace traits
  assert.ok(!features.some(f => f.name === "Dwarven Resilience"), "Base trait should be suppressed");
  assert.ok(!features.some(f => f.name === "Stonecunning"), "Base trait should be suppressed");
  assert.ok(!features.some(f => f.name === "Dwarven Toughness"), "Subrace trait should be suppressed");

  // Granted lineage traits
  assert.ok(features.some(f => f.name === "Vampiric Bite" && f.origin === "Race"), "Lineage trait Vampiric Bite should be present");
  assert.ok(features.some(f => f.name === "Spider Climb" && f.origin === "Race"), "Lineage trait Spider Climb should be present");
  assert.ok(features.some(f => f.name === "Deathless Nature" && f.origin === "Race"), "Lineage trait Deathless Nature should be present");
});
