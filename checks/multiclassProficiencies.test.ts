import test from "node:test";
import assert from "node:assert/strict";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { classBaseProficiencies } from "../src/rules/proficiencySources/classBase.ts";
import { addMulticlassLevel } from "../src/rules/builderTransitions.ts";
import { inMemoryCompendium, integratedTestCompendium, makeChar } from "./testUtils.ts";
import { wardenClass } from "./proficiencySheetFixture.ts";
import type { CharacterClass } from "../src/types/character.ts";
import type { ClassData } from "../src/types/dnd5e.ts";

// Two invented classes share the name "Wardcaller" but come from different sources, with different
// multiclass proficiencies. Nothing here is real 5e text.

const ALPHA = "ALPHA";
const BETA = "BETA";

const alphaWardcaller = (overrides: Partial<ClassData> = {}): ClassData =>
  wardenClass({
    name: "Wardcaller",
    source: ALPHA,
    multiclassing: { proficienciesGained: { armor: ["light"], weapons: ["simple"] } },
    ...overrides,
  });

const betaWardcaller = (overrides: Partial<ClassData> = {}): ClassData =>
  wardenClass({
    name: "Wardcaller",
    source: BETA,
    multiclassing: {
      proficienciesGained: {
        armor: ["heavy", { proficiency: "shield", full: "shields (invented full text)" }],
        weapons: ["{@item ember whip|BETA|ember whip}"],
        tools: ["{@item glass chisel|BETA}"],
        skills: [{ choose: { from: ["stealth", "insight"], count: 1 } }],
      },
    },
    ...overrides,
  });

const bothSources = () => inMemoryCompendium({ classes: [alphaWardcaller(), betaWardcaller()] });

const fighter: CharacterClass = { className: "Fighter", source: "PHB", level: 1 };
const wardcaller = (source: string): CharacterClass => ({ className: "Wardcaller", source, level: 1 });

const names = (entries: SheetEntry[]) => entries.map((e) => e.name).sort();

test("a later class's armor and weapons come from the Catalog class the entry names, not the first class of the same name", () => {
  const compendium = bothSources();
  const alpha = proficiencySheet(makeChar({ classes: [fighter, wardcaller(ALPHA)] }), { compendium });
  assert.deepEqual(names(alpha.armor), ["Light armor"]);
  assert.deepEqual(names(alpha.weapons), ["Simple weapons"]);

  const beta = proficiencySheet(makeChar({ classes: [fighter, wardcaller(BETA)] }), { compendium });
  assert.deepEqual(names(beta.armor), ["Heavy armor", "Shields"]);
  assert.deepEqual(names(beta.weapons), ["Ember whip"]);
});

test("the multiclass grants of a later class are read from the entry's own source in the base proficiency reader", () => {
  const classes = [alphaWardcaller(), betaWardcaller()];
  const beta = classBaseProficiencies(makeChar({ classes: [fighter, wardcaller(BETA)] }), classes);
  assert.deepEqual(beta.armor.sort(), ["Heavy armor", "Shields"]);
  const alpha = classBaseProficiencies(makeChar({ classes: [fighter, wardcaller(ALPHA)] }), classes);
  assert.deepEqual(alpha.armor, ["Light armor"]);
});

test("a later class's multiclass grants are read from the Catalog whatever the active books", () => {
  const sheet = proficiencySheet(makeChar({ classes: [fighter, wardcaller(BETA)] }), {
    compendium: bothSources(),
    activeBooks: [ALPHA],
  });
  assert.deepEqual(names(sheet.armor), ["Heavy armor", "Shields"]);
});

