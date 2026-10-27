import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import type { AbilityKey, Character } from "../src/types/character.ts";
import type { AdditionalSpells, ClassData, FeatData, ProficiencyGrant, SpellData, SubclassData } from "../src/types/dnd5e.ts";
import { createCompendium, type Compendium } from "../src/services/compendium.ts";
import { isCatalogStale, REQUIRED_CATALOG_FORMAT, type CompendiumCollections } from "../src/services/compendiumStorage.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { poolNames, type ChoiceProficiencyGrant } from "../src/rules/proficiencyPools.ts";
import { featSpellChoicesOf, featSpellRuleChoices, pickRuleChoice, raceSpellRuleChoices, ruleChoiceId } from "../src/rules/ruleChoices.ts";
import type { InnateSpellEntry, InnateSpellProfile } from "../src/rules/innateMagic.ts";
import { parseSpellFilter } from "../src/rules/choices/featSpells.ts";
import { STARTING_EQUIPMENT_TYPES } from "../src/rules/startingEquipmentTypes.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import { makeChar } from "./testUtils.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { isSpellAvailableForClass, profileSpellContext } from "../src/rules/spellcasting.ts";
import { resolveSpellName } from "../src/rules/subclassSpells.ts";
import { removeAsiSelection } from "../src/rules/leveling.ts";
import { initiativeCoverageGaps } from "../dnd5eToolsScrap/src/grants/initiative-coverage.ts";
import { gapName } from "../dnd5eToolsScrap/src/grants/coverage.ts";
import type { TrackedData } from "../dnd5eToolsScrap/src/grants/subjects.ts";
import { REVIEWED_NO_INITIATIVE_BONUS, REVIEWED_NO_INITIATIVE_BONUS_LIVE_ONLY } from "../dnd5eToolsScrap/src/overrides/initiative-bonuses.ts";
import { spellCoverageGaps } from "../dnd5eToolsScrap/src/grants/spell-coverage.ts";
import { readsSpellGrants } from "../dnd5eToolsScrap/src/parser/spell-grant-prose.ts";
import { REVIEWED_NO_SPELL_GRANTS, REVIEWED_NO_SPELL_GRANTS_LIVE_ONLY } from "../dnd5eToolsScrap/src/overrides/granted-spells.ts";

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

/** Every `choose` filter string a feat's known and innate groups carry: the groups the reader reads. */
function chooseFiltersOf(feat: Pick<FeatData, "additionalSpells">): string[] {
  const found: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      const choose = (value as { choose?: unknown }).choose;
      if (typeof choose === "string") found.push(choose);
      Object.values(value).forEach(walk);
    }
  };
  for (const grant of feat.additionalSpells ?? []) {
    walk(grant.known);
    walk(grant.innate);
  }
  return found;
}

test("live catalog: Strixhaven Initiate, Fey Touched, Shadow Touched and Spell Sniper carry grants of the expected shape", { skip: SKIP }, () => {
  const feat = (name: string): FeatData => {
    const found = live!.collections.feats.find((candidate) => candidate.name === name);
    assert.ok(found, `no ${name} feat in the catalog`);
    return found;
  };
  const strixhaven = feat("Strixhaven Initiate");
  const lorehold = strixhaven.additionalSpells?.find((grant) => grant.name === "Lorehold 1");
  assert.ok(lorehold, `Strixhaven Initiate has no Lorehold 1 entry: ${JSON.stringify(strixhaven.additionalSpells)}`);
  assert.deepEqual(lorehold.ability, { choose: ["int", "wis", "cha"] }, "the college's entry leaves the ability to the player");
  assert.ok(chooseFiltersOf(strixhaven).includes("level=1|class=cleric;wizard"), "its first-level pick names two classes");

  const feyTouched = feat("Fey Touched");
  assert.equal(feyTouched.additionalSpells?.[0]?.ability, "inherit", "Fey Touched takes the ability its increase raised");
  assert.ok(JSON.stringify(feyTouched.additionalSpells).includes("misty step"), "Fey Touched grants Misty Step");
  assert.ok(chooseFiltersOf(feyTouched).includes("level=1|school=E;D"), "Fey Touched's pick names two schools");

  const shadowTouched = feat("Shadow Touched");
  assert.equal(shadowTouched.additionalSpells?.[0]?.ability, "inherit");
  assert.ok(JSON.stringify(shadowTouched.additionalSpells).includes("invisibility"), "Shadow Touched grants Invisibility");
  assert.ok(chooseFiltersOf(shadowTouched).includes("level=1|school=I;N"));

  const sniper = feat("Spell Sniper");
  const wizardList = sniper.additionalSpells?.find((grant) => grant.name === "Wizard Spells");
  assert.ok(wizardList, `Spell Sniper has no Wizard Spells list: ${JSON.stringify(sniper.additionalSpells)}`);
  assert.equal(wizardList.ability, "int");
  assert.ok(chooseFiltersOf(sniper).includes("level=0|class=Wizard|spell attack=m;r;o"), "Spell Sniper's pick names the attack-roll cantrips");
});

