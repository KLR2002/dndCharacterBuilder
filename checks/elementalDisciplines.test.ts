import test from "node:test";
import assert from "node:assert/strict";
import { makeChar, integratedTestCompendium, loadTestCatalog, srdBaselineCompendium } from "./testUtils.ts";
import {
  ELEMENTAL_DISCIPLINE_SPELL_MAP,
  NON_SPELL_DISCIPLINES,
  getSubclassSpells,
} from "../src/rules/subclassSpells.ts";
import { DISCIPLINE_FIXTURE_RECORDS, choiceCatalogBundle } from "./choiceCatalogFixture.ts";
import { createCompendium, type Compendium } from "../src/services/compendium.ts";
import { REQUIRED_CATALOG_FORMAT } from "../src/services/compendiumStorage.ts";
import type { CompendiumCollections } from "../src/services/compendiumStorage.ts";
import type { OptionFeatureData } from "../src/types/dnd5e.ts";
import type { Character } from "../src/types/character.ts";
import {
  pickedOptionNames,
  resolveOptionName,
  type AvailableRuleChoice,
  type RuleChoiceEntry,
} from "../src/rules/choices/types.ts";
import { pickRuleChoice, subclassRuleChoices } from "../src/rules/ruleChoices.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import {
  SUBCLASS_CHOICE_ROWS,
  readPointerRow,
  type SubclassChoiceRow,
} from "../src/rules/subclassChoiceTable.ts";

// The Way of the Four Elements rows read their disciplines from the Integrated Catalog's ED option
// records. These seam tests go through the Rule Choice interface; the fixture catalog carries
// invented text and the real names and unlock prerequisites.

const ROW_3 = "PHB__Monk__Way of the Four Elements__Discipline 3";
const ROW_6 = "PHB__Monk__Way of the Four Elements__Discipline 6";
const ROW_11 = "PHB__Monk__Way of the Four Elements__Discipline 11";
const ROW_17 = "PHB__Monk__Way of the Four Elements__Discipline 17";
const DISCIPLINE_ROW_IDS = [ROW_3, ROW_6, ROW_11, ROW_17];

const ASPECT_6 = "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6";

const monkChar = (level: number, extra: Partial<Character> = {}) =>
  makeChar({
    classes: [{ className: "Monk", source: "PHB", level, subclassName: "Way of the Four Elements" }],
    ...extra,
  });

const disciplineOffers = (char: Character, compendium: Compendium, books?: string[]) =>
  subclassRuleChoices(char, books, compendium).filter((c) => DISCIPLINE_ROW_IDS.includes(c.id));

const namesOf = (choice: AvailableRuleChoice) => choice.options.map((o) => o.name);

const catalog = (bundle: CompendiumCollections = choiceCatalogBundle()) => createCompendium(bundle);

const withRecords = (change: (record: OptionFeatureData) => OptionFeatureData | null) =>
  choiceCatalogBundle({
    optionsAndFeatures: DISCIPLINE_FIXTURE_RECORDS.flatMap((record) => {
      const next = change(record);
      return next ? [next] : [];
    }),
  });

test("the four Monk rows offer the catalog's disciplines cumulatively, each unlocked at its prerequisite level", () => {
  const offers = disciplineOffers(monkChar(17), catalog(), ["PHB"]);
  assert.deepEqual(offers.map((c) => c.id), DISCIPLINE_ROW_IDS);
  assert.deepEqual(offers.map((c) => c.options.length), [7, 9, 12, 16]);

  assert.deepEqual([...namesOf(offers[0])].sort(), [
    "Fangs of the Fire Snake",
    "Fist of Four Thunders",
    "Rush of the Gale Spirits",
    "Shape the Flowing River",
    "Sweeping Cinder Strike",
    "Unbroken Air",
    "Water Whip",
  ]);
  // Each row keeps every option the row before it offered, and adds the disciplines unlocked at its level.
  const added = (later: AvailableRuleChoice, earlier: AvailableRuleChoice) =>
    namesOf(later).filter((n) => !namesOf(earlier).includes(n)).sort();
  assert.deepEqual(added(offers[1], offers[0]), ["Clench of the North Wind", "Gong of the Summit"]);
  assert.deepEqual(added(offers[2], offers[1]), ["Flames of the Phoenix", "Mist Stance", "Ride the Wind"]);
  assert.deepEqual(added(offers[3], offers[2]), [
    "Breath of Winter",
    "Eternal Mountain Defense",
    "River of Hungry Flame",
    "Wave of Rolling Earth",
  ]);
});

