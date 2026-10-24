import test from "node:test";
import assert from "node:assert/strict";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { classBaseProficiencies } from "../src/rules/proficiencySources/classBase.ts";
import { addMulticlassLevel, removeClassLevel } from "../src/rules/builderTransitions.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { inMemoryCompendium, integratedTestCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";
import { wardenClass } from "./proficiencySheetFixture.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
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
  assert.equal(beta.skillChoices, undefined);

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
  assert.equal(rogue.skillChoices, undefined);
  assert.ok(names(proficiencySheet(rogue, { compendium }).tools).includes("Thieves' Tools"));

  const artificer = proficiencySheet(adding("Artificer", "TCE"), { compendium });
  assert.ok(names(artificer.tools).includes("Thieves' Tools"));
  assert.ok(names(artificer.tools).includes("Tinker's Tools"));
});

// An invented class whose record grants one skill from a short list as a multiclass proficiency.
const SENTINEL = "Sentinel";
const GAMMA = "GAMMA";
const sentinelCompendium = () =>
  inMemoryCompendium({
    classes: [
      wardenClass({
        name: SENTINEL,
        source: GAMMA,
        multiclassing: { proficienciesGained: { skills: [{ choose: { from: ["stealth", "insight", "medicine"], count: 1 } }] } },
      }),
    ],
  });
const sentinelEntry: CharacterClass = { className: SENTINEL, source: GAMMA, level: 1 };
const sentinelOffers = (character: Character, compendium = sentinelCompendium()) =>
  proficiencyChoiceOffers(character, { compendium }).filter((offer) => offer.traitName.endsWith("multiclass: Skill"));

test("a later class's multiclass skill pick is offered, lands on the sheet's skills, and is not offered a held skill", () => {
  const compendium = sentinelCompendium();
  const character = makeChar({ classes: [fighter, sentinelEntry] });
  const [offer] = sentinelOffers(character, compendium);
  assert.ok(offer, "the later class is offered its skill pick");
  assert.equal(offer.traitName, "Sentinel multiclass: Skill");
  assert.equal(offer.origin, "class");
  assert.equal(offer.choose, 1);
  assert.deepEqual(offer.options.map((option) => option.name).sort(), ["Insight", "Medicine", "Stealth"]);

  const picked = { ...character, proficiencyPicks: { [offer.id]: ["Medicine"] } };
  assert.deepEqual(names(proficiencySheet(picked, { compendium }).skills), ["Medicine"]);

  const holding = makeChar({ classes: [fighter, sentinelEntry], chosenSkills: ["Stealth"] });
  const [heldOffer] = sentinelOffers(holding, compendium);
  assert.deepEqual(heldOffer.options.map((option) => option.name).sort(), ["Insight", "Medicine"]);
});

test("the first class is never offered the multiclass skill pick", () => {
  assert.deepEqual(sentinelOffers(makeChar({ classes: [sentinelEntry] })), []);
});

test("removing the later class releases its skill pick, with a review notice", () => {
  const compendium = sentinelCompendium();
  const character = makeChar({ classes: [fighter, sentinelEntry] });
  const [offer] = sentinelOffers(character, compendium);
  const picked = { ...character, proficiencyPicks: { [offer.id]: ["Stealth"] } };

  const removed = removeClassLevel(picked, SENTINEL, compendium);
  assert.equal(removed.proficiencyPicks, undefined);
  assert.match(removed.needsReview?.join("\n") ?? "", /Stealth removed from Multiclass Proficiencies/);
  assert.deepEqual(sentinelOffers(removed, compendium), []);
});

test("a later class that becomes the first class releases its skill pick", () => {
  const compendium = sentinelCompendium();
  const character = makeChar({ classes: [fighter, sentinelEntry] });
  const [offer] = sentinelOffers(character, compendium);
  const promoted = makeChar({ classes: [sentinelEntry], proficiencyPicks: { [offer.id]: ["Stealth"] } });
  assert.equal(reconcile(promoted, compendium).proficiencyPicks, undefined);
});

test("the SRD Baseline offers the multiclass skill pick to Bard, Ranger and Rogue as a later class, and to no other class", () => {
  const compendium = srdBaselineCompendium();
  const offered: Record<string, number> = {};
  for (const cls of compendium.for().classes()) {
    if (cls.name === "Fighter") continue;
    const character = makeChar({ classes: [fighter, { className: cls.name, source: cls.source, level: 1 }] });
    const count = sentinelOffers(character, compendium).length;
    if (count > 0) offered[cls.name] = count;
  }
  assert.deepEqual(offered, { Bard: 1, Ranger: 1, Rogue: 1 });

  const ranger = makeChar({ classes: [fighter, { className: "Ranger", source: "PHB", level: 1 }] });
  const [rangerOffer] = proficiencyChoiceOffers(ranger, { compendium }).filter((offer) => offer.traitName.endsWith("multiclass: Skill"));
  assert.deepEqual(
    rangerOffer.options.map((option) => option.name),
    ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"],
  );
});

test("an old save holding an empty multiclass skill entry loads without it", () => {
  const old = makeChar({
    classes: [fighter, { className: "Rogue", source: "PHB", level: 1 }],
    skillChoices: [{ id: "multiclass_skill_rogue", origin: "class", choose: 1, from: ["Stealth"], picked: [] }],
  });
  assert.equal(reconcile(old, srdBaselineCompendium()).skillChoices, undefined);
});