test("live catalog: a Strixhaven college is offered under the cantrips it gives, and its card names the college", { skip: SKIP }, () => {
  const wizard = live!.compendium.for().classes().find((cls) => cls.name === "Wizard");
  assert.ok(wizard, "no Wizard class in the catalog");
  let character = makeChar({
    classes: [{ className: wizard.name, source: wizard.source, level: 5 }],
    asiSelections: [{ level: 4, type: "feat", featName: "Strixhaven Initiate", featSource: "SCC" }],
  });
  const list = featSpellRuleChoices(character, live!.compendium).find((choice) => choice.id.includes("Strixhaven Initiate") && choice.id.endsWith("__Spell List"));
  assert.ok(list, "Strixhaven Initiate offers its colleges");
  const lorehold = list.options.find((option) => option.name === "Lorehold 1");
  assert.equal(lorehold?.label, "Lorehold: Light, Sacred Flame", "the college is labelled by its fixed cantrips");
  character = pickRuleChoice(character, list, "Lorehold 1", live!.compendium);
  const ability = featSpellRuleChoices(character, live!.compendium).find((choice) => choice.id.includes("Strixhaven Initiate") && choice.id.endsWith("__Casting Ability"));
  assert.ok(ability, "the casting ability is offered once for the feat");
  character = pickRuleChoice(character, ability, "int", live!.compendium);
  const card = evaluateCharacter(character, { compendium: live!.compendium }).grantedSpellSources.find((source) => source.title === "Strixhaven Initiate (Lorehold)");
  assert.ok(card, "the card is titled by the feat and the college");
  assert.equal(card.ability, "int");
  assert.deepEqual(card.spells.filter((spell) => spell.isCantrip).map((spell) => spell.name).sort(), ["Light", "Sacred Flame"], "its cantrips are at will");
  assert.ok(card.notices?.some((notice) => /1 more spell/.test(notice)), "its first-level spell is still to be picked");
});

test("live catalog: some cantrips carry their attack-roll kind and others carry none", { skip: SKIP }, () => {
  const cantrips = live!.compendium.for().spells().filter((spell) => spell.level === 0);
  assert.ok(cantrips.some((spell) => spell.spellAttack?.length), "a cantrip that needs an attack roll carries its kind");
  assert.ok(cantrips.some((spell) => !spell.spellAttack), "a cantrip that needs no attack roll carries none");
  assert.deepEqual(cantrips.find((spell) => spell.name === "Fire Bolt")?.spellAttack, ["R"], "Fire Bolt is a ranged attack");
  assert.equal(cantrips.find((spell) => spell.name === "Light")?.spellAttack, undefined, "Light needs no attack roll");
});

test("live catalog: a Wizard with Spell Sniper (Wizard spells) is offered only the Wizard cantrips that need an attack roll", { skip: SKIP }, () => {
  const wizard = live!.compendium.for().classes().find((cls) => cls.name === "Wizard");
  assert.ok(wizard, "no Wizard class in the catalog");
  let character = makeChar({
    classes: [{ className: wizard.name, source: wizard.source, level: 5 }],
    asiSelections: [{ level: 4, type: "feat", featName: "Spell Sniper", featSource: "PHB" }],
  });
  const list = featSpellRuleChoices(character, live!.compendium).find((choice) => choice.id.endsWith("__Spell List") && choice.id.includes("Spell Sniper"));
  assert.ok(list, "Spell Sniper offers its lists");
  character = pickRuleChoice(character, list, "Wizard Spells", live!.compendium);
  const cantrip = featSpellChoicesOf(character, { name: "Spell Sniper", source: "PHB" }, live!.compendium).find((choice) => choice.traitName.endsWith("Cantrip"));
  assert.ok(cantrip, "the Wizard cantrip pick is offered");
  // Every copy of a cantrip in every book counts: the expected names are the Wizard cantrips with an attack roll in any copy.
  const wizardAttackCantrips = [
    ...new Set(
      live!.compendium
        .for()
        .spells()
        .filter((spell) => spell.level === 0 && spell.spellAttack?.length && isSpellAvailableForClass(spell, "Wizard"))
        .map((spell) => spell.name),
    ),
  ].sort();
  assert.ok(wizardAttackCantrips.length > 0, "the catalog has Wizard cantrips that need an attack roll");
  assert.deepEqual(
    cantrip.options.map((option) => option.name).sort(),
    wizardAttackCantrips,
    "the pick offers exactly the Wizard cantrips that need an attack roll",
  );
});

test("live catalog: every filter a feat's known and innate groups carry uses a key the reader models, or is a ritual filter it leaves out", { skip: SKIP }, () => {
  const unknown = live!.collections.feats.flatMap((feat) =>
    chooseFiltersOf(feat).flatMap((filter) => parseSpellFilter(filter).unknownKeys.map((key) => `${feat.name}: ${key}`)),
  );
  assert.deepEqual(unknown, [], "filter keys the reader does not model, which would match nothing");
});

test("live catalog: every feat whose spell grants the reader does not read has a reviewed mark", { skip: SKIP }, () => {
  // The same gate as the tracked data, over the live catalog. A grant with no casting ability, a ritual pick and a feat with no
  // spell grant in the catalog are not read by the reader, so each of their feats needs a mark (ADR 0017).
  const catalog = { classes: [], feats: live!.collections.feats } as unknown as TrackedData;
  const gaps = spellCoverageGaps(catalog, [...REVIEWED_NO_SPELL_GRANTS, ...REVIEWED_NO_SPELL_GRANTS_LIVE_ONLY]);
  assert.deepEqual(
    gaps.map((gap) => `${gapName(gap)}: ${gap.sentences.join(" | ")}`),
    [],
    "feats whose spell grants the reader does not read, with no reviewed mark, in the live catalog",
  );
});

