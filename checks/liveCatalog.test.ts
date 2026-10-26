import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import type { Character } from "../src/types/character.ts";
import type { ClassData, FeatData, ProficiencyGrant, SubclassData } from "../src/types/dnd5e.ts";
import { createCompendium, type Compendium } from "../src/services/compendium.ts";
import { isCatalogStale, REQUIRED_CATALOG_FORMAT, type CompendiumCollections } from "../src/services/compendiumStorage.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { poolNames, type ChoiceProficiencyGrant } from "../src/rules/proficiencyPools.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { STARTING_EQUIPMENT_TYPES } from "../src/rules/startingEquipmentTypes.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import { makeChar } from "./testUtils.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { isSpellAvailableForClass, profileSpellContext } from "../src/rules/spellcasting.ts";
import { initiativeCoverageGaps } from "../dnd5eToolsScrap/src/grants/initiative-coverage.ts";
import { gapName } from "../dnd5eToolsScrap/src/grants/coverage.ts";
import type { TrackedData } from "../dnd5eToolsScrap/src/grants/subjects.ts";
import { REVIEWED_NO_INITIATIVE_BONUS, REVIEWED_NO_INITIATIVE_BONUS_LIVE_ONLY } from "../dnd5eToolsScrap/src/overrides/initiative-bonuses.ts";

// Checks against the Integrated Catalog the in-app sync builds, read from the cache that
// `npm run catalog:live` writes. Without the cache every test here is skipped. The live check runs only
// through `npm run check:live` (which sets LIVE_CATALOG_CHECK=1): it is kept out of check:all so a live
// catalog problem blocks that check only when it is run on purpose. Only ids, names and counts are read
// from the catalog: no 5e prose is written here.

const CACHE_FILE = new URL("../.cache/live-catalog/catalog.json", import.meta.url);
const SKIP = !existsSync(CACHE_FILE)
  ? "no live catalog cache: run npm run catalog:live first"
  : process.env.LIVE_CATALOG_CHECK !== "1"
    ? "the live catalog check runs through npm run check:live"
    : false;
const LEVEL = 20;

interface LiveCatalog {
  collections: CompendiumCollections;
  compendium: Compendium;
}

function loadLive(): LiveCatalog {
  const collections = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as CompendiumCollections;
  return { collections, compendium: createCompendium(collections) };
}

const printKey = (cls: Pick<ClassData, "name" | "source">) => `${cls.name} (${cls.source})`;

/** A character holding one class print at LEVEL, with the given subclass when there is one. */
function holding(cls: ClassData, subclass?: SubclassData): Character {
  return makeChar({
    classes: [
      {
        className: cls.name,
        source: cls.source,
        level: LEVEL,
        ...(subclass ? { subclassName: subclass.name, subclassSource: subclass.source } : {}),
      },
    ],
  });
}

interface ChoiceOwners {
  /** Choice id -> class print -> a holder character whose offers include the id. */
  owners: Map<string, Map<string, Character>>;
  /** Holders whose offers could not be read, with the error. */
  unreadable: string[];
}

/** Every Proficiency Choice id offered to a holder of each class print and subclass. */
function choiceOwners(live: LiveCatalog): ChoiceOwners {
  const owners = new Map<string, Map<string, Character>>();
  const unreadable: string[] = [];
  for (const cls of live.compendium.for().classes()) {
    for (const subclass of [undefined, ...cls.subclasses]) {
      const character = holding(cls, subclass);
      const holder = `${printKey(cls)}${subclass ? ` / ${subclass.name} (${subclass.source})` : ""}`;
      let offers;
      try {
        offers = proficiencyChoiceOffers(character, { compendium: live.compendium });
      } catch (error) {
        unreadable.push(`${holder}: ${(error as Error).message}`);
        continue;
      }
      for (const offer of offers) {
        const byPrint = owners.get(offer.id) ?? new Map<string, Character>();
        if (!byPrint.has(printKey(cls))) byPrint.set(printKey(cls), character);
        owners.set(offer.id, byPrint);
      }
    }
  }
  return { owners, unreadable };
}