test("a Monk below 3rd level is offered no discipline row; a 5th-level Monk is offered only the 3rd-level row", () => {
  assert.deepEqual(disciplineOffers(monkChar(2), catalog(), ["PHB"]), []);
  assert.deepEqual(disciplineOffers(monkChar(5), catalog(), ["PHB"]).map((c) => c.id), [ROW_3]);
});

test("Elemental Attunement is never offered, at any level or under any active books", () => {
  const compendium = catalog();
  for (const level of [3, 6, 11, 17]) {
    for (const books of [undefined, [], ["PHB"]]) {
      for (const offer of disciplineOffers(monkChar(level), compendium, books)) {
        assert.ok(!namesOf(offer).includes("Elemental Attunement"), `${offer.id} at level ${level} offers Elemental Attunement`);
      }
    }
  }
});

test("every discipline row says it picks one", () => {
  const rows = SUBCLASS_CHOICE_ROWS.filter((row) => DISCIPLINE_ROW_IDS.includes(row.id));
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.equal((row as { choose?: number }).choose, 1, `${row.id} must say choose 1`);
  }
  assert.deepEqual(disciplineOffers(monkChar(17), catalog(), ["PHB"]).map((c) => c.choose), [1, 1, 1, 1]);
});

test("every discipline row excludes Elemental Attunement, which is granted rather than chosen", () => {
  const rows = SUBCLASS_CHOICE_ROWS.filter((row) => DISCIPLINE_ROW_IDS.includes(row.id));
  for (const row of rows) {
    assert.deepEqual(row.excludeOptions, ["Elemental Attunement"], `${row.id} must exclude Elemental Attunement`);
  }
});

test("excludeOptions keeps a feature-located row from offering the named option", () => {
  const aspect = SUBCLASS_CHOICE_ROWS.find((row) => row.id === ASPECT_6) as SubclassChoiceRow;
  const excluding: SubclassChoiceRow = { ...aspect, excludeOptions: ["Bear"] };
  const offer = readPointerRow(excluding, catalog(), ["PHB"]);
  assert.ok(offer, "the feature still carries choices");
  assert.ok(!offer.options.some((o) => o.name === "Bear"), "Bear is excluded");
  assert.ok(offer.options.some((o) => o.name === "Eagle"), "other options are still offered");
});

test("a discipline record whose prerequisite the level cannot be read from is never offered", () => {
  const compendium = catalog(
    withRecords((record) => (record.name === "Water Whip" ? { ...record, prerequisite: "Ki Adept" } : record)),
  );
  const names = disciplineOffers(monkChar(17), compendium, ["PHB"]).flatMap(namesOf);
  assert.ok(!names.includes("Water Whip"));
});

test("discipline options are not gated by the active books", () => {
  const compendium = catalog(
    withRecords((record) => (record.name === "Unbroken Air" ? { ...record, source: "XGE" } : record)),
  );
  for (const books of [[], ["PHB"]]) {
    const names = disciplineOffers(monkChar(3), compendium, books).flatMap(namesOf);
    assert.ok(names.includes("Unbroken Air"), `Unbroken Air is offered with books ${JSON.stringify(books)}`);
  }
});

test("a catalog with no discipline records offers no Monk discipline row and leaves saved picks alone", () => {
  const compendium = catalog(
    choiceCatalogBundle({
      optionsAndFeatures: [
        { name: "Placeholder Feat Option", source: "PHB", category: "Other", featureType: ["OTH"], prerequisite: null, description: "Placeholder text." },
      ],
    }),
  );
  const saved = monkChar(6, {
    ruleChoices: [
      { id: ROW_3, trait: "Elemental Discipline (3rd Level)", origin: "subclass", choose: 1, from: [], picked: ["Water Whip"] },
    ],
  });
  assert.deepEqual(disciplineOffers(saved, compendium, ["PHB"]), []);
  assert.deepEqual(reconcile(saved, compendium).ruleChoices, saved.ruleChoices);
});