test("adding a class records the multiclass grants of the Catalog class the entry names, for each source", () => {
  const compendium = bothSources();
  const base = makeChar({ classes: [fighter] });

  const beta = addMulticlassLevel(base, "Wardcaller", BETA, { compendium });
  assert.deepEqual(beta.multiclassProficiencies, [
    { className: "Wardcaller", armor: ["Heavy armor", "Shields"], weapons: ["Ember whip"], tools: ["Glass chisel"] },
  ]);
  assert.deepEqual(
    beta.skillChoices?.map((sc) => ({ id: sc.id, choose: sc.choose, from: sc.from })),
    [{ id: "multiclass_skill_wardcaller", choose: 1, from: ["Stealth", "Insight"] }],
  );

  const alpha = addMulticlassLevel(base, "Wardcaller", ALPHA, { compendium });
  assert.deepEqual(alpha.multiclassProficiencies, [{ className: "Wardcaller", armor: ["Light armor"], weapons: ["Simple weapons"] }]);
  assert.equal(alpha.skillChoices, undefined);
});

test("a class whose record has no multiclass grants records an empty entry, and a class with no multiclass record records nothing", () => {
  const compendium = inMemoryCompendium({
    classes: [
      wardenClass({ name: "Gallowsmith", source: ALPHA, multiclassing: { requirements: {} } }),
      wardenClass({ name: "Mourner", source: ALPHA }),
      alphaWardcaller(),
    ],
  });
  const base = makeChar({ classes: [fighter] });
  const gallows = addMulticlassLevel(base, "Gallowsmith", ALPHA, { compendium });
  assert.deepEqual(gallows.multiclassProficiencies, [{ className: "Gallowsmith" }]);
  assert.deepEqual(names(proficiencySheet(gallows, { compendium }).armor), []);
  assert.equal(addMulticlassLevel(base, "Mourner", ALPHA, { compendium }).multiclassProficiencies, undefined);
  assert.equal(addMulticlassLevel(base, "Nobody", ALPHA, { compendium }).multiclassProficiencies, undefined);
});

test("a later class names its skill choice from the list its Catalog record gives", () => {
  const compendium = bothSources();
  const beta = addMulticlassLevel(makeChar({ classes: [fighter] }), "Wardcaller", BETA, { compendium });
  assert.deepEqual(beta.skillChoices?.[0]?.from, ["Stealth", "Insight"]);
});

test("a later class the compendium lacks takes the SRD Baseline's multiclass proficiencies", () => {
  const compendium = inMemoryCompendium({});
  const monk = addMulticlassLevel(makeChar({ classes: [fighter] }), "Monk", "PHB", { compendium });
  assert.deepEqual(monk.multiclassProficiencies?.find((p) => p.className === "Monk")?.weapons, ["Simple weapons", "Shortswords"]);
});

test("the integrated Monk, Rogue and Artificer add their multiclass proficiencies from the Catalog", () => {
  const compendium = integratedTestCompendium();
  const adding = (className: string, source: string) => addMulticlassLevel(makeChar({ classes: [fighter] }), className, source, { compendium });

  const monk = adding("Monk", "PHB");
  assert.deepEqual(monk.multiclassProficiencies?.find((p) => p.className === "Monk")?.weapons, ["Simple weapons", "Shortswords"]);

  const rogue = adding("Rogue", "PHB");
  assert.equal(rogue.skillChoices?.[0]?.id, "multiclass_skill_rogue");
  assert.ok(rogue.skillChoices?.[0]?.from.includes("Stealth"));
  assert.ok(!rogue.skillChoices?.[0]?.from.includes("Religion"));
  assert.ok(names(proficiencySheet(rogue, { compendium }).tools).includes("Thieves' Tools"));

  const artificer = proficiencySheet(adding("Artificer", "TCE"), { compendium });
  assert.ok(names(artificer.tools).includes("Thieves' Tools"));
  assert.ok(names(artificer.tools).includes("Tinker's Tools"));
});

test("the integrated Ranger's multiclass skill choice comes from its Catalog record", () => {
  const compendium = integratedTestCompendium();
  const ranger = addMulticlassLevel(makeChar({ classes: [fighter] }), "Ranger", "PHB", { compendium });
  assert.deepEqual(
    ranger.skillChoices?.map((sc) => ({ id: sc.id, choose: sc.choose, from: sc.from })),
    [
      {
        id: "multiclass_skill_ranger",
        choose: 1,
        from: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"],
      },
    ],
  );
});