/** Records picks the way the app's picker does, one option at a time, and returns the counter after each. */
function pickInOrder(character: Character, offer: AvailableRuleChoice, live: LiveCatalog): number[] {
  let picked = character;
  const counters: number[] = [];
  for (const option of offer.options.slice(0, Math.min(offer.choose, offer.options.length))) {
    picked = pickRuleChoice(picked, offer, option.name, live.compendium);
    counters.push(picked.proficiencyPicks?.[offer.id]?.length ?? 0);
  }
  return counters;
}

/** The grants in a catalog record, nested grants included (feature options and subclass features too). */
function grantsIn(value: unknown, into: ProficiencyGrant[] = []): ProficiencyGrant[] {
  if (Array.isArray(value)) {
    for (const item of value) grantsIn(item, into);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "grants" && Array.isArray(child)) {
        for (const grant of child) if (grant && typeof (grant as { id?: unknown }).id === "string") into.push(grant as ProficiencyGrant);
      }
      grantsIn(child, into);
    }
  }
  return into;
}

/** Every record that can carry grants, by kind, for the catalog-wide checks. */
function grantOwnerRecords(collections: CompendiumCollections): Array<[string, { name?: string; source?: string }]> {
  const groups: Array<[string, unknown[]]> = [
    ["race", collections.races],
    ["class", collections.classes],
    ["background", collections.backgrounds],
    ["feat", collections.feats],
    ["option", collections.optionsAndFeatures],
  ];
  return groups.flatMap(([kind, records]) => (records as Array<{ name?: string; source?: string }>).map((record) => [kind, record] as [string, { name?: string; source?: string }]));
}

const live = SKIP ? undefined : loadLive();
const choices = SKIP ? { owners: new Map<string, Map<string, Character>>(), unreadable: [] as string[] } : choiceOwners(live!);
const collidingIds = [...choices.owners].filter(([, byPrint]) => byPrint.size > 1);

test("live catalog: the cache is at the catalog format the app requires", { skip: SKIP }, () => {
  assert.equal(isCatalogStale(live!.collections), false, `catalog format ${live!.collections.catalogFormat} is below ${REQUIRED_CATALOG_FORMAT}`);
});

test("live catalog: every expertise mark is on a skills grant", { skip: SKIP }, () => {
  const misplaced: string[] = [];
  for (const [kind, record] of grantOwnerRecords(live!.collections)) {
    for (const grant of grantsIn(record)) {
      if (grant.expertise === true && grant.category !== "skills") misplaced.push(`${kind} ${record.name} (${record.source}): ${grant.id}`);
    }
  }
  assert.deepEqual(misplaced, []);
});

test("live catalog: every grant id is unique within its owner record", { skip: SKIP }, () => {
  const duplicates: string[] = [];
  for (const [kind, record] of grantOwnerRecords(live!.collections)) {
    const seen = new Map<string, number>();
    for (const grant of grantsIn(record)) seen.set(grant.id, (seen.get(grant.id) ?? 0) + 1);
    for (const [id, count] of seen) {
      if (count > 1) duplicates.push(`${kind} ${record.name} (${record.source}): ${id} x${count}`);
    }
  }
  assert.deepEqual(duplicates, [], "grant ids repeated inside one owner");
});

test("live catalog: every class print and subclass offers its Proficiency Choices without throwing", { skip: SKIP }, () => {
  assert.deepEqual(choices.unreadable, [], "holders whose Proficiency Choices cannot be read");
});

test("live catalog: every weapons Proficiency Choice pool reads its names", { skip: SKIP }, () => {
  const items = live!.compendium.for().items();
  const failing = new Map<string, string>();
  for (const [, record] of grantOwnerRecords(live!.collections)) {
    for (const grant of grantsIn(record)) {
      if (grant.kind !== "choice" || grant.category !== "weapons") continue;
      try {
        poolNames(grant as ChoiceProficiencyGrant, items);
      } catch (error) {
        failing.set(grant.id, (error as Error).message);
      }
    }
  }
  assert.deepEqual([...failing].map(([id, message]) => `${id}: ${message}`), [], "weapons pools that cannot be read");
});