test("live catalog: every feat the gate counts as covered gives the reader a source", { skip: SKIP }, () => {
  // The gate counts a feat as covered when its grant is one the reader reads. This checks that on the real catalog: the
  // reader gives such a feat a card, a listed prepared spell, or a pick it offers (a named list not yet picked). A Wizard
  // holds the feat, so a prepared spell gated on a spell slot level or a character level from 5 is listed.
  const covered = live!.collections.feats.filter((feat) => readsSpellGrants(feat.additionalSpells));
  assert.ok(covered.length > 0, "no feat in the catalog has spell grants the reader reads");
  const silent = covered.filter((feat) => {
    const character = makeChar({
      classes: [{ className: "Wizard", source: "PHB", level: 5 }],
      asiSelections: [{ level: 4, type: "feat", featName: feat.name, featSource: feat.source }],
    });
    const evaluated = evaluateCharacter(character, { compendium: live!.compendium });
    const hasCard = evaluated.grantedSpellSources.some((source) => source.title.startsWith(feat.name));
    const listsPrepared = evaluated.spellProfiles.some((profile) =>
      Object.values(profile.grantedPreparedSources ?? {}).some((source) => source.startsWith(feat.name)),
    );
    const offersPick = featSpellChoicesOf(character, feat, live!.compendium).length > 0;
    return !hasCard && !listsPrepared && !offersPick;
  });
  assert.deepEqual(
    silent.map((feat) => `${feat.name} (${feat.source})`),
    [],
    "feats the gate counts as covered that the reader gives no source",
  );
});

test("live catalog: every spell a prepared group names is a spell of the catalog", { skip: SKIP }, () => {
  // A prepared group names spells by name (or picks them). A name the catalog does not hold would be listed nowhere, silently.
  const names = new Set(live!.collections.spells.map((spell) => spell.name.toLowerCase()));
  const named: { owner: string; spell: string }[] = [];
  for (const record of [...live!.collections.feats, ...live!.collections.races]) {
    const subraceGrants = "subraces" in record ? (record.subraces ?? []).flatMap((sub) => sub.additionalSpells ?? []) : [];
    for (const grant of [...(record.additionalSpells ?? []), ...subraceGrants]) {
      for (const spell of preparedNamesOf(grant.prepared)) named.push({ owner: record.name, spell });
    }
  }
  assert.ok(named.length > 0, "the catalog has prepared groups that name spells");
  const missing = named.filter((entry) => !names.has(entry.spell.toLowerCase())).map((entry) => `${entry.owner}: ${entry.spell}`);
  assert.deepEqual(missing, [], "prepared spell names the catalog does not hold");
});

/** The spell names a prepared group names outright: strings at any depth, not the names inside a `choose` filter. */
function preparedNamesOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(preparedNamesOf);
  if (!value || typeof value !== "object" || "choose" in value) return [];
  return Object.values(value).flatMap(preparedNamesOf);
}

test("live catalog: Magic Initiate carries its Cleric list, and a Wizard with it (Cleric) has a card with Wisdom as its ability", { skip: SKIP }, () => {
  const magicInitiate = live!.collections.feats.find((feat) => feat.name === "Magic Initiate" && feat.source === "PHB");
  assert.ok(magicInitiate, "no Magic Initiate feat in the catalog");
  const cleric = magicInitiate.additionalSpells?.find((grant) => grant.name === "Cleric Spells");
  assert.ok(cleric, `Magic Initiate has no Cleric Spells list: ${JSON.stringify(magicInitiate.additionalSpells)}`);
  assert.equal(cleric.ability, "wis", "the Cleric list casts with Wisdom");

  const wizard = live!.compendium.for().classes().find((cls) => cls.name === "Wizard");
  assert.ok(wizard, "no Wizard class in the catalog");
  let character = makeChar({
    classes: [{ className: wizard.name, source: wizard.source, level: 5 }],
    asiSelections: [{ level: 4, type: "feat", featName: "Magic Initiate", featSource: "PHB" }],
  });
  const list = featSpellRuleChoices(character, live!.compendium).find((choice) => choice.id.includes("Magic Initiate") && choice.id.endsWith("__Spell List"));
  assert.ok(list, "Magic Initiate offers its spell lists");
  character = pickRuleChoice(character, list, "Cleric Spells", live!.compendium);
  const card = evaluateCharacter(character, { compendium: live!.compendium }).grantedSpellSources.find((source) => source.title.startsWith("Magic Initiate"));
  assert.ok(card, `no Magic Initiate card; sources: ${evaluateCharacter(character, { compendium: live!.compendium }).grantedSpellSources.map((source) => source.title).join(", ")}`);
  assert.equal(card.ability, "wis");
});

/** A level 5 Wizard that took the feat at level 4, with the feat's ability increase when one is given. */
function wizardHolding(featName: string, featSource: string, featAbility?: AbilityKey): Character {
  return makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 5 }],
    asiSelections: [{ level: 4, type: "feat", featName, featSource, ...(featAbility ? { featAbility } : {}) }],
  });
}