test("SRD Baseline and integrated catalog offer a Four Elements Monk the same discipline counts by level", () => {
  // The Four Elements subclass is not an SRD subclass, but the SRD Baseline carries the ED records,
  // so the rows are offered in both modes. Counts match the hand-written table this replaced.
  for (const compendium of [srdBaselineCompendium(), integratedTestCompendium()]) {
    const offers = disciplineOffers(monkChar(17), compendium, ["PHB"]);
    assert.deepEqual(offers.map((c) => c.options.length), [7, 9, 12, 16]);
    assert.ok(offers.every((c) => !namesOf(c).includes("Elemental Attunement")));
  }
});

test("a picked discipline is recorded under its row's id and the result is already reconciled", () => {
  const compendium = catalog();
  const char = monkChar(3);
  const row3 = disciplineOffers(char, compendium, ["PHB"]).find((c) => c.id === ROW_3);
  assert.ok(row3, "the 3rd-level discipline row is offered");

  const picked = pickRuleChoice(char, row3, "Water Whip", compendium);
  const entry: RuleChoiceEntry | undefined = picked.ruleChoices?.find((rc) => rc.id === ROW_3);
  assert.deepEqual(entry?.picked, ["Water Whip"]);
  assert.deepEqual(reconcile(picked, compendium), picked);
});

test("resolveOptionName matches case-insensitively, then through the names-only alias table", () => {
  const offered = ["Fangs of the Fire Snake", "Unbroken Air", "Water Whip"];
  assert.equal(resolveOptionName("Unbroken Air", offered), "Unbroken Air");
  assert.equal(resolveOptionName("water whip", offered), "Water Whip");
  assert.equal(resolveOptionName("Fist of Unbroken Air", offered), "Unbroken Air");
  assert.equal(resolveOptionName("fist of unbroken air", offered), "Unbroken Air");
  assert.equal(resolveOptionName("Fist of Unbroken Air", ["Water Whip"]), undefined, "the alias needs its target offered");
  assert.equal(resolveOptionName("Eternal Mountain Defense", offered), undefined);
});

test("a saved 'Fist of Unbroken Air' is shown as the picked 'Unbroken Air' and still counts as the pick", () => {
  const compendium = catalog();
  const saved = monkChar(3, {
    ruleChoices: [
      { id: ROW_3, trait: "Elemental Discipline (3rd Level)", origin: "subclass", choose: 1, from: [], picked: ["Fist of Unbroken Air"] },
    ],
  });
  const offer = disciplineOffers(saved, compendium, ["PHB"]).find((c) => c.id === ROW_3);
  assert.ok(offer);
  const entry = saved.ruleChoices?.find((rc) => rc.id === ROW_3);
  assert.deepEqual(pickedOptionNames(entry?.picked ?? [], namesOf(offer)), ["Unbroken Air"]);

  // Choosing the discipline it already is deselects it, so the saved pick is the one that counts.
  const cleared = pickRuleChoice(saved, offer, "Unbroken Air", compendium);
  assert.equal(cleared.ruleChoices?.find((rc) => rc.id === ROW_3), undefined);

  // Choosing another discipline replaces it, and the saved old name is no longer recorded.
  const replaced = pickRuleChoice(saved, offer, "Water Whip", compendium);
  assert.deepEqual(replaced.ruleChoices?.find((rc) => rc.id === ROW_3)?.picked, ["Water Whip"]);
});

const edRecordNames = (records: OptionFeatureData[]) =>
  records.filter((r) => r.featureType.includes("ED")).map((r) => r.name);

test("every Elemental Discipline record of the default test catalog is in exactly one ki-cost table", () => {
  const names = edRecordNames(loadTestCatalog<OptionFeatureData[]>("options_and_features"));
  assert.ok(names.length > 0, "the default test catalog carries the discipline records");
  const spelled = Object.keys(ELEMENTAL_DISCIPLINE_SPELL_MAP);
  for (const name of names) {
    const inSpellMap = resolveOptionName(name, spelled) !== undefined;
    const inNonSpell = NON_SPELL_DISCIPLINES.some((n) => n.toLowerCase() === name.toLowerCase());
    assert.equal(Number(inSpellMap) + Number(inNonSpell), 1, `${name} must be in exactly one ki-cost table`);
  }
});