test("live catalog: every class starting equipment entry names a catalog item or a known generic type", { skip: SKIP }, () => {
  const classes = live!.compendium.for().classes().filter((cls) => (cls.startingEquipment?.length ?? 0) > 0);
  assert.ok(classes.length > 0, "no class carries starting equipment: the check below would pass vacuously");

  const itemNames = new Set(live!.compendium.for().items().map((item) => item.name.toLowerCase()));
  const unresolved: string[] = [];
  for (const cls of classes) {
    for (const [index, slot] of (cls.startingEquipment ?? []).entries()) {
      if (slot.kind === "unrecognised") {
        unresolved.push(`${printKey(cls)} slot ${index}: a slot of an unrecognised shape`);
        continue;
      }
      const options = slot.kind === "fixed" ? [{ letter: "", entries: slot.entries }] : slot.options;
      for (const option of options) {
        const where = `${printKey(cls)} slot ${index}${option.letter ? ` option ${option.letter}` : ""}`;
        for (const entry of option.entries) {
          if (entry.kind === "item" && !itemNames.has(entry.name.toLowerCase())) {
            unresolved.push(`${where}: no item named ${entry.name}`);
          } else if (entry.kind === "type" && !STARTING_EQUIPMENT_TYPES.has(entry.equipmentType)) {
            unresolved.push(`${where}: no known generic type ${entry.equipmentType}`);
          } else if (entry.kind === "unrecognised") {
            unresolved.push(`${where}: an entry of an unrecognised shape`);
          }
        }
      }
    }
  }
  assert.deepEqual(unresolved, [], "starting equipment entries that do not resolve");
});

test("live catalog: the catalog has Proficiency Choice ids shared by class prints (what the next checks guard)", { skip: SKIP }, () => {
  assert.ok(collidingIds.length > 0, "no shared Proficiency Choice id: the check below would pass vacuously");
});

for (const [id, byPrint] of collidingIds) {
  for (const [print, character] of byPrint) {
    test(`live catalog: ${id} keeps a recorded pick for a holder of ${print}`, { skip: SKIP }, () => {
      const compendium = live!.compendium;
      const offer = proficiencyChoiceOffers(character, { compendium }).find((choice) => choice.id === id);
      assert.ok(offer, `${print} is offered the choice`);
      const option = offer.options[0]?.name;
      assert.ok(option, "the choice has an option to pick");

      const picked = pickRuleChoice(character, offer, option, compendium);
      assert.deepEqual(picked.proficiencyPicks?.[id], [option], "the pick is recorded");
      assert.deepEqual(picked.needsReview ?? [], [], "the pick is not released for review");
      assert.deepEqual(reconcile(picked, compendium).proficiencyPicks?.[id], [option], "the pick survives a reconcile");
    });
  }
}

const samuraiFighters = SKIP ? [] : live!.compendium.for().classes()
  .filter((cls) => cls.name === "Fighter")
  .flatMap((cls) => cls.subclasses.filter((sc) => sc.name === "Samurai").map((sc) => ({ cls, sc })));
const kenseiMonks = SKIP ? [] : live!.compendium.for().classes()
  .filter((cls) => cls.name === "Monk")
  .flatMap((cls) => cls.subclasses.filter((sc) => sc.name.includes("Kensei")).map((sc) => ({ cls, sc })));

test("live catalog: the Fighter/Samurai and Monk/Kensei prints exist to combine", { skip: SKIP }, () => {
  assert.ok(samuraiFighters.length > 0, "no Fighter with a Samurai subclass");
  assert.ok(kenseiMonks.length > 0, "no Monk with a Kensei subclass");
});

for (const fighter of samuraiFighters) {
  for (const monk of kenseiMonks) {
    const label = `Fighter (${fighter.cls.source})/Samurai (${fighter.sc.source}) + Monk (${monk.cls.source})/Kensei (${monk.sc.source})`;
    test(`live catalog: ${label} can pick every offered Proficiency Choice and the counter moves`, { skip: SKIP }, () => {
      const compendium = live!.compendium;
      const character = makeChar({
        classes: [
          { className: fighter.cls.name, source: fighter.cls.source, level: LEVEL, subclassName: fighter.sc.name, subclassSource: fighter.sc.source },
          { className: monk.cls.name, source: monk.cls.source, level: LEVEL, subclassName: monk.sc.name, subclassSource: monk.sc.source },
        ],
      });
      const offers = proficiencyChoiceOffers(character, { compendium });
      assert.ok(offers.length > 0, "the multiclass character is offered Proficiency Choices");
      const failures: string[] = [];
      for (const offer of offers) {
        if (offer.options.length === 0) {
          failures.push(`${offer.id}: no option to pick`);
          continue;
        }
        const counters = pickInOrder(character, offer, live!);
        const expected = counters.map((_, index) => Math.min(index + 1, offer.choose));
        if (counters.join(",") !== expected.join(",")) {
          failures.push(`${offer.id} (choose ${offer.choose}): counter ${counters.join(",")}, expected ${expected.join(",")}`);
        }
      }
      assert.deepEqual(failures, [], "offered choices that cannot be picked, or whose counter does not move");
    });
  }
}