const innateCardOf = (character: Character, title: string): InnateSpellProfile | undefined =>
  evaluateCharacter(character, { compendium: live!.compendium }).grantedSpellSources.find((source) => source.title === title);

const wizardListedNames = (character: Character): string[] =>
  (evaluateCharacter(character, { compendium: live!.compendium }).spellProfiles.find((profile) => profile.className === "Wizard")?.alwaysPreparedSpells ?? []).map(
    (spell) => spell.name,
  );

test("live catalog: Mark of Detection's prepared group is a card with the ability picked, daily spells on counters, and no class list spell", { skip: SKIP }, () => {
  let character = wizardHolding("Mark of Detection", "EFA");
  const ability = featSpellRuleChoices(character, live!.compendium).find((choice) => choice.id === "EFA__Feat Spells__Mark of Detection__Casting Ability");
  assert.ok(ability, "Mark of Detection offers its casting ability");
  character = pickRuleChoice(character, ability, "int", live!.compendium);

  const card = innateCardOf(character, "Mark of Detection");
  assert.ok(card, "no Mark of Detection card");
  assert.equal(card.ability, "int");
  assert.ok(card.spellSaveDc !== undefined, "the card has its save DC");
  for (const name of ["Detect Magic", "See Invisibility"]) {
    const spell: InnateSpellEntry | undefined = card.spells.find((entry) => entry.name === name);
    assert.equal(spell?.maxUses, 1, `${name} is cast once per Long Rest, as the group gives it (${card.spells.map((entry) => entry.name).join(", ")})`);
    assert.ok(spell?.resourceCounterId, `${name} has a Long Rest counter`);
  }
  assert.ok(!wizardListedNames(character).some((name) => name === "Detect Magic" || name === "See Invisibility"), "neither spell is in the class list");
});

test("live catalog: Boon of Siberys's named list is a card once picked, with the ability picked for the feat", { skip: SKIP }, () => {
  let character = wizardHolding("Boon of Siberys", "EFA");
  const list = featSpellRuleChoices(character, live!.compendium).find((choice) => choice.id === "EFA__Feat Spells__Boon of Siberys__Spell List");
  assert.ok(list, "Boon of Siberys offers its spell lists");
  character = pickRuleChoice(character, list, "Mark of Detection", live!.compendium);
  const ability = featSpellRuleChoices(character, live!.compendium).find((choice) => choice.id === "EFA__Feat Spells__Boon of Siberys__Casting Ability");
  assert.ok(ability, "the picked list's casting ability is offered");
  character = pickRuleChoice(character, ability, "wis", live!.compendium);

  const card = innateCardOf(character, "Boon of Siberys (Mark of Detection)");
  assert.ok(card, `no card for the picked list; sources: ${evaluateCharacter(character, { compendium: live!.compendium }).grantedSpellSources.map((s) => s.title).join(", ")}`);
  assert.equal(card.ability, "wis");
  assert.equal(card.spells.find((spell) => spell.name === "True Seeing")?.maxUses, 1);
});

test("live catalog: Vampire Touched's record names no ability and no uses, so its spells stay in the class list", { skip: SKIP }, () => {
  // The record gives its spells as plain prepared names. Until the scraper's record names an ability or uses, the rule reads it as
  // a plain group. This test fails when that changes, so the rule is looked at again.
  const feat = live!.collections.feats.find((entry) => entry.name === "Vampire Touched" && entry.source === "ABH");
  assert.ok(feat, "no Vampire Touched feat in the catalog");
  assert.ok(
    feat.additionalSpells?.every((grant) => grant.ability === undefined && JSON.stringify(grant.prepared ?? {}).indexOf('"daily"') < 0),
    `Vampire Touched's record now names an ability or uses: ${JSON.stringify(feat.additionalSpells)}`,
  );
  const character = wizardHolding("Vampire Touched", "ABH");
  assert.ok(wizardListedNames(character).includes("Spider Climb"), "Spider Climb is in the Wizard's class list");
  assert.equal(innateCardOf(character, "Vampire Touched"), undefined, "and there is no card");
});

test("live catalog: Cloying Mists's daily spell is a card with no ability row, on a counter, and not in the class list", { skip: SKIP }, () => {
  const character = wizardHolding("Cloying Mists", "ABH");
  const card = innateCardOf(character, "Cloying Mists");
  assert.ok(card, "no Cloying Mists card");
  assert.equal(card.ability, undefined);
  assert.equal(card.spellSaveDc, undefined);
  assert.equal(card.notices, undefined, "no ability is named, so there is none to choose");
  assert.equal(card.spells.find((spell) => spell.name === "Fog Cloud")?.maxUses, 1);
  assert.ok(!wizardListedNames(character).includes("Fog Cloud"));
});