test("every ki-cost entry names an Elemental Discipline record, directly or by alias", () => {
  const names = edRecordNames(loadTestCatalog<OptionFeatureData[]>("options_and_features"));
  for (const key of Object.keys(ELEMENTAL_DISCIPLINE_SPELL_MAP)) {
    assert.ok(resolveOptionName(key, names), `${key} names no discipline record`);
  }
});

test("a saved discipline pick gives its ki-cost spell whether saved under the old name or the current one", () => {
  for (const saved of ["Fist of Unbroken Air", "Unbroken Air"]) {
    const spells = getSubclassSpells("Monk", "Way of the Four Elements", 3, {
      ruleChoices: [
        { id: ROW_3, trait: "Elemental Discipline (3rd Level)", origin: "subclass", choose: 1, from: [], picked: [saved] },
      ],
    });
    const spell = spells.known.find((s) => s.name === "Fist of Unbroken Air");
    assert.equal(spell?.kiCost, 2, `a pick saved as "${saved}" gives Fist of Unbroken Air at 2 ki`);
  }
});

// The disciplines the hand-written table offered, by the level that first unlocked them. Literal
// names: the Four Elements rows must offer these, under their current catalog names.
const OLD_TABLE_NAMES: Record<number, string[]> = {
  3: [
    "Fangs of the Fire Snake",
    "Fist of Four Thunders",
    "Fist of Unbroken Air",
    "Rush of the Gale Spirits",
    "Shape the Flowing River",
    "Sweeping Cinder Strike",
    "Water Whip",
  ],
  6: ["Clench of the North Wind", "Gong of the Summit"],
  11: ["Flames of the Phoenix", "Mist Stance", "Ride the Wind"],
  17: ["Breath of Winter", "Eternal Mountain Defense", "River of Hungry Flame", "Wave of Rolling Earth"],
};

const ROW_LEVELS: [number, string][] = [
  [3, ROW_3],
  [6, ROW_6],
  [11, ROW_11],
  [17, ROW_17],
];

/** What the hand-written table offered a row at `level`: its own list and every list below it. */
const oldOfferNames = (level: number): string[] =>
  Object.entries(OLD_TABLE_NAMES)
    .filter(([unlock]) => Number(unlock) <= level)
    .flatMap(([, names]) => names);

test("every option name the old hand-written table offered resolves to a discipline record, directly or by alias", () => {
  for (const records of [loadTestCatalog<OptionFeatureData[]>("options_and_features"), DISCIPLINE_FIXTURE_RECORDS]) {
    const names = edRecordNames(records);
    for (const old of Object.values(OLD_TABLE_NAMES).flat()) {
      assert.ok(resolveOptionName(old, names), `${old} resolves to no discipline record`);
    }
  }
});

test("SRD Baseline and integrated catalog offer each Four Elements row the old table's disciplines, under current names", () => {
  for (const compendium of [srdBaselineCompendium(), integratedTestCompendium()]) {
    for (const [level, id] of ROW_LEVELS) {
      const offer = disciplineOffers(monkChar(level), compendium, ["PHB"]).find((c) => c.id === id);
      assert.ok(offer, `${id} is offered at level ${level}`);
      const offered = namesOf(offer);
      const expected = oldOfferNames(level).map((old) => resolveOptionName(old, offered) ?? old);
      assert.deepEqual([...offered].sort(), [...expected].sort(), `${id} at level ${level}`);
    }
  }
});

test("a stale catalog keeps the Four Elements disciplines offered as a current one does, and keeps saved picks", () => {
  // Stale hides feature rows only. The discipline rows read ED records, which an older catalog still holds.
  const stale = createCompendium(choiceCatalogBundle({ catalogFormat: REQUIRED_CATALOG_FORMAT - 1 }));
  assert.equal(stale.stale, true, "the fixture is stale");
  assert.deepEqual(disciplineOffers(monkChar(17), stale, ["PHB"]), disciplineOffers(monkChar(17), catalog(), ["PHB"]));

  const saved = monkChar(6, {
    ruleChoices: [
      { id: ROW_3, trait: "Elemental Discipline (3rd Level)", origin: "subclass", choose: 1, from: [], picked: ["Fist of Unbroken Air"] },
    ],
  });
  assert.deepEqual(reconcile(saved, stale).ruleChoices, saved.ruleChoices, "the saved discipline pick is untouched");
});