// Initiative Bonuses (ADR 0016): the rules that add an ability modifier to initiative carry it in the catalog the in-app sync builds.
const LIVE_INITIATIVE_BONUSES: Array<[string, { kind: "ability"; ability: "cha" | "int" | "wis" }]> = [
  ["Rakish Audacity", { kind: "ability", ability: "cha" }],
  ["Tactical Wit", { kind: "ability", ability: "int" }],
  ["Temporal Awareness", { kind: "ability", ability: "int" }],
  ["Dread Ambusher", { kind: "ability", ability: "wis" }],
];

for (const [name, expected] of LIVE_INITIATIVE_BONUSES) {
  test(`live catalog: ${name} carries the ${expected.ability} Initiative Bonus`, { skip: SKIP }, () => {
    const features = SKIP ? [] : live!.collections.classes.flatMap((cls) => [
      ...cls.features,
      ...cls.subclasses.flatMap((sc) => sc.features),
    ]).filter((feature) => feature.name === name);
    assert.ok(features.length > 0, `no ${name} feature in the catalog`);
    assert.deepEqual(features.map((feature) => feature.initiativeBonus), features.map(() => expected));
  });
}

test("live catalog: a Swashbuckler 3 with DEX 14 and CHA 16 has initiative +5, from Rakish Audacity", { skip: SKIP }, () => {
  const rogue = SKIP ? undefined : live!.compendium.for().classes().find((cls) => cls.name === "Rogue" && cls.subclasses.some((sc) => sc.name === "Swashbuckler"));
  assert.ok(rogue, "no Rogue with a Swashbuckler subclass");
  const swashbuckler = rogue.subclasses.find((sc) => sc.name === "Swashbuckler")!;
  const character = makeChar({
    classes: [{ className: rogue.name, source: rogue.source, level: 3, subclassName: swashbuckler.name, subclassSource: swashbuckler.source }],
    baseAbilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 16 },
  });
  const evaluated = evaluateCharacter(character, { compendium: live!.compendium });
  assert.equal(evaluated.initiative, 5);
  assert.deepEqual(evaluated.initiativeBreakdown, [
    { label: "Dexterity", value: 2 },
    { label: "Rakish Audacity", value: 3 },
  ]);
});

test("live catalog: each Alert print carries the Initiative Bonus its own text gives (2014: +5; 2024: the proficiency bonus)", { skip: SKIP }, () => {
  const alerts = SKIP ? [] : live!.collections.feats.filter((feat) => feat.name === "Alert");
  assert.ok(alerts.length > 0, "no Alert feat in the catalog");
  const expected: Record<string, unknown> = { PHB: { kind: "flat", value: 5 }, XPHB: { kind: "proficiency" } };
  assert.deepEqual(
    alerts.map((feat) => [feat.source, feat.initiativeBonus]),
    alerts.map((feat) => [feat.source, expected[feat.source]]),
  );
});

test("live catalog: every Aura of the Sentinel carries a proficiency Initiative Bonus", { skip: SKIP }, () => {
  const auras = SKIP ? [] : live!.collections.classes.flatMap((cls) => cls.subclasses.flatMap((sc) => sc.features)).filter((feature) => feature.name === "Aura of the Sentinel");
  assert.ok(auras.length > 0, "no Aura of the Sentinel feature in the catalog");
  assert.deepEqual(auras.map((feature) => feature.initiativeBonus), auras.map(() => ({ kind: "proficiency" })));
});

test("live catalog: every print that has Hare-Trigger carries the proficiency Initiative Bonus on that trait", { skip: SKIP }, () => {
  const prints = SKIP ? [] : live!.collections.races.filter((race) => race.traits.some((trait) => trait.name === "Hare-Trigger"));
  assert.ok(prints.length > 0, "no race with a Hare-Trigger trait in the catalog");
  assert.deepEqual(
    prints.map((race) => race.traits.find((trait) => trait.name === "Hare-Trigger")?.initiativeBonus),
    prints.map(() => ({ kind: "proficiency" })),
  );
});