test("live catalog: a feat that names spells and no ability is a card with no ability row, its cantrips at will and its daily spells on counters", { skip: SKIP }, () => {
  const cartomancer = innateCardOf(wizardHolding("Cartomancer", "BMT"), "Cartomancer");
  assert.ok(cartomancer, "no Cartomancer card");
  assert.equal(cartomancer.ability, undefined);
  assert.equal(cartomancer.spellSaveDc, undefined);
  assert.equal(cartomancer.spellAttackBonus, undefined);
  assert.equal(cartomancer.notices, undefined, "no ability is named, so there is none to choose");
  assert.equal(cartomancer.spells.find((spell) => spell.name === "Prestidigitation")?.resourceCounterId, undefined, "a cantrip is at will");

  const envoy = innateCardOf(wizardHolding("Outlands Envoy", "SatO"), "Outlands Envoy");
  assert.ok(envoy, "no Outlands Envoy card");
  assert.equal(envoy.ability, undefined);
  for (const name of ["Misty Step", "Tongues"]) {
    const spell: InnateSpellEntry | undefined = envoy.spells.find((entry) => entry.name === name);
    assert.equal(spell?.maxUses, 1, `${name} is cast once per Long Rest`);
    assert.ok(spell?.resourceCounterId, `${name} has a Long Rest counter`);
  }
});

test("live catalog: Light Bringer's list is a card with no ability once picked", { skip: SKIP }, () => {
  let character = wizardHolding("Light Bringer", "ABH");
  const list = featSpellRuleChoices(character, live!.compendium).find((choice) => choice.id === "ABH__Feat Spells__Light Bringer__Spell List");
  assert.ok(list, "Light Bringer offers its spell lists");
  character = pickRuleChoice(character, list, "Light", live!.compendium);
  const card = evaluateCharacter(character, { compendium: live!.compendium }).grantedSpellSources.find((source) => source.title.startsWith("Light Bringer"));
  assert.ok(card, "no card for the picked list");
  assert.equal(card.ability, undefined, "the grant names no ability, so the card has none");
  assert.equal(card.spellSaveDc, undefined);
});

test("live catalog: Servo Crafting and Strixhaven Mascot, whose grants are ritual spells only, give no card", { skip: SKIP }, () => {
  assert.equal(innateCardOf(wizardHolding("Servo Crafting", "PSK"), "Servo Crafting"), undefined);
  assert.equal(innateCardOf(wizardHolding("Strixhaven Mascot", "SCC"), "Strixhaven Mascot"), undefined);
});

test("live catalog: Magic Connoisseur's list casts with the ability its feat's increase raised", { skip: SKIP }, () => {
  let character = wizardHolding("Magic Connoisseur", "AU", "int");
  const list = featSpellRuleChoices(character, live!.compendium).find((choice) => choice.id === "AU__Feat Spells__Magic Connoisseur__Spell List");
  assert.ok(list, "Magic Connoisseur offers its spell lists");
  character = pickRuleChoice(character, list, "Wizard Spells", live!.compendium);
  const card = innateCardOf(character, "Magic Connoisseur (Wizard)");
  assert.ok(card, "no Magic Connoisseur card for the Wizard list");
  assert.equal(card.ability, "int", "the ability is the one the increase raised");
});

test("live catalog: Boon of Magic School Mastery's school list is a card with no ability row once picked", { skip: SKIP }, () => {
  let character = wizardHolding("Boon of Magic School Mastery", "AU");
  const list = featSpellRuleChoices(character, live!.compendium).find((choice) => choice.id === "AU__Feat Spells__Boon of Magic School Mastery__Spell List");
  assert.ok(list, "Boon of Magic School Mastery offers its school lists");
  character = pickRuleChoice(character, list, "Evocation", live!.compendium);
  const card = innateCardOf(character, "Boon of Magic School Mastery (Evocation)");
  assert.ok(card, "no card for the Evocation list");
  assert.equal(card.ability, undefined, "the record names no ability, so the card has none");
});

test("live catalog: a plain prepared group, an Adept feat's slot lists or Treacherous Allure, stays in the class list with no card", { skip: SKIP }, () => {
  const adept = wizardHolding("Abjuration Adept", "AU");
  assert.ok(wizardListedNames(adept).includes("Shield"), "the Adept's first-level spell is in the Wizard's list");
  assert.equal(innateCardOf(adept, "Abjuration Adept"), undefined);
  const allure = wizardHolding("Treacherous Allure", "ABH");
  assert.ok(wizardListedNames(allure).includes("Charm Person"), "Treacherous Allure's spell is in the Wizard's list");
  assert.equal(innateCardOf(allure, "Treacherous Allure"), undefined);
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
  const drow = evaluated.grantedSpellSources.find((source) => source.title === "Drow Elf");
  assert.ok(drow, `no Drow card; sources: ${evaluated.grantedSpellSources.map((source) => source.title).join(", ")}`);
  assert.equal(drow.ability, "cha");
  const names = drow.spells.map((spell) => spell.name);
  for (const name of ["Dancing Lights", "Faerie Fire", "Darkness"]) assert.ok(names.includes(name), `${name} is on the Drow card: ${names.join(", ")}`);
});

