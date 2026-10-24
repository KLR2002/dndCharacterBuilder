import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import type { Character } from "../src/types/character.ts";
import type { ClassData, ProficiencyGrant, SubclassData } from "../src/types/dnd5e.ts";
import { createCompendium, type Compendium } from "../src/services/compendium.ts";
import { isCatalogStale, REQUIRED_CATALOG_FORMAT, type CompendiumCollections } from "../src/services/compendiumStorage.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { poolNames, type ChoiceProficiencyGrant } from "../src/rules/proficiencyPools.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { STARTING_EQUIPMENT_TYPES } from "../src/rules/startingEquipmentTypes.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import { makeChar } from "./testUtils.ts";

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