test("live catalog: a Harengon of each print has initiative that includes the proficiency bonus from Hare-Trigger", { skip: SKIP }, () => {
  const harengons = SKIP ? [] : live!.compendium.for().races().filter((race) => race.name === "Harengon");
  assert.ok(harengons.length > 0, "no Harengon in the catalog");
  const fighter = SKIP ? undefined : live!.compendium.for().classes().find((cls) => cls.name === "Fighter");
  assert.ok(fighter, "no Fighter in the catalog");
  for (const harengon of harengons) {
    const character = makeChar({
      race: { name: harengon.name, source: harengon.source },
      classes: [{ className: fighter.name, source: fighter.source, level: 5 }],
      baseAbilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
    });
    const evaluated = evaluateCharacter(character, { compendium: live!.compendium });
    assert.deepEqual(
      evaluated.initiativeBreakdown,
      [
        { label: "Dexterity", value: 2 },
        { label: "Hare-Trigger", value: 3 },
      ],
      `${harengon.name} (${harengon.source}): DEX +2 and proficiency +3 at level 5`,
    );
    assert.equal(evaluated.initiative, 5);
  }
});

test("live catalog: a Paladin with the Aura of the Sentinel and the flat Alert has initiative DEX + proficiency + 5, at the level the aura is gained", { skip: SKIP }, () => {
  const alert = SKIP ? undefined : live!.collections.feats.find((feat) => feat.name === "Alert" && feat.initiativeBonus?.kind === "flat");
  assert.ok(alert, "no Alert feat with a flat Initiative Bonus in the catalog");
  // Every subclass print that gains the aura, at the level it is gained.
  const holders: Array<{ cls: ClassData; sc: SubclassData; level: number }> = [];
  for (const cls of SKIP ? [] : live!.compendium.for().classes()) {
    for (const sc of cls.subclasses) {
      const aura = sc.features.find((feature) => feature.name === "Aura of the Sentinel");
      if (aura) holders.push({ cls, sc, level: aura.level });
    }
  }
  assert.ok(holders.length > 0, "no subclass with Aura of the Sentinel");
  for (const { cls, sc, level } of holders) {
    const character = makeChar({
      classes: [{ className: cls.name, source: cls.source, level, subclassName: sc.name, subclassSource: sc.source }],
      baseAbilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
      asiSelections: [{ level: 4, type: "feat", featName: alert!.name, featSource: alert!.source }],
    });
    const proficiency = Math.floor((level - 1) / 4) + 2;
    const evaluated = evaluateCharacter(character, { compendium: live!.compendium });
    assert.equal(evaluated.initiative, 2 + proficiency + 5, `${printKey(cls)} / ${sc.name} at level ${level}`);
    assert.deepEqual(evaluated.initiativeBreakdown, [
      { label: "Dexterity", value: 2 },
      { label: "Aura of the Sentinel", value: proficiency },
      { label: "Alert", value: 5 },
    ]);
  }
});

test("live catalog: every feature whose prose adds to initiative has an Initiative Bonus or a reviewed mark", { skip: SKIP }, () => {
  // The live catalog's classes, feats, races and Options and Features records, read by the same gate as the tracked data.
  const catalog = {
    classes: live!.collections.classes,
    feats: live!.collections.feats,
    races: live!.collections.races,
    optionsAndFeatures: live!.collections.optionsAndFeatures,
  } as unknown as TrackedData;
  const gaps = initiativeCoverageGaps(catalog, [...REVIEWED_NO_INITIATIVE_BONUS, ...REVIEWED_NO_INITIATIVE_BONUS_LIVE_ONLY]);
  assert.deepEqual(
    gaps.map((gap) => `${gapName(gap)}: ${gap.sentences.join(" | ")}`),
    [],
    "features whose prose adds to initiative, with no Initiative Bonus and no reviewed mark, in the live catalog"
  );
});

// Granted spells (ADR 0017): the feats' spell grants are carried by the catalog the in-app sync builds, and the engine reads them.