test("live catalog: a Half-Elf of the Drow Descent has no Drow spell until its Drow Magic option is picked, then has all three", { skip: SKIP }, () => {
  const character = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 5 }],
    race: { name: "Half-Elf", source: "PHB", subraceName: "Drow Descent", subraceSource: "SCAG" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
  });
  const sourceWithCantrip = (candidate: Character) =>
    evaluateCharacter(candidate, { compendium: live!.compendium }).grantedSpellSources.find((source) =>
      source.spells.some((spell) => spell.name === "Dancing Lights"),
    );
  assert.equal(sourceWithCantrip(character), undefined, "the option is not picked, so the descent's spells are not read");

  const picked: Character = {
    ...character,
    ruleChoices: [
      {
        id: ruleChoiceId({ source: "SCAG", race: "Half-Elf", subrace: { name: "Drow Descent" }, trait: "Variant Feature (Choose 1)" }),
        trait: "Variant Feature (Choose 1)",
        origin: "race",
        choose: 1,
        from: ["Skill Versatility", "Drow Magic"],
        picked: ["Drow Magic"],
      },
    ],
  };
  const descent = sourceWithCantrip(picked);
  assert.ok(descent, "picked, the descent's spells are read");
  const names = descent.spells.map((spell) => spell.name);
  for (const name of ["Dancing Lights", "Faerie Fire", "Darkness"]) assert.ok(names.includes(name), `${name} is listed: ${names.join(", ")}`);
});

test("live catalog: a Water Genasi of level 3 has its Create or Destroy Water counter under the spell's id, and a use saved under an older id moves there", { skip: SKIP }, () => {
  const character = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 3 }],
    race: { name: "Genasi", source: "EEPC", subraceName: "Water", subraceSource: "EEPC" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  });
  const evaluated = evaluateCharacter(character, { compendium: live!.compendium });
  const water = evaluated.grantedSpellSources.find((source) => source.title === "Water Genasi");
  const spell = water?.spells.find((entry) => entry.name === "Create or Destroy Water");
  assert.ok(spell, `no Create or Destroy Water on the Water card: ${JSON.stringify(water?.spells.map((entry) => entry.name))}`);
  assert.equal(spell.resourceCounterId, "innate_spell_create_or_destroy_water");

  const savedUnderOldId = {
    ...character,
    resourceCounters: {
      innate_spell_create_water: { id: "innate_spell_create_water", name: "Innate: Create or Destroy Water", current: 0, max: 1, resetOn: "long" as const },
    },
  };
  const moved = reconcile(savedUnderOldId, live!.compendium);
  assert.equal(moved.resourceCounters?.innate_spell_create_water, undefined, "the counter under the older id is gone");
  assert.equal(moved.resourceCounters?.innate_spell_create_or_destroy_water?.current, 0, "the saved use is kept under the spell's id");
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

// The nine race and subrace grants with leveled known spells (ADR 0017). Each spell is `[name, uses, level gate]`: a spell the
// trait lets the player cast once per Long Rest has 1 uses, one it casts at will is "at will", and the gate is the character level
// the trait unlocks it at. Each grant is read at every level from 1 to 3: a spell is listed from its gate and not before.
const LEVELED_KNOWN_GRANTS: Array<{
  label: string;
  race: string;
  subrace?: string;
  subraceSource?: string;
  source?: string;
  spells: Array<[string, 1 | "at will", number]>;
}> = [
  {
    label: "Dwarf Mark of Warding",
    race: "Dwarf",
    subrace: "Mark of Warding",
    subraceSource: "ERLW",
    spells: [
      ["Alarm", 1, 1],
      ["Arcane Lock", 1, 3],
      ["Mage Armor", 1, 1],
    ],
  },
  { label: "Genasi Air", race: "Genasi", subrace: "Air", subraceSource: "EEPC", spells: [["Levitate", 1, 1]] },
  { label: "Genasi Earth", race: "Genasi", subrace: "Earth", subraceSource: "EEPC", spells: [["Pass without Trace", 1, 1]] },
  {
    label: "Gnome (Deep)",
    race: "Gnome (Deep)",
    source: "DMG",
    spells: [
      ["Blindness/Deafness", 1, 1],
      ["Blur", 1, 1],
      ["Disguise Self", 1, 1],
      ["Nondetection", "at will", 1],
    ],
  },
  {
    label: "Halfling Mark of Hospitality",
    race: "Halfling",
    subrace: "Mark of Hospitality",
    subraceSource: "ERLW",
    spells: [
      ["Prestidigitation", "at will", 1],
      ["Purify Food and Drink", 1, 1],
      ["Unseen Servant", 1, 1],
    ],
  },
  {
    label: "Hexblood",
    race: "Hexblood",
    source: "VRGR",
    spells: [
      ["Disguise Self", 1, 1],
      ["Hex", 1, 1],
    ],
  },
  {
    label: "Human Mark of Making",
    race: "Human",
    subrace: "Mark of Making",
    subraceSource: "ERLW",
    spells: [
      ["Magic Weapon", 1, 1],
      ["Mending", "at will", 1],
    ],
  },
  { label: "Human Mark of Passage", race: "Human", subrace: "Mark of Passage", subraceSource: "ERLW", spells: [["Misty Step", 1, 1]] },
  { label: "Human Mark of Sentinel", race: "Human", subrace: "Mark of Sentinel", subraceSource: "ERLW", spells: [["Shield", 1, 1]] },
];