/** Every spell name a feat's grants name, in any group (known, innate at-will, daily, per rest). */
function grantedSpellNames(feat: Pick<FeatData, "additionalSpells">): string[] {
  const namesIn = (value: unknown): string[] => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(namesIn);
    if (value && typeof value === "object") return Object.values(value).flatMap(namesIn);
    return [];
  };
  return (feat.additionalSpells ?? []).flatMap((grant) =>
    Object.entries(grant)
      .filter(([key]) => key !== "ability" && key !== "name")
      .flatMap(([, group]) => namesIn(group)),
  );
}

test("live catalog: Telekinetic carries Mage Hand, and Telepathic carries Detect Thoughts", { skip: SKIP }, () => {
  const telekinetic = live!.collections.feats.find((feat) => feat.name === "Telekinetic" && feat.source === "TCE");
  const telepathic = live!.collections.feats.find((feat) => feat.name === "Telepathic" && feat.source === "TCE");
  assert.ok(telekinetic, "no Telekinetic feat in the catalog");
  assert.ok(telepathic, "no Telepathic feat in the catalog");
  assert.ok(grantedSpellNames(telekinetic).includes("mage hand"), `Telekinetic grants: ${JSON.stringify(telekinetic.additionalSpells)}`);
  assert.ok(grantedSpellNames(telepathic).includes("detect thoughts"), `Telepathic grants: ${JSON.stringify(telepathic.additionalSpells)}`);
});

test("live catalog: a Wizard with Telekinetic (INT) has Mage Hand at will, and with Telepathic has Detect Thoughts once per Long Rest", { skip: SKIP }, () => {
  const wizard = live!.compendium.for().classes().find((cls) => cls.name === "Wizard");
  assert.ok(wizard, "no Wizard class in the catalog");
  const character = makeChar({
    classes: [{ className: wizard.name, source: wizard.source, level: 5 }],
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    asiSelections: [
      { level: 4, type: "feat", featName: "Telekinetic", featSource: "TCE", featAbility: "int" },
      { level: 4, type: "feat", featName: "Telepathic", featSource: "TCE", featAbility: "cha" },
    ],
  });
  const evaluated = evaluateCharacter(character, { compendium: live!.compendium });
  const telekinetic = evaluated.grantedSpellSources.find((source) => source.title === "Telekinetic");
  const telepathic = evaluated.grantedSpellSources.find((source) => source.title === "Telepathic");
  const mageHand = telekinetic?.spells.find((spell) => spell.name === "Mage Hand");
  const detectThoughts = telepathic?.spells.find((spell) => spell.name === "Detect Thoughts");
  assert.equal(mageHand?.resourceCounterId, undefined, "Mage Hand is at will");
  assert.ok(detectThoughts?.resourceCounterId, "Detect Thoughts has a Long Rest counter");
  assert.equal(telekinetic?.ability, "int");
  assert.equal(telekinetic?.spellSaveDc, 8 + 3 + 3, "level 5 (+3) and INT 16 raised to 17 (+3)");
});

test("live catalog: Drow, Tiefling and Firbolg carry their spell grants on the race or subrace", { skip: SKIP }, () => {
  const races = live!.collections.races;
  const drow = races.find((race) => race.name === "Elf" && race.source === "PHB")?.subraces.find((sub) => sub.name === "Drow");
  const tiefling = races.find((race) => race.name === "Tiefling" && race.source === "PHB");
  const firbolg = races.find((race) => race.name === "Firbolg" && race.source === "VGM");
  assert.ok(drow, "no Drow subrace of the PHB Elf in the catalog");
  assert.ok(tiefling, "no PHB Tiefling in the catalog");
  assert.ok(firbolg, "no VGM Firbolg in the catalog");
  assert.ok(grantedSpellNames(drow).includes("dancing lights"), `Drow grants: ${JSON.stringify(drow.additionalSpells)}`);
  assert.ok(grantedSpellNames(tiefling).includes("hellish rebuke"), `Tiefling grants: ${JSON.stringify(tiefling.additionalSpells)}`);
  assert.ok(grantedSpellNames(firbolg).includes("detect magic"), `Firbolg grants: ${JSON.stringify(firbolg.additionalSpells)}`);
});