/** A character of the grant's race, found in the live catalog by the name of the record that holds the grant. */
function characterOfGrant(grant: (typeof LEVELED_KNOWN_GRANTS)[number], level: number): Character {
  const records = grant.subrace
    ? live!.collections.races.filter((race) => race.name === grant.race && race.subraces.some((sub) => sub.name === grant.subrace && sub.source === grant.subraceSource))
    : live!.collections.races.filter((race) => race.name === grant.race && race.source === grant.source);
  const record = records[0];
  assert.ok(record, `no ${grant.race} record holds the ${grant.label} grant`);
  return makeChar({
    classes: [{ className: "Fighter", source: "PHB", level }],
    race: {
      name: record.name,
      source: record.source,
      ...(grant.subrace ? { subraceName: grant.subrace, subraceSource: grant.subraceSource } : {}),
    },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
  });
}

/** The spells a character's race grants at its level, each with its uses (1 once per Long Rest, or "at will"), sorted by name. */
function raceSpellsAt(character: Character): Array<[string, 1 | "at will"]> {
  const sources = evaluateCharacter(character, { compendium: live!.compendium }).grantedSpellSources;
  assert.equal(sources.length, 1, `one race grant is read: ${sources.map((source) => source.title).join(", ")}`);
  return sources[0].spells
    .map((spell): [string, 1 | "at will"] => [spell.name, spell.maxUses === undefined ? "at will" : (spell.maxUses as 1)])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

for (const grant of LEVELED_KNOWN_GRANTS) {
  test(`live catalog: the ${grant.label} grant lists each spell from its trait's level, with its uses`, { skip: SKIP }, () => {
    for (const level of [1, 2, 3]) {
      const expected = grant.spells
        .filter(([, , gate]) => gate <= level)
        .map(([name, uses]): [string, 1 | "at will"] => [name, uses])
        .sort((a, b) => a[0].localeCompare(b[0]));
      assert.deepEqual(raceSpellsAt(characterOfGrant(grant, level)), expected, `at character level ${level}`);
    }
  });
}

test("live catalog: the Dwarf Mark of Warding's Arcane Lock is read from 3rd level, not before", { skip: SKIP }, () => {
  const grant = LEVELED_KNOWN_GRANTS[0];
  const names = (level: number) => raceSpellsAt(characterOfGrant(grant, level)).map(([name]) => name);
  assert.ok(names(2).includes("Alarm") && names(2).includes("Mage Armor"), "alarm and mage armor are read from level 1");
  assert.equal(names(2).includes("Arcane Lock"), false, "the trait adds arcane lock at 3rd level");
  assert.ok(names(3).includes("Arcane Lock"), "arcane lock is read at 3rd level");
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

test("live catalog: a High Elf offers the wizard cantrip filter, a Vahadar Elf the druid one, and an MPMM race its casting ability", { skip: SKIP }, () => {
  const compendium = live!.compendium;
  const offered = (race: Character["race"]) => raceSpellRuleChoices(makeChar({ classes: [{ className: "Fighter", source: "PHB", level: 1 }], race }), compendium);

  const highElf = offered({ name: "Elf", source: "PHB", subraceName: "High", subraceSource: "PHB" });
  const wizard = highElf.find((choice) => choice.traitName === "High Cantrip");
  assert.ok(wizard, `the High Elf offers its cantrip pick: ${highElf.map((choice) => choice.traitName).join(", ")}`);
  assert.equal(wizard.choose, 1);
  assert.ok(wizard.options.some((option) => option.name === "Fire Bolt"), "the wizard cantrips are offered");
  assert.ok(wizard.options.every((option) => option.description.startsWith("Cantrip")), "every option is a cantrip");

  // The tracked Wood Elf carries no spell grant, so the Vahadar Elf of Elf (Kaladesh) stands in for a druid cantrip filter.
  const vahadar = offered({ name: "Elf (Kaladesh)", source: "PSK", subraceName: "Vahadar", subraceSource: "PSK" });
  const druid = vahadar.find((choice) => choice.traitName === "Vahadar Cantrip");
  assert.ok(druid, `the Vahadar Elf offers a cantrip pick: ${vahadar.map((choice) => choice.traitName).join(", ")}`);
  assert.ok(druid.options.some((option) => option.name === "Druidcraft"), "the druid cantrips are offered");

  const aarakocra = offered({ name: "Aarakocra", source: "MPMM" });
  const ability = aarakocra.find((choice) => choice.id.endsWith("__Casting Ability"));
  assert.ok(ability, `the MPMM Aarakocra offers an ability choice: ${aarakocra.map((choice) => choice.id).join(", ")}`);
  assert.deepEqual(ability.options.map((option) => option.name), ["int", "wis", "cha"]);
});

// Expanded lists of held feats and races (ADR 0017): a Mark's lists join every spellcasting class's list, and are released with a
// notice when the Mark goes. Only names and ids are read from the catalog.

const expandedNamesOf = (grants: AdditionalSpells[] = []): string[] =>
  grants.flatMap((grant) => Object.values(grant.expanded ?? {})).flatMap((list) =>
    Array.isArray(list) ? list.filter((name): name is string => typeof name === "string") : [],
  );

/** A spell of a Mark's expanded lists the Cleric's own list does not give, so only the Mark can put it on the Cleric's list. */
function markOnlySpell(names: string[]): SpellData | undefined {
  for (const name of names) {
    const spell = resolveSpellName(name, undefined, live!.compendium);
    if (spell && !isSpellAvailableForClass(spell, "Cleric")) return spell;
  }
  return undefined;
}

test("live catalog: every spell a Mark feat's expanded list names is a spell of the catalog", { skip: SKIP }, () => {
  const marks = live!.compendium.for().feats().filter((feat) => feat.additionalSpells?.some((grant) => grant.expanded));
  assert.ok(marks.length > 0, "the catalog carries Mark feats with expanded lists");
  const unresolved = marks.flatMap((feat) =>
    expandedNamesOf(feat.additionalSpells).filter((name) => !resolveSpellName(name, undefined, live!.compendium)).map((name) => `${feat.name}: ${name}`),
  );
  assert.deepEqual(unresolved, [], "every named spell of a Mark's expanded list is in the catalog");
});

test("live catalog: a Mark of Detection feat puts its expanded spell on a Cleric's list, and a Cleric without it does not have that spell", { skip: SKIP }, () => {
  const mark = live!.compendium.for().feats().find((feat) => feat.name === "Mark of Detection" && feat.source === "EFA");
  assert.ok(mark, "the Mark of Detection feat is missing from the catalog");
  const cleric = live!.compendium.for().classes().find((cls) => cls.name === "Cleric");
  assert.ok(cleric, "no Cleric class in the catalog");
  const spell = markOnlySpell(expandedNamesOf(mark.additionalSpells));
  assert.ok(spell, "a Mark of Detection spell the Cleric's own list does not give is missing");

  const clericAt = (asiSelections: Character["asiSelections"]) =>
    evaluateCharacter(
      makeChar({
        classes: [{ className: cleric.name, source: cleric.source, level: 5 }],
        asiSelections,
      }),
      { compendium: live!.compendium },
    ).spellProfiles.find((profile) => profile.className === "Cleric");

  const withMark = clericAt([{ level: 4, className: "Cleric", classLevel: 4, type: "feat", featName: mark.name, featSource: mark.source }]);
  assert.ok(withMark, "a Cleric of level 5 has a spell profile");
  assert.equal(isSpellAvailableForClass(spell, "Cleric", undefined, profileSpellContext(withMark)), true, `${spell.name} is on the Cleric's list with the Mark`);
  const withoutMark = clericAt([]);
  assert.ok(withoutMark);
  assert.equal(isSpellAvailableForClass(spell, "Cleric", undefined, profileSpellContext(withoutMark)), false, `${spell.name} is not on the Cleric's list without it`);
});

test("live catalog: a Half-Elf of the Mark of Detection subrace puts its expanded spell on a Cleric's list", { skip: SKIP }, () => {
  const race = live!.collections.races.find((candidate) =>
    (candidate.subraces ?? []).some((sub) => sub.name === "Mark of Detection" && sub.source === "ERLW"),
  );
  assert.ok(race, "no race carries the ERLW Mark of Detection subrace");
  const subrace = (race.subraces ?? []).find((sub) => sub.name === "Mark of Detection" && sub.source === "ERLW");
  assert.ok(subrace);
  const spell = markOnlySpell(expandedNamesOf(subrace.additionalSpells));
  assert.ok(spell, "a Mark of Detection subrace spell the Cleric's own list does not give is missing");
  const cleric = live!.compendium.for().classes().find((cls) => cls.name === "Cleric");
  assert.ok(cleric);

  const profile = evaluateCharacter(
    makeChar({
      classes: [{ className: cleric.name, source: cleric.source, level: 5 }],
      race: { name: race.name, source: race.source, subraceName: subrace.name, subraceSource: subrace.source },
    }),
    { compendium: live!.compendium },
  ).spellProfiles.find((candidate) => candidate.className === "Cleric");
  assert.ok(profile, "a Cleric of level 5 has a spell profile");
  assert.equal(isSpellAvailableForClass(spell, "Cleric", undefined, profileSpellContext(profile)), true, `${spell.name} is on the Cleric's list with the subrace`);
});

test("live catalog: removing a Mark of Detection feat releases the spell its expanded list gave, with a notice that names the feat", { skip: SKIP }, () => {
  const mark = live!.compendium.for().feats().find((feat) => feat.name === "Mark of Detection" && feat.source === "EFA");
  assert.ok(mark);
  const cleric = live!.compendium.for().classes().find((cls) => cls.name === "Cleric");
  assert.ok(cleric);
  const spell = markOnlySpell(expandedNamesOf(mark.additionalSpells));
  assert.ok(spell);
  const character = makeChar({
    classes: [{ className: cleric.name, source: cleric.source, level: 5 }],
    asiSelections: [{ level: 4, className: "Cleric", classLevel: 4, type: "feat", featName: mark.name, featSource: mark.source }],
    knownSpells: [{ name: spell.name, source: spell.source, ownerKey: `${cleric.name}__${cleric.source}`, className: cleric.name }],
  });
  const released = removeAsiSelection(character, "Cleric", 4, live!.compendium);
  assert.deepEqual(released.knownSpells, [], `${spell.name} leaves the known spells`);
  assert.ok(
    released.needsReview?.some((notice) => notice.includes(`${spell.name} removed: only on the Mark of Detection feat's spell list`)),
    `the release is noticed: ${JSON.stringify(released.needsReview)}`,
  );
});