test("live catalog: a level-5 Drow has Dancing Lights, Faerie Fire and Darkness from the catalog", { skip: SKIP }, () => {
  const character = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 5 }],
    race: { name: "Elf", source: "PHB", subraceName: "Drow", subraceSource: "PHB" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
  });
  const evaluated = evaluateCharacter(character, { compendium: live!.compendium });
  const drow = evaluated.grantedSpellSources.find((source) => source.title === "Drow");
  assert.ok(drow, `no Drow card; sources: ${evaluated.grantedSpellSources.map((source) => source.title).join(", ")}`);
  assert.equal(drow.ability, "cha");
  const names = drow.spells.map((spell) => spell.name);
  for (const name of ["Dancing Lights", "Faerie Fire", "Darkness"]) assert.ok(names.includes(name), `${name} is on the Drow card: ${names.join(", ")}`);
});

test("live catalog: a Water Genasi of level 3 keeps the counter id the old race table saved for Create or Destroy Water", { skip: SKIP }, () => {
  const character = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 3 }],
    race: { name: "Genasi", source: "EEPC", subraceName: "Water", subraceSource: "EEPC" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  });
  const evaluated = evaluateCharacter(character, { compendium: live!.compendium });
  const water = evaluated.grantedSpellSources.find((source) => source.title === "Water");
  const spell = water?.spells.find((entry) => entry.name === "Create or Destroy Water");
  assert.ok(spell, `no Create or Destroy Water on the Water card: ${JSON.stringify(water?.spells.map((entry) => entry.name))}`);
  assert.equal(spell.resourceCounterId, "innate_spell_create_water");
});

test("live catalog: a level-3 Tiefling's Hellish Rebuke is cast at 2nd level, and its counter is the one the old table saved", { skip: SKIP }, () => {
  const character = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 3 }],
    race: { name: "Tiefling", source: "PHB" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
  });
  const evaluated = evaluateCharacter(character, { compendium: live!.compendium });
  const tiefling = evaluated.grantedSpellSources.find((source) => source.title === "Tiefling");
  const rebuke = tiefling?.spells.find((entry) => entry.name === "Hellish Rebuke");
  assert.ok(rebuke, `no Hellish Rebuke on the Tiefling card: ${JSON.stringify(tiefling?.spells.map((entry) => entry.name))}`);
  assert.equal(rebuke.level, 2, "the grant says the spell is cast at level 2");
  assert.equal(rebuke.resourceCounterId, "innate_spell_hellish_rebuke");
});

// Background expanded spell lists (ADR 0017): a background's lists join the list of each spellcasting class the character has.

test("live catalog: a Strixhaven college background and a Ravnica guild background carry expanded spell lists", { skip: SKIP }, () => {
  const backgrounds = [
    live!.collections.backgrounds.find((background) => background.name === "Lorehold Student" && background.source === "SCC"),
    live!.collections.backgrounds.find((background) => background.name === "Izzet Engineer" && background.source === "GGR"),
  ];
  for (const background of backgrounds) {
    assert.ok(background, "a Strixhaven college or Ravnica guild background is missing from the catalog");
    const lists = (background.additionalSpells ?? []).flatMap((grant) => Object.values(grant.expanded ?? {}));
    assert.ok(
      lists.some((list) => Array.isArray(list) && list.length > 0),
      `${background.name} carries no expanded spells: ${JSON.stringify(background.additionalSpells)}`,
    );
  }
});

test("live catalog: a Wizard with the Lorehold Student background can learn Spirit Guardians, and a Fighter with it has no spell list", { skip: SKIP }, () => {
  const spiritGuardians = live!.compendium.for().spells().find((spell) => spell.name === "Spirit Guardians");
  assert.ok(spiritGuardians, "no Spirit Guardians spell in the catalog");
  const holding = (className: string) => {
    const cls = live!.compendium.for().classes().find((candidate) => candidate.name === className);
    assert.ok(cls, `no ${className} class in the catalog`);
    return makeChar({
      classes: [{ className: cls.name, source: cls.source, level: 5 }],
      background: { name: "Lorehold Student", source: "SCC" },
    });
  };

  const wizard = evaluateCharacter(holding("Wizard"), { compendium: live!.compendium }).spellProfiles.find(
    (profile) => profile.className === "Wizard",
  );
  assert.ok(wizard, "a Wizard of level 5 has a spell profile");
  assert.equal(isSpellAvailableForClass(spiritGuardians, "Wizard", undefined, profileSpellContext(wizard)), true);

  const fighter = evaluateCharacter(holding("Fighter"), { compendium: live!.compendium });
  assert.deepEqual(fighter.spellProfiles, [], "a Fighter with no casting class gets no spell profile");
});
